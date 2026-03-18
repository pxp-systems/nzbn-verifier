import {
  CreateVerifierSessionInput,
  VerifierAdapter,
  VerifierResultInfo,
  VerifierSessionInfo,
  VerifyPresentationInput,
  MockPresentationInput
} from "../../domain/interfaces.js";
import { PresentedCredentialDetails, VerificationPane } from "../../domain/types.js";
import { safeLogger } from "../../logging/safeLogger.js";
import { MockVerifierAdapter } from "../mock/mockVerifierAdapter.js";

interface WaltIdVerifierAdapterOptions {
  baseUrl: string;
  createSessionPath: string;
  resultPathTemplate: string;
  apiKey?: string;
  requestCredentials?: Array<Record<string, unknown>>;
  fetchImpl?: typeof fetch;
}

interface WaltCreateSessionResponse {
  id?: string;
  requestId?: string;
  sessionId?: string;
  verificationId?: string;
  url?: string;
  verificationUrl?: string;
  holderUrl?: string;
  openid4vpUrl?: string;
  rawUrl?: string;
}

interface WaltResultResponse {
  status?: string;
  state?: string;
  verificationStatus?: string;
  result?: string;
  signatureValid?: boolean;
  revoked?: boolean;
  message?: string;
}

export class WaltIdVerifierAdapter implements VerifierAdapter {
  private readonly baseUrl: string;
  private readonly createSessionPath: string;
  private readonly resultPathTemplate: string;
  private readonly apiKey?: string;
  private readonly requestCredentials: Array<Record<string, unknown>>;
  private readonly fetchImpl: typeof fetch;
  private readonly mockAdapter = new MockVerifierAdapter();

  constructor(options: WaltIdVerifierAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.createSessionPath = normalizePath(options.createSessionPath);
    this.resultPathTemplate = normalizePath(options.resultPathTemplate);
    this.apiKey = options.apiKey?.trim() || undefined;
    this.requestCredentials = options.requestCredentials ?? [{ format: "jwt_vc_json", type: "OpenBadgeCredential" }];
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async buildMockPresentation(input: MockPresentationInput): Promise<PresentedCredentialDetails> {
    // TODO: Replace with Walt.id callback-driven holder claims once callback/webhook flow is added.
    return this.mockAdapter.buildMockPresentation(input);
  }

  async verifyPresentation(input: VerifyPresentationInput): Promise<VerificationPane> {
    // TODO: Replace with requestId-bound Walt.id verification lookup once request tracking is persisted.
    return this.mockAdapter.verifyPresentation(input);
  }

  async createVerificationSession(input: CreateVerifierSessionInput): Promise<VerifierSessionInfo> {
    const endpoint = `${this.baseUrl}${this.createSessionPath}`;
    const requestCredentials = input.requestCredentials ?? this.requestCredentials;
    const body = {
      request_credentials: requestCredentials,
      state: input.sessionId,
      customParameters: {
        sessionId: input.sessionId,
        fullName: input.fullName,
        nzbn: input.nzbn
      }
    };

    let response: Response;
    try {
      response = await this.fetchImpl(endpoint, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(body)
      });
    } catch (error) {
      throw new Error(`Walt.id create session request failed: ${(error as Error).message}`);
    }

    if (!response.ok) {
      const details = await safeReadText(response);
      throw new Error(`Walt.id create session failed (${response.status}): ${details}`);
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/json")) {
      const holderUrl = (await response.text()).trim();
      const requestId = extractRequestIdFromHolderUrl(holderUrl) ?? input.sessionId;
      return {
        requestId,
        holderUrl,
        raw: holderUrl
      };
    }

    const raw = (await response.json()) as WaltCreateSessionResponse;
    const holderUrl = raw.holderUrl ?? raw.verificationUrl ?? raw.openid4vpUrl ?? raw.url ?? raw.rawUrl;
    const requestId =
      raw.id ?? raw.requestId ?? raw.sessionId ?? raw.verificationId ?? extractRequestIdFromHolderUrl(holderUrl ?? "") ?? input.sessionId;

    return {
      requestId,
      holderUrl,
      raw
    };
  }

  async getVerificationResult(requestId: string): Promise<VerifierResultInfo> {
    const endpoint = `${this.baseUrl}${this.resultPathTemplate.replace("{id}", encodeURIComponent(requestId))}`;

    let response: Response;
    try {
      response = await this.fetchImpl(endpoint, {
        method: "GET",
        headers: this.headers()
      });
    } catch (error) {
      throw new Error(`Walt.id get result request failed: ${(error as Error).message}`);
    }

    if (!response.ok) {
      const details = await safeReadText(response);
      throw new Error(`Walt.id get result failed (${response.status}): ${details}`);
    }

    const raw = (await response.json()) as WaltResultResponse;
    return {
      requestId,
      status: extractStatus(raw),
      raw
    };
  }

  normalizeVerificationResult(result: VerifierResultInfo): VerificationPane {
    const status = result.status.toLowerCase();

    if (status.includes("revoked")) {
      return {
        result: "failed",
        signatureTrust: "trusted",
        revocationStatus: "revoked",
        scenario: "revoked",
        message: "Credential has been revoked."
      };
    }

    if (status.includes("expired")) {
      return {
        result: "failed",
        signatureTrust: "trusted",
        revocationStatus: "good",
        scenario: "expired",
        message: "Credential was presented but is expired."
      };
    }

    if (status.includes("verified") || status.includes("success") || status.includes("passed")) {
      return {
        result: "verified",
        signatureTrust: "trusted",
        revocationStatus: "good",
        scenario: "valid",
        message: "Credential verified successfully."
      };
    }

    if (status.includes("pending") || status.includes("created") || status.includes("requested")) {
      return {
        result: "not_presented",
        signatureTrust: "unknown",
        revocationStatus: "unknown",
        scenario: "no_presentation",
        message: "Credential presentation is pending with Walt.id verifier."
      };
    }

    safeLogger.warn("Unexpected Walt.id verification status mapped as invalid", {
      event: "waltid.result.unmapped",
      details: {
        status: result.status
      }
    });

    return {
      result: "failed",
      signatureTrust: "untrusted",
      revocationStatus: "unknown",
      scenario: "invalid",
      message: "Credential verification failed."
    };
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json"
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    return headers;
  }
}

function extractRequestIdFromHolderUrl(holderUrl: string): string | undefined {
  if (!holderUrl) {
    return undefined;
  }

  try {
    const url = new URL(holderUrl);
    const state = url.searchParams.get("state");
    if (state) {
      return state;
    }

    const responseUri = url.searchParams.get("response_uri");
    if (!responseUri) {
      return undefined;
    }

    const decodedResponseUri = decodeURIComponent(responseUri);
    const match = decodedResponseUri.match(/\/verify\/([^/?#]+)/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

function normalizePath(path: string): string {
  if (!path.startsWith("/")) {
    return `/${path}`;
  }
  return path;
}

function extractStatus(result: WaltResultResponse): string {
  return result.status ?? result.verificationStatus ?? result.state ?? result.result ?? "unknown";
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "Unable to read response body";
  }
}

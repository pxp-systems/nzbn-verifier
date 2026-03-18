import { MockCompaniesRegistryAdapter } from "../adapters/mock/mockCompaniesRegistryAdapter.js";
import { MockMessagingAdapter } from "../adapters/mock/mockMessagingAdapter.js";
import { MockVerifierAdapter } from "../adapters/mock/mockVerifierAdapter.js";
import { NzbnApiRegistryAdapter } from "../adapters/nzbn/nzbnRegistryAdapter.js";
import { WaltIdVerifierAdapter } from "../adapters/waltid/waltIdVerifierAdapter.js";
import { VerifierAdapter } from "../domain/interfaces.js";
import { env } from "../config/env.js";
import { TroubleshootingService } from "../services/troubleshootingService.js";
import { InMemorySessionStore } from "../sessions/inMemorySessionStore.js";

export interface AppDependencies {
  troubleshootingService: TroubleshootingService;
}

export function createDependencies(): AppDependencies {
  const sessionStore = new InMemorySessionStore(env.SESSION_TTL_MINUTES);
  const waltRequestCredentials = parseWaltRequestCredentials();
  const verifierAdapter = buildVerifierAdapter();
  const verifierSessionAdapter = buildVerifierSessionAdapter(verifierAdapter, waltRequestCredentials);
  const nzbnRegistryAdapter = new NzbnApiRegistryAdapter({
    baseUrl: env.NZBN_API_BASE_URL,
    apiKey: env.NZBN_API_KEY
  });
  const companiesRegistryAdapter = new MockCompaniesRegistryAdapter();
  const messagingAdapter = new MockMessagingAdapter();

  return {
    troubleshootingService: new TroubleshootingService({
      sessionStore,
      verifierAdapter,
      verifierSessionAdapter,
      nzbnRegistryAdapter,
      companiesRegistryAdapter,
      messagingAdapter
    })
  };
}

function buildVerifierAdapter(): VerifierAdapter {
  if (env.VERIFIER_PROVIDER !== "waltid") {
    return new MockVerifierAdapter();
  }

  const requestCredentials = parseWaltRequestCredentials();

  return new WaltIdVerifierAdapter({
    baseUrl: env.WALTID_BASE_URL,
    createSessionPath: env.WALTID_CREATE_SESSION_PATH,
    resultPathTemplate: env.WALTID_RESULT_PATH_TEMPLATE,
    apiKey: env.WALTID_API_KEY,
    requestCredentials
  });
}

function buildVerifierSessionAdapter(
  verifierAdapter: VerifierAdapter,
  requestCredentials: Array<Record<string, unknown>>
): VerifierAdapter | undefined {
  if (verifierAdapter.createVerificationSession || env.NODE_ENV === "test") {
    return undefined;
  }

  return new WaltIdVerifierAdapter({
    baseUrl: env.WALTID_BASE_URL,
    createSessionPath: env.WALTID_CREATE_SESSION_PATH,
    resultPathTemplate: env.WALTID_RESULT_PATH_TEMPLATE,
    apiKey: env.WALTID_API_KEY,
    requestCredentials
  });
}

function parseWaltRequestCredentials(): Array<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(env.WALTID_REQUEST_CREDENTIALS_JSON) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => !!item && typeof item === "object")) {
      return parsed as Array<Record<string, unknown>>;
    }
  } catch {
    // Fall through to default below.
  }

  return [{ format: "jwt_vc_json", type: "OpenBadgeCredential" }];
}

import {
  CreateVerifierSessionInput,
  CompaniesRegistryAdapter,
  MessagingAdapter,
  NzbnRegistryAdapter,
  VerifierResultInfo,
  VerifierSessionInfo,
  VerifierAdapter
} from "../domain/interfaces.js";
import { ContactMethod, SessionEvent, SessionView, TroubleshootingSession, VerificationScenario } from "../domain/types.js";
import { safeLogger } from "../logging/safeLogger.js";
import { InMemorySessionStore } from "../sessions/inMemorySessionStore.js";

export interface TroubleshootingServiceDependencies {
  sessionStore: InMemorySessionStore;
  verifierAdapter: VerifierAdapter;
  verifierSessionAdapter?: VerifierAdapter;
  nzbnRegistryAdapter: NzbnRegistryAdapter;
  companiesRegistryAdapter: CompaniesRegistryAdapter;
  messagingAdapter: MessagingAdapter;
}

export class TroubleshootingService {
  private readonly sessionStore: InMemorySessionStore;
  private readonly verifierAdapter: VerifierAdapter;
  private readonly verifierSessionAdapter?: VerifierAdapter;
  private readonly nzbnRegistryAdapter: NzbnRegistryAdapter;
  private readonly companiesRegistryAdapter: CompaniesRegistryAdapter;
  private readonly messagingAdapter: MessagingAdapter;

  constructor(dependencies: TroubleshootingServiceDependencies) {
    this.sessionStore = dependencies.sessionStore;
    this.verifierAdapter = dependencies.verifierAdapter;
    this.verifierSessionAdapter = dependencies.verifierSessionAdapter;
    this.nzbnRegistryAdapter = dependencies.nzbnRegistryAdapter;
    this.companiesRegistryAdapter = dependencies.companiesRegistryAdapter;
    this.messagingAdapter = dependencies.messagingAdapter;
  }

  createSession(contactMethod: ContactMethod, contactValue: string, baseUrl: string): SessionView {
    const session = this.sessionStore.create({
      contactTarget: {
        method: contactMethod,
        value: contactValue
      },
      baseUrl
    });

    safeLogger.info("Session created", { sessionId: session.sessionId, event: "session.create" });
    return toSessionView(session);
  }

  getSession(sessionId: string): SessionView {
    return toSessionView(this.sessionStore.get(sessionId));
  }

  async sendHolderLink(
    sessionId: string,
    contactMethod: ContactMethod,
    contactValue: string
  ): Promise<SessionView> {
    const session = this.sessionStore.get(sessionId);
    const dispatch = await this.messagingAdapter.sendLink({
      sessionId,
      channel: contactMethod,
      recipientValue: contactValue,
      link: session.holderLink
    });

    const updated = this.sessionStore.update(sessionId, (session) => {
      session.contactTarget = {
        method: contactMethod,
        value: contactValue
      };
      session.status = dispatch.status === "queued" ? "link_sent" : "created";
      session.events.push(event("link_sent", dispatch.status === "queued" ? "Holder link queued for delivery." : "Holder link delivery failed in mock provider."));
    });

    safeLogger.info("Holder link processed", {
      sessionId,
      event: "session.link",
      details: { status: dispatch.status, channel: contactMethod }
    });

    return toSessionView(updated);
  }

  markHolderOpened(sessionId: string): SessionView {
    const updated = this.sessionStore.update(sessionId, (session) => {
      session.status = "holder_opened";
      session.events.push(event("holder_opened_link", "Holder opened the support verification link."));
    });

    safeLogger.info("Holder opened session link", {
      sessionId,
      event: "session.holder_open"
    });

    return toSessionView(updated);
  }

  async processHolderPresentation(
    sessionId: string,
    scenario: VerificationScenario,
    nzbn?: string
  ): Promise<SessionView> {
    const presentedCredential = await this.verifierAdapter.buildMockPresentation({ sessionId, scenario, nzbn });
    const verificationResult = await this.verifierAdapter.verifyPresentation({
      sessionId,
      scenario,
      presentedCredential
    });

    let nzbnContext = await this.nzbnRegistryAdapter.lookup({
      assertedInput: presentedCredential.holderClaims
    });
    let nzbnLookupError: string | undefined;
    if (!nzbnContext) {
      nzbnLookupError = `NZBN lookup failed for ${presentedCredential.holderClaims.nzbn}.`;
    }

    const companiesContext = await this.companiesRegistryAdapter.lookup({
      assertedInput: presentedCredential.holderClaims
    });

    const updated = this.sessionStore.update(sessionId, (session) => {
      session.assertedInput = presentedCredential.holderClaims;
      session.presentedCredential = presentedCredential;
      session.verificationResult = verificationResult;
      session.nzbnContext = nzbnContext ?? undefined;
      session.nzbnLookupError = nzbnLookupError;
      session.companiesContext = companiesContext;
      session.status = "verification_complete";
      session.events.push(event("presentation_received", "Holder submitted credential presentation."));
      session.events.push(event("verification_complete", verificationResult.message));
    });

    safeLogger.info("Presentation processed", {
      sessionId,
      event: "session.presentation",
      details: {
        scenario,
        result: verificationResult.result
      }
    });

    return toSessionView(updated);
  }

  resetSessions(): void {
    this.sessionStore.reset();
    safeLogger.info("All sessions cleared", { event: "session.reset" });
  }

  async createVerifierSession(input: CreateVerifierSessionInput): Promise<VerifierSessionInfo> {
    const adapter = this.sessionCapableVerifierAdapter();
    if (!adapter?.createVerificationSession) {
      throw new Error("Active verifier provider does not support session creation.");
    }

    const session = this.sessionStore.get(input.sessionId);
    return adapter.createVerificationSession({
      sessionId: input.sessionId,
      nzbn: input.nzbn ?? session.assertedInput?.nzbn,
      fullName: input.fullName ?? session.assertedInput?.fullName,
      requestCredentials: input.requestCredentials
    });
  }

  async getVerifierResult(requestId: string): Promise<VerifierResultInfo> {
    const adapter = this.sessionCapableVerifierAdapter();
    if (!adapter?.getVerificationResult) {
      throw new Error("Active verifier provider does not support result retrieval.");
    }

    return adapter.getVerificationResult(requestId);
  }

  normalizeVerifierResult(result: VerifierResultInfo) {
    const adapter = this.sessionCapableVerifierAdapter();
    if (adapter?.normalizeVerificationResult) {
      return adapter.normalizeVerificationResult(result);
    }

    return {
      result: "not_presented" as const,
      signatureTrust: "unknown" as const,
      revocationStatus: "unknown" as const,
      scenario: "no_presentation" as const,
      message: "Verifier result normalization is not available for the active provider."
    };
  }

  private sessionCapableVerifierAdapter(): VerifierAdapter | undefined {
    if (this.verifierAdapter.createVerificationSession) {
      return this.verifierAdapter;
    }

    return this.verifierSessionAdapter;
  }
}

function toSessionView(session: TroubleshootingSession): SessionView {
  return {
    ...session,
    contactTarget: {
      method: session.contactTarget.method
    },
    events: [...session.events]
  };
}

function event(type: SessionEvent["type"], note: string): SessionEvent {
  return {
    type,
    note,
    at: new Date().toISOString()
  };
}

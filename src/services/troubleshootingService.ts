import {
  CompaniesRegistryAdapter,
  MessagingAdapter,
  NzbnRegistryAdapter,
  VerifierAdapter
} from "../domain/interfaces.js";
import { ContactMethod, SessionEvent, SessionView, TroubleshootingSession, VerificationScenario } from "../domain/types.js";
import { safeLogger } from "../logging/safeLogger.js";
import { InMemorySessionStore } from "../sessions/inMemorySessionStore.js";

export interface TroubleshootingServiceDependencies {
  sessionStore: InMemorySessionStore;
  verifierAdapter: VerifierAdapter;
  nzbnRegistryAdapter: NzbnRegistryAdapter;
  companiesRegistryAdapter: CompaniesRegistryAdapter;
  messagingAdapter: MessagingAdapter;
}

export class TroubleshootingService {
  private readonly sessionStore: InMemorySessionStore;
  private readonly verifierAdapter: VerifierAdapter;
  private readonly nzbnRegistryAdapter: NzbnRegistryAdapter;
  private readonly companiesRegistryAdapter: CompaniesRegistryAdapter;
  private readonly messagingAdapter: MessagingAdapter;

  constructor(dependencies: TroubleshootingServiceDependencies) {
    this.sessionStore = dependencies.sessionStore;
    this.verifierAdapter = dependencies.verifierAdapter;
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
    scenario: VerificationScenario
  ): Promise<SessionView> {
    const presentedCredential = await this.verifierAdapter.buildMockPresentation({ sessionId, scenario });
    const verificationResult = await this.verifierAdapter.verifyPresentation({
      sessionId,
      scenario,
      presentedCredential
    });

    const nzbnContext = await this.nzbnRegistryAdapter.lookup({
      assertedInput: presentedCredential.holderClaims
    });

    const companiesContext = await this.companiesRegistryAdapter.lookup({
      assertedInput: presentedCredential.holderClaims
    });

    const updated = this.sessionStore.update(sessionId, (session) => {
      session.assertedInput = presentedCredential.holderClaims;
      session.presentedCredential = presentedCredential;
      session.verificationResult = verificationResult;
      session.nzbnContext = nzbnContext;
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

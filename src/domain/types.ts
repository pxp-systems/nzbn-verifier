export type ContactMethod = "sms" | "email";

export type SessionStatus =
  | "created"
  | "link_sent"
  | "holder_opened"
  | "presentation_received"
  | "verification_complete"
  | "expired";

export type VerificationScenario =
  | "valid"
  | "expired"
  | "revoked"
  | "invalid"
  | "no_presentation";

export interface ContactTarget {
  method: ContactMethod;
  value: string;
}

export interface AssertedInput {
  fullName: string;
  dateOfBirth: string;
  nzbn: string;
  rolesControlled: string[];
  rolesDirectorAsserted: string[];
}

export interface PresentedCredentialDetails {
  issuer: string;
  documentType: string;
  documentNumber: string;
  issuedDate: string;
  expiryDate: string;
  holderClaims: AssertedInput;
}

export interface VerificationPane {
  result: "verified" | "failed" | "not_presented";
  signatureTrust: "trusted" | "untrusted" | "unknown";
  revocationStatus: "good" | "revoked" | "unknown";
  message: string;
  scenario: VerificationScenario;
}

export interface NzbnContext {
  nzbn: string;
  entityName: string;
  entityStatus: "active" | "struck_off";
  mismatchIndicators: string[];
}

export interface CompaniesContext {
  companiesStatus: "active" | "struck_off";
  directors: string[];
  mismatchIndicators: string[];
}

export type MessagingStatus = "queued" | "failed";

export interface MessageDispatchResult {
  status: MessagingStatus;
  messageId: string;
}

export interface SessionEvent {
  type:
    | "session_created"
    | "link_sent"
    | "holder_opened_link"
    | "presentation_received"
    | "verification_complete"
    | "session_expired";
  at: string;
  note: string;
}

export interface TroubleshootingSession {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  status: SessionStatus;
  holderLink: string;
  contactTarget: ContactTarget;
  assertedInput?: AssertedInput;
  presentedCredential?: PresentedCredentialDetails;
  verificationResult?: VerificationPane;
  nzbnContext?: NzbnContext;
  nzbnLookupError?: string;
  companiesContext?: CompaniesContext;
  events: SessionEvent[];
}

export interface SessionView {
  sessionId: string;
  createdAt: string;
  expiresAt: string;
  status: SessionStatus;
  holderLink: string;
  contactTarget: Pick<ContactTarget, "method">;
  assertedInput?: AssertedInput;
  presentedCredential?: PresentedCredentialDetails;
  verificationResult?: VerificationPane;
  nzbnContext?: NzbnContext;
  nzbnLookupError?: string;
  companiesContext?: CompaniesContext;
  events: SessionEvent[];
}

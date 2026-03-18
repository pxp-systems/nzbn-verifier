import {
  AssertedInput,
  ContactMethod,
  CompaniesContext,
  MessageDispatchResult,
  NzbnContext,
  PresentedCredentialDetails,
  VerificationPane,
  VerificationScenario
} from "./types.js";

export interface MessagingInput {
  sessionId: string;
  channel: ContactMethod;
  recipientValue: string;
  link: string;
}

export interface MockPresentationInput {
  sessionId: string;
  scenario: VerificationScenario;
  nzbn?: string;
}

export interface VerifyPresentationInput {
  sessionId: string;
  scenario: VerificationScenario;
  presentedCredential: PresentedCredentialDetails;
}

export interface CreateVerifierSessionInput {
  sessionId: string;
  nzbn?: string;
  fullName?: string;
  requestCredentials?: Array<Record<string, unknown>>;
}

export interface VerifierSessionInfo {
  requestId: string;
  holderUrl?: string;
  raw: unknown;
}

export interface VerifierResultInfo {
  requestId: string;
  status: string;
  raw: unknown;
}

export interface NzbnLookupInput {
  assertedInput: AssertedInput;
}

export interface CompaniesLookupInput {
  assertedInput: AssertedInput;
}

export interface MessagingAdapter {
  sendLink(input: MessagingInput): Promise<MessageDispatchResult>;
}

export interface VerifierAdapter {
  buildMockPresentation(input: MockPresentationInput): Promise<PresentedCredentialDetails>;
  verifyPresentation(input: VerifyPresentationInput): Promise<VerificationPane>;
  createVerificationSession?(input: CreateVerifierSessionInput): Promise<VerifierSessionInfo>;
  getVerificationResult?(requestId: string): Promise<VerifierResultInfo>;
  normalizeVerificationResult?(result: VerifierResultInfo): VerificationPane;
}

export interface NzbnRegistryAdapter {
  lookup(input: NzbnLookupInput): Promise<NzbnContext | null>;
}

export interface CompaniesRegistryAdapter {
  lookup(input: CompaniesLookupInput): Promise<CompaniesContext>;
}

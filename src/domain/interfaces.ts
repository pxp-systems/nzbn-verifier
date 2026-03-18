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
}

export interface VerifyPresentationInput {
  sessionId: string;
  scenario: VerificationScenario;
  presentedCredential: PresentedCredentialDetails;
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
}

export interface NzbnRegistryAdapter {
  lookup(input: NzbnLookupInput): Promise<NzbnContext>;
}

export interface CompaniesRegistryAdapter {
  lookup(input: CompaniesLookupInput): Promise<CompaniesContext>;
}

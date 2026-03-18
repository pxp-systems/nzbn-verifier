import {
  MockPresentationInput,
  VerifyPresentationInput,
  VerifierAdapter
} from "../../domain/interfaces.js";
import {
  AssertedInput,
  PresentedCredentialDetails,
  VerificationPane
} from "../../domain/types.js";

export class MockVerifierAdapter implements VerifierAdapter {
  async buildMockPresentation(input: MockPresentationInput): Promise<PresentedCredentialDetails> {
    // TODO: Replace this mock flow with real holder presentation capture.
    const baseClaims: AssertedInput = {
      fullName: "Alex Taylor",
      dateOfBirth: "1988-10-12",
      nzbn: "9429041234567",
      rolesControlled: ["Administrator"],
      rolesDirectorAsserted: ["Director"]
    };

    if (input.scenario === "invalid") {
      return {
        issuer: "mock-issuer",
        documentType: "NZBN VC",
        documentNumber: "DOC-INVALID-01",
        issuedDate: "2024-01-01",
        expiryDate: "2028-01-01",
        holderClaims: {
          ...baseClaims,
          fullName: "Mismatch Holder"
        }
      };
    }

    return {
      issuer: "mock-issuer",
      documentType: "NZBN VC",
      documentNumber: `DOC-${input.sessionId.slice(0, 8).toUpperCase()}`,
      issuedDate: "2024-01-01",
      expiryDate: input.scenario === "expired" ? "2024-12-01" : "2028-01-01",
      holderClaims: baseClaims
    };
  }

  async verifyPresentation(input: VerifyPresentationInput): Promise<VerificationPane> {
    // TODO: Replace this mock flow with real verifier integration.
    if (input.scenario === "no_presentation") {
      return {
        result: "not_presented",
        signatureTrust: "unknown",
        revocationStatus: "unknown",
        scenario: input.scenario,
        message: "No credential presentation was received from holder."
      };
    }

    if (input.scenario === "expired") {
      return {
        result: "failed",
        signatureTrust: "trusted",
        revocationStatus: "good",
        scenario: input.scenario,
        message: "Credential was presented but is expired."
      };
    }

    if (input.scenario === "revoked") {
      return {
        result: "failed",
        signatureTrust: "trusted",
        revocationStatus: "revoked",
        scenario: input.scenario,
        message: "Credential has been revoked."
      };
    }

    if (input.scenario === "invalid") {
      return {
        result: "failed",
        signatureTrust: "untrusted",
        revocationStatus: "unknown",
        scenario: input.scenario,
        message: "Credential signature could not be trusted."
      };
    }

    return {
      result: "verified",
      signatureTrust: "trusted",
      revocationStatus: "good",
      scenario: input.scenario,
      message: "Credential verified successfully."
    };
  }
}

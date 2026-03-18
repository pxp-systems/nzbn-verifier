import { ContactMethod, SessionView, VerificationScenario } from "../domain/types.js";

export interface CreateSessionRequest {
  contactMethod: ContactMethod;
  contactValue: string;
}

export interface SendLinkRequest {
  contactMethod: ContactMethod;
  contactValue: string;
}

export interface PresentCredentialRequest {
  scenario: VerificationScenario;
}

export interface SessionResponse {
  session: SessionView;
}

export interface SessionEventResponse {
  type: "session_updated";
  session: SessionView;
}

export interface ErrorResponse {
  message: string;
  issues?: Array<{
    path: string;
    message: string;
  }>;
}

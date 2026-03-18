export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
    this.name = "SessionNotFoundError";
  }
}

export class SessionExpiredError extends Error {
  constructor(sessionId: string) {
    super(`Session expired: ${sessionId}`);
    this.name = "SessionExpiredError";
  }
}

export class RateLimitError extends Error {
  constructor() {
    super("Too many session creation requests. Please wait a moment.");
    this.name = "RateLimitError";
  }
}

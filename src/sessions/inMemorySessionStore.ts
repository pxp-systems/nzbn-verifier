import { randomBytes } from "node:crypto";
import { SessionExpiredError, SessionNotFoundError } from "../domain/errors.js";
import { ContactTarget, SessionEvent, TroubleshootingSession } from "../domain/types.js";

export interface CreateSessionInput {
  contactTarget: ContactTarget;
  baseUrl: string;
}

export class InMemorySessionStore {
  private readonly sessions = new Map<string, TroubleshootingSession>();
  private readonly ttlMs: number;

  constructor(ttlMinutes = 15) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  create(input: CreateSessionInput): TroubleshootingSession {
    const now = new Date().toISOString();
    const createdAtMs = Date.now();
    const expiresAt = new Date(createdAtMs + this.ttlMs).toISOString();

    const firstEvent: SessionEvent = {
      type: "session_created",
      at: now,
      note: "Session started by contact-centre agent."
    };

    const session: TroubleshootingSession = {
      sessionId: randomBytes(16).toString("hex"),
      createdAt: now,
      expiresAt,
      status: "created",
      holderLink: "",
      contactTarget: input.contactTarget,
      events: [firstEvent]
    };

    session.holderLink = `${input.baseUrl}/session/${session.sessionId}`;

    this.sessions.set(session.sessionId, session);
    return session;
  }

  get(sessionId: string): TroubleshootingSession {
    this.cleanupExpired();

    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    if (Date.now() >= new Date(session.expiresAt).getTime()) {
      this.sessions.delete(sessionId);
      throw new SessionExpiredError(sessionId);
    }

    return session;
  }

  update(sessionId: string, updateFn: (session: TroubleshootingSession) => void): TroubleshootingSession {
    const session = this.get(sessionId);
    updateFn(session);
    return session;
  }

  reset(): void {
    this.sessions.clear();
  }

  cleanupExpired(): void {
    const now = Date.now();

    for (const [key, session] of this.sessions.entries()) {
      if (new Date(session.expiresAt).getTime() <= now) {
        this.sessions.delete(key);
      }
    }
  }
}

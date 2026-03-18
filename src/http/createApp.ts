import express, { NextFunction, Request, Response } from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { AppDependencies } from "../bootstrap/createDependencies.js";
import { env } from "../config/env.js";
import { RateLimitError, SessionExpiredError, SessionNotFoundError } from "../domain/errors.js";
import { safeLogger } from "../logging/safeLogger.js";
import {
  createSessionSchema,
  presentCredentialSchema,
  sendLinkSchema,
  sessionIdParamSchema,
} from "../schemas/api.js";
import { ErrorResponse, SessionEventResponse, SessionResponse } from "../shared/apiTypes.js";
import { parseOrThrow, ValidationErrorPayload } from "../utils/validate.js";

export function createApp(dependencies: AppDependencies) {
  const app = express();
  const sseClients = new Map<string, Set<Response>>();
  const creationHistory: number[] = [];
  const uiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../ui");

  app.use(express.json());
  app.use("/ui", express.static(uiDir));

  app.get("/", (_req, res) => {
    res.type("html").send(renderAgentDashboardPage());
  });

  app.get("/session/:sessionId", (req, res, next) => {
    try {
      const { sessionId } = parseOrThrow(sessionIdParamSchema, req.params);
      dependencies.troubleshootingService.markHolderOpened(sessionId);
      const updated = dependencies.troubleshootingService.getSession(sessionId);
      publishSession(sessionId, updated, sseClients);
      res.type("html").send(renderHolderPage(sessionId));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sessions", (req, res, next) => {
    try {
      enforceCreateRateLimit(creationHistory);
      const payload = parseOrThrow(createSessionSchema, req.body);
      const session = dependencies.troubleshootingService.createSession(
        payload.contactMethod,
        payload.contactValue,
        baseUrl(req)
      );

      const response: SessionResponse = { session };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sessions/:sessionId/send-link", async (req, res, next) => {
    try {
      const { sessionId } = parseOrThrow(sessionIdParamSchema, req.params);
      const payload = parseOrThrow(sendLinkSchema, req.body);
      const session = await dependencies.troubleshootingService.sendHolderLink(
        sessionId,
        payload.contactMethod,
        payload.contactValue
      );

      publishSession(sessionId, session, sseClients);
      const response: SessionResponse = { session };
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sessions/:sessionId/present", async (req, res, next) => {
    try {
      const { sessionId } = parseOrThrow(sessionIdParamSchema, req.params);
      const payload = parseOrThrow(presentCredentialSchema, req.body);
      const session = await dependencies.troubleshootingService.processHolderPresentation(
        sessionId,
        payload.scenario,
        payload.nzbn
      );

      publishSession(sessionId, session, sseClients);
      const response: SessionResponse = { session };
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/sessions/:sessionId", (req, res, next) => {
    try {
      const { sessionId } = parseOrThrow(sessionIdParamSchema, req.params);
      const session = dependencies.troubleshootingService.getSession(sessionId);
      const response: SessionResponse = { session };
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/sessions/:sessionId/events", (req, res, next) => {
    try {
      const { sessionId } = parseOrThrow(sessionIdParamSchema, req.params);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const listeners = sseClients.get(sessionId) ?? new Set<Response>();
      listeners.add(res);
      sseClients.set(sessionId, listeners);

      const session = dependencies.troubleshootingService.getSession(sessionId);
      publishSession(sessionId, session, sseClients);

      req.on("close", () => {
        const clientSet = sseClients.get(sessionId);
        clientSet?.delete(res);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sessions/reset", (_req, res) => {
    dependencies.troubleshootingService.resetSessions();
    res.json({ message: "Session memory cleared." });
  });

  app.use((error: unknown, _req: Request, res: Response<ErrorResponse>, _next: NextFunction) => {
    if (error instanceof SessionNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }

    if (error instanceof SessionExpiredError) {
      res.status(410).json({ message: error.message });
      return;
    }

    if (error instanceof RateLimitError) {
      res.status(429).json({ message: error.message });
      return;
    }

    if (isValidationError(error)) {
      res.status(400).json({
        message: error.payload.message,
        issues: error.payload.issues
      });
      return;
    }

    safeLogger.error("Unhandled error", { event: "http.unhandled" });
    res.status(500).json({ message: "Internal server error" });
  });

  return app;
}

function enforceCreateRateLimit(history: number[]): void {
  const now = Date.now();
  const oneMinuteAgo = now - 60_000;

  while (history.length > 0) {
    const oldest = history[0];
    if (oldest === undefined || oldest >= oneMinuteAgo) {
      break;
    }
    history.shift();
  }

  if (history.length >= env.SESSION_CREATE_LIMIT_PER_MINUTE) {
    throw new RateLimitError();
  }

  history.push(now);
}

function publishSession(sessionId: string, response: SessionResponse["session"], clients: Map<string, Set<Response>>): void {
  const listeners = clients.get(sessionId);
  if (!listeners || listeners.size === 0) {
    return;
  }

  const payload: SessionEventResponse = {
    type: "session_updated",
    session: response
  };

  const encoded = `data: ${JSON.stringify(payload)}\n\n`;
  listeners.forEach((client) => {
    client.write(encoded);
  });
}

function isValidationError(
  error: unknown
): error is Error & { payload: ValidationErrorPayload } {
  return (
    error instanceof Error &&
    error.name === "ValidationError" &&
    typeof (error as { payload?: unknown }).payload === "object"
  );
}

function baseUrl(req: Request): string {
  return `${req.protocol}://${req.get("host")}`;
}

function renderAgentDashboardPage(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>NZBN Support Verifier</title><script type="module" src="/ui/agent.js"></script><style>body{font-family:sans-serif;margin:1rem;background:#f9fafb;color:#1f2937}h1{margin:0 0 1rem}section{background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:1rem;margin-bottom:1rem}.row{display:flex;gap:.5rem;flex-wrap:wrap}input,select,button{padding:.45rem .6rem;border:1px solid #cbd5e1;border-radius:6px}button{background:#111827;color:#fff;border:none}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}pre{white-space:pre-wrap;font-size:.85rem;background:#f3f4f6;padding:.75rem;border-radius:6px}@media(max-width:980px){.grid{grid-template-columns:1fr}}</style></head><body><h1>NZBN Support Verifier Dashboard</h1><section><div class="row"><select id="contactMethod"><option value="sms">sms</option><option value="email">email</option></select><input id="contactValue" placeholder="Contact value" /><button id="createSession">Start session</button><button id="sendLink">Send holder link</button><button id="resetSessions">Reset memory</button></div><p id="sessionMeta">No session yet.</p></section><section class="grid"><div><h2>Credential / Verification</h2><pre id="paneVerification">No presentation yet.</pre></div><div><h2>NZBN Context</h2><pre id="paneNzbn">No NZBN lookup yet.</pre></div><div><h2>Companies Context</h2><pre id="paneCompanies">No Companies lookup yet.</pre></div></section><section><h2>Session Timeline</h2><pre id="sessionTimeline">No events yet.</pre></section></body></html>`;
}

function renderHolderPage(sessionId: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Join Verification Session</title><script type="module" src="/ui/holder.js"></script><style>body{font-family:sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem}section{border:1px solid #d1d5db;border-radius:8px;padding:1rem}.row{display:flex;gap:.5rem;flex-wrap:wrap}input,select,button{padding:.45rem .6rem;border:1px solid #cbd5e1;border-radius:6px}button{background:#111827;color:#fff;border:none}</style></head><body><section><h1>You are joining a support verification session</h1><p>Session ID: <code>${sessionId}</code></p><p>Select a mock scenario and present your credential.</p><div class="row"><select id="scenario"><option value="valid">valid</option><option value="expired">expired</option><option value="revoked">revoked</option><option value="invalid">invalid</option><option value="no_presentation">no_presentation</option></select><input id="nzbn" placeholder="Override NZBN (optional)" value="9429041138090" /><button id="present">Present credential</button></div><p id="holderResult"></p></section></body></html>`;
}

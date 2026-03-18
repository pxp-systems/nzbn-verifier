import { describe, expect, it, vi } from "vitest";
import { WaltIdVerifierAdapter } from "../src/adapters/waltid/waltIdVerifierAdapter.js";

describe("WaltIdVerifierAdapter", () => {
  it("creates a verification session from text response and extracts request ID from state", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: {
        get: () => "text/plain; charset=UTF-8"
      },
      text: async () =>
        "openid4vp://authorize?state=session-state-1&response_uri=http%3A%2F%2Flocalhost%3A7003%2Fopenid4vc%2Fverify%2Fsession-state-1"
    });

    const adapter = new WaltIdVerifierAdapter({
      baseUrl: "http://localhost:7003",
      createSessionPath: "/openid4vc/verify",
      resultPathTemplate: "/openid4vc/session/{id}",
      requestCredentials: [{ format: "jwt_vc_json", type: "OpenBadgeCredential" }],
      fetchImpl
    });

    const session = await adapter.createVerificationSession({
      sessionId: "session-1",
      fullName: "Alex Taylor",
      nzbn: "9429041138090"
    });

    expect(session.requestId).toBe("session-state-1");
    expect(session.holderUrl).toContain("openid4vp://authorize");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const options = fetchImpl.mock.calls[0]?.[1] as { body: string };
    const parsedBody = JSON.parse(options.body) as {
      request_credentials: Array<Record<string, unknown>>;
    };
    expect(parsedBody.request_credentials).toEqual([{ format: "jwt_vc_json", type: "OpenBadgeCredential" }]);
  });

  it("creates a verification session and returns holder URL + request ID", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => "application/json"
        },
        json: async () => ({
          id: "req-123",
          verificationUrl: "openid4vp://request"
        })
      });

    const adapter = new WaltIdVerifierAdapter({
      baseUrl: "http://localhost:7003",
      createSessionPath: "/openid4vc/verify",
      resultPathTemplate: "/openid4vc/session/{id}",
      fetchImpl
    });

    const session = await adapter.createVerificationSession({
      sessionId: "session-1",
      fullName: "Alex Taylor",
      nzbn: "9429041138090"
    });

    expect(session.requestId).toBe("req-123");
    expect(session.holderUrl).toBe("openid4vp://request");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fetches and normalizes a successful verification result", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "verified"
        })
      });

    const adapter = new WaltIdVerifierAdapter({
      baseUrl: "http://localhost:7003",
      createSessionPath: "/openid4vc/verify",
      resultPathTemplate: "/openid4vc/session/{id}",
      fetchImpl
    });

    const result = await adapter.getVerificationResult("req-123");
    const normalized = adapter.normalizeVerificationResult(result);

    expect(result.requestId).toBe("req-123");
    expect(result.status).toBe("verified");
    expect(normalized.result).toBe("verified");
    expect(normalized.signatureTrust).toBe("trusted");
    expect(normalized.revocationStatus).toBe("good");
  });
});

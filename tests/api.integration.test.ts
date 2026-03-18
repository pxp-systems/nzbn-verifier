import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("NZBN support verifier API", () => {
  it("renders Walt.id QR controls on the dashboard", async () => {
    const app = buildApp();

    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.text).toContain('id="createVerifierQr"');
    expect(response.text).toContain('id="verifierQrStatus"');
    expect(response.text).toContain('id="verifierQrImage"');
  });

  it("runs session -> link -> holder presentation flow and returns three-pane context", async () => {
    const app = buildApp();

    const createResponse = await request(app).post("/api/sessions").send({
      contactMethod: "sms",
      contactValue: "+64000000000"
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.session.sessionId).toHaveLength(32);
    expect(createResponse.body.session.holderLink).toContain("/session/");

    const sessionId = createResponse.body.session.sessionId as string;

    const sendLinkResponse = await request(app)
      .post(`/api/sessions/${sessionId}/send-link`)
      .send({
        contactMethod: "sms",
        contactValue: "+64000000000"
      });

    expect(sendLinkResponse.status).toBe(200);
    expect(sendLinkResponse.body.session.status).toBe("link_sent");

    const holderOpenResponse = await request(app).get(`/session/${sessionId}`);
    expect(holderOpenResponse.status).toBe(200);

    const presentationResponse = await request(app)
      .post(`/api/sessions/${sessionId}/present`)
      .send({
        scenario: "valid"
      });

    expect(presentationResponse.status).toBe(200);
    expect(presentationResponse.body.session.verificationResult.result).toBe("verified");
    const nzbnContext = presentationResponse.body.session.nzbnContext;
    const nzbnLookupError = presentationResponse.body.session.nzbnLookupError;
    if (nzbnContext) {
      expect(nzbnContext.nzbn).toBe("9429041138090");
    } else {
      expect(nzbnLookupError).toContain("NZBN lookup failed");
    }
    expect(presentationResponse.body.session.companiesContext).toBeTruthy();
    expect(Array.isArray(presentationResponse.body.session.events)).toBe(true);
  });

  it("returns trusted signature with revoked status and revoked holder name for revoked scenario", async () => {
    const app = buildApp();

    const createResponse = await request(app).post("/api/sessions").send({
      contactMethod: "sms",
      contactValue: "+64000000000"
    });

    const sessionId = createResponse.body.session.sessionId as string;

    const presentationResponse = await request(app)
      .post(`/api/sessions/${sessionId}/present`)
      .send({
        scenario: "revoked"
      });

    expect(presentationResponse.status).toBe(200);
    expect(presentationResponse.body.session.presentedCredential.holderClaims.fullName).toBe(
      "Renee Revoked Holder"
    );
    expect(presentationResponse.body.session.verificationResult.signatureTrust).toBe("trusted");
    expect(presentationResponse.body.session.verificationResult.revocationStatus).toBe("revoked");
  });

  it("accepts nzbn override in holder presentation payload", async () => {
    const app = buildApp();

    const createResponse = await request(app).post("/api/sessions").send({
      contactMethod: "sms",
      contactValue: "+64000000000"
    });

    const sessionId = createResponse.body.session.sessionId as string;

    const presentationResponse = await request(app)
      .post(`/api/sessions/${sessionId}/present`)
      .send({
        scenario: "valid",
        nzbn: "9429049999999"
      });

    expect(presentationResponse.status).toBe(200);
    expect(presentationResponse.body.session.presentedCredential.holderClaims.nzbn).toBe("9429049999999");
    expect(presentationResponse.body.session.nzbnContext ?? null).toBeNull();
    expect(presentationResponse.body.session.nzbnLookupError).toContain("9429049999999");
  });

  it("resets in-memory sessions", async () => {
    const app = buildApp();

    const createResponse = await request(app).post("/api/sessions").send({
      contactMethod: "email",
      contactValue: "holder@example.test"
    });
    const sessionId = createResponse.body.session.sessionId as string;

    const resetResponse = await request(app).post("/api/sessions/reset").send({});
    expect(resetResponse.status).toBe(200);

    const fetchAfterReset = await request(app).get(`/api/sessions/${sessionId}`);
    expect(fetchAfterReset.status).toBe(404);
  });

  it("returns validation errors for invalid payloads", async () => {
    const app = buildApp();

    const response = await request(app).post("/api/sessions").send({
      contactMethod: "sms",
      contactValue: ""
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation failed");
    expect(Array.isArray(response.body.issues)).toBe(true);
  });

  it("returns not supported for verifier dev route when provider is mock", async () => {
    const app = buildApp();

    const response = await request(app).post("/api/dev/verifier/session").send({
      sessionId: "session-dev-1",
      nzbn: "9429041138090",
      fullName: "Alex Taylor"
    });

    expect(response.status).toBe(501);
    expect(response.body.message).toContain("does not support session creation");
  });
});

import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("NZBN support verifier API", () => {
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
    expect(presentationResponse.body.session.nzbnContext).toBeTruthy();
    expect(presentationResponse.body.session.companiesContext).toBeTruthy();
    expect(Array.isArray(presentationResponse.body.session.events)).toBe(true);
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
});

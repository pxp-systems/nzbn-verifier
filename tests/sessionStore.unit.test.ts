import { describe, expect, it } from "vitest";
import { InMemorySessionStore } from "../src/sessions/inMemorySessionStore.js";

describe("InMemorySessionStore", () => {
  it("creates secure random session IDs", () => {
    const store = new InMemorySessionStore();
    const session = store.create({
      contactTarget: {
        method: "sms",
        value: "+64000000000"
      },
      baseUrl: "http://localhost:3000"
    });

    expect(session.sessionId).toMatch(/^[a-f0-9]{32}$/);
    expect(session.holderLink).toContain(`/session/${session.sessionId}`);
  });

  it("updates existing session state in memory", () => {
    const store = new InMemorySessionStore();
    const session = store.create({
      contactTarget: {
        method: "email",
        value: "holder@example.test"
      },
      baseUrl: "http://localhost:3000"
    });

    const updated = store.update(session.sessionId, (draft) => {
      draft.status = "link_sent";
    });

    expect(updated.status).toBe("link_sent");
    expect(store.get(session.sessionId).status).toBe("link_sent");
  });
});

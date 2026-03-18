import { describe, expect, it, vi } from "vitest";
import { NzbnApiRegistryAdapter } from "../src/adapters/nzbn/nzbnRegistryAdapter.js";

const mockEntityResponse = {
  nzbn: "9429041138090",
  entityName: "WOOKIE INVESTMENTS LIMITED",
  entityStatusCode: "ACT",
  roles: [
    {
      roleType: "Director",
      roleStatus: "Current",
      rolePerson: {
        firstName: "Alex",
        lastName: "Taylor"
      }
    },
    {
      roleType: "Shareholder",
      roleStatus: "Current",
      rolePerson: {
        firstName: "Sam",
        lastName: "Morgan"
      }
    }
  ]
};

describe("NzbnApiRegistryAdapter", () => {
  it("returns no mismatch indicators when holder name matches a director/shareholder", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockEntityResponse
    });

    const adapter = new NzbnApiRegistryAdapter({
      baseUrl: "https://api.business.govt.nz/gateway/nzbn/v5",
      apiKey: "test-key",
      fetchImpl
    });

    const context = await adapter.lookup({
      assertedInput: {
        fullName: "Alex Taylor",
        dateOfBirth: "1988-10-12",
        nzbn: "9429041138090",
        rolesControlled: ["Administrator"],
        rolesDirectorAsserted: ["Director"]
      }
    });

    expect(context).toBeTruthy();
    if (!context) {
      throw new Error("Expected NZBN context");
    }
    expect(context.nzbn).toBe("9429041138090");
    expect(context.entityName).toBe("WOOKIE INVESTMENTS LIMITED");
    expect(context.entityStatus).toBe("active");
    expect(context.mismatchIndicators).toEqual([]);
  });

  it("returns holder_name_mismatch when holder name does not match directors/shareholders", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockEntityResponse
    });

    const adapter = new NzbnApiRegistryAdapter({
      baseUrl: "https://api.business.govt.nz/gateway/nzbn/v5",
      apiKey: "test-key",
      fetchImpl
    });

    const context = await adapter.lookup({
      assertedInput: {
        fullName: "Casey NoMatch",
        dateOfBirth: "1988-10-12",
        nzbn: "9429041138090",
        rolesControlled: ["Administrator"],
        rolesDirectorAsserted: ["Director"]
      }
    });

    expect(context).toBeTruthy();
    if (!context) {
      throw new Error("Expected NZBN context");
    }
    expect(context.mismatchIndicators).toEqual(["holder_name_mismatch"]);
  });

  it("supports wrapped entity response payloads and trimmed API key", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        entity: mockEntityResponse
      })
    });

    const adapter = new NzbnApiRegistryAdapter({
      baseUrl: "https://api.business.govt.nz/gateway/nzbn/v5",
      apiKey: "  test-key  ",
      fetchImpl
    });

    const context = await adapter.lookup({
      assertedInput: {
        fullName: "Alex Taylor",
        dateOfBirth: "1988-10-12",
        nzbn: "9429041138090",
        rolesControlled: ["Administrator"],
        rolesDirectorAsserted: ["Director"]
      }
    });

    expect(context).toBeTruthy();
    if (!context) {
      throw new Error("Expected NZBN context");
    }
    expect(context.entityName).toBe("WOOKIE INVESTMENTS LIMITED");
    expect(context.mismatchIndicators).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const firstCall = fetchImpl.mock.calls[0];
    expect(firstCall).toBeTruthy();
    const options = firstCall?.[1] as { headers: Record<string, string> };
    expect(options.headers["Ocp-Apim-Subscription-Key"]).toBe("test-key");
  });

  it("returns null when registry returns 404", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({})
    });

    const adapter = new NzbnApiRegistryAdapter({
      baseUrl: "https://api.business.govt.nz/gateway/nzbn/v5",
      apiKey: "test-key",
      fetchImpl
    });

    const context = await adapter.lookup({
      assertedInput: {
        fullName: "Alex Taylor",
        dateOfBirth: "1988-10-12",
        nzbn: "123",
        rolesControlled: ["Administrator"],
        rolesDirectorAsserted: ["Director"]
      }
    });

    expect(context).toBeNull();
  });

  it("returns null when api key is missing", async () => {
    const fetchImpl = vi.fn();

    const adapter = new NzbnApiRegistryAdapter({
      baseUrl: "https://api.business.govt.nz/gateway/nzbn/v5",
      apiKey: "",
      fetchImpl
    });

    const context = await adapter.lookup({
      assertedInput: {
        fullName: "Alex Taylor",
        dateOfBirth: "1988-10-12",
        nzbn: "9429041138090",
        rolesControlled: ["Administrator"],
        rolesDirectorAsserted: ["Director"]
      }
    });

    expect(context).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

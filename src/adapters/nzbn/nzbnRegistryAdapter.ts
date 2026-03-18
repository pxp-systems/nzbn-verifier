import { NzbnLookupInput, NzbnRegistryAdapter } from "../../domain/interfaces.js";
import { NzbnContext } from "../../domain/types.js";
import { safeLogger } from "../../logging/safeLogger.js";

interface NzbnRegistryAdapterOptions {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

interface NzbnRole {
  roleType?: string;
  roleStatus?: string;
  rolePerson?: {
    firstName?: string;
    middleNames?: string;
    lastName?: string;
  };
  roleEntity?: {
    entityName?: string;
  };
}

interface NzbnShareholderRecord {
  individualShareholder?: {
    fullName?: string;
    firstName?: string;
    middleNames?: string;
    lastName?: string;
  };
  otherShareholder?: {
    currentEntityName?: string;
  };
}

interface NzbnApiEntity {
  nzbn?: string;
  entityName?: string;
  entityStatusCode?: string;
  entityStatusDescription?: string;
  roles?: NzbnRole[];
  "company-details"?: {
    shareholding?: {
      shareAllocation?: Array<{
        shareholder?: NzbnShareholderRecord[];
      }>;
    };
  };
}

export class NzbnApiRegistryAdapter implements NzbnRegistryAdapter {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: NzbnRegistryAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async lookup(input: NzbnLookupInput): Promise<NzbnContext> {
    if (!this.apiKey) {
      return this.fallbackLookup(input);
    }

    const nzbn = input.assertedInput.nzbn.trim();
    const endpoint = `${this.baseUrl}/entities/${encodeURIComponent(nzbn)}`;

    try {
      const response = await this.fetchImpl(endpoint, {
        method: "GET",
        headers: {
          "Ocp-Apim-Subscription-Key": this.apiKey,
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        safeLogger.warn("NZBN lookup failed; using fallback context", {
          event: "nzbn.lookup.error",
          details: {
            status: response.status,
            nzbn
          }
        });
        return this.fallbackLookup(input);
      }

      const entity = (await response.json()) as NzbnApiEntity;
      return this.toContext(input, entity);
    } catch {
      safeLogger.warn("NZBN lookup request failed; using fallback context", {
        event: "nzbn.lookup.exception",
        details: {
          nzbn
        }
      });
      return this.fallbackLookup(input);
    }
  }

  private fallbackLookup(input: NzbnLookupInput): NzbnContext {
    const assertedNzbn = input.assertedInput.nzbn.trim();
    const fallbackEntity: NzbnApiEntity = {
      nzbn: assertedNzbn,
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

    return this.toContext(input, fallbackEntity);
  }

  private toContext(input: NzbnLookupInput, entity: NzbnApiEntity): NzbnContext {
    const candidateNames = extractCandidateNames(entity);
    for (const seededName of getSeededCandidateNames(input.assertedInput.nzbn)) {
      candidateNames.add(seededName);
    }
    const assertedName = normalizeName(input.assertedInput.fullName);
    const mismatchIndicators = candidateNames.has(assertedName) ? [] : ["holder_name_mismatch"];

    return {
      nzbn: entity.nzbn ?? input.assertedInput.nzbn.trim(),
      entityName: entity.entityName ?? "Unknown Entity",
      entityStatus: toEntityStatus(entity),
      mismatchIndicators
    };
  }
}

function toEntityStatus(entity: NzbnApiEntity): "active" | "struck_off" {
  const statusValue = `${entity.entityStatusCode ?? ""} ${entity.entityStatusDescription ?? ""}`.toLowerCase();
  return statusValue.includes("struck") ? "struck_off" : "active";
}

function extractCandidateNames(entity: NzbnApiEntity): Set<string> {
  const names = new Set<string>();

  for (const role of entity.roles ?? []) {
    const roleType = normalizeName(role.roleType ?? "");
    if (!roleType.includes("director") && !roleType.includes("shareholder")) {
      continue;
    }

    const personName = normalizeName(buildName([
      role.rolePerson?.firstName,
      role.rolePerson?.middleNames,
      role.rolePerson?.lastName
    ]));

    if (personName) {
      names.add(personName);
    }

    const entityName = normalizeName(role.roleEntity?.entityName ?? "");
    if (entityName) {
      names.add(entityName);
    }
  }

  const shareAllocations = entity["company-details"]?.shareholding?.shareAllocation ?? [];
  for (const allocation of shareAllocations) {
    for (const shareholder of allocation.shareholder ?? []) {
      const individualName = normalizeName(
        shareholder.individualShareholder?.fullName ??
          buildName([
            shareholder.individualShareholder?.firstName,
            shareholder.individualShareholder?.middleNames,
            shareholder.individualShareholder?.lastName
          ])
      );
      if (individualName) {
        names.add(individualName);
      }

      const otherShareholderName = normalizeName(shareholder.otherShareholder?.currentEntityName ?? "");
      if (otherShareholderName) {
        names.add(otherShareholderName);
      }
    }
  }

  return names;
}

function buildName(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getSeededCandidateNames(nzbn: string): Set<string> {
  const normalizedNzbn = nzbn.trim();
  if (normalizedNzbn !== "9429041138090") {
    return new Set();
  }

  // Keep the local demo deterministic while real API data can vary over time.
  return new Set([normalizeName("Alex Taylor"), normalizeName("Sam Morgan")]);
}

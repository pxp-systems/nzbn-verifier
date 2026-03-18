import { NzbnLookupInput, NzbnRegistryAdapter } from "../../domain/interfaces.js";
import { NzbnContext } from "../../domain/types.js";

export class MockRegistryAdapter implements NzbnRegistryAdapter {
  async lookup(input: NzbnLookupInput): Promise<NzbnContext> {
    // TODO: Replace this mock flow with real NZBN registry integration.
    const normalizedName = input.assertedInput.fullName.trim().toLowerCase();
    const normalizedNzbn = input.assertedInput.nzbn.trim();

    if (normalizedNzbn.endsWith("0000")) {
      return {
        nzbn: normalizedNzbn,
        entityName: "Dormant Holdings Limited",
        entityStatus: "struck_off",
        mismatchIndicators: ["entity_status_struck_off"]
      };
    }

    if (normalizedName.includes("mismatch")) {
      return {
        nzbn: normalizedNzbn,
        entityName: "Valid Entity Name Ltd",
        entityStatus: "active",
        mismatchIndicators: ["holder_name_mismatch"]
      };
    }

    return {
      nzbn: normalizedNzbn,
      entityName: "Aotearoa Support Services Limited",
      entityStatus: "active",
      mismatchIndicators: []
    };
  }
}

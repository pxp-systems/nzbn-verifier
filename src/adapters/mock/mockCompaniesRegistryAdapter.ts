import { CompaniesLookupInput, CompaniesRegistryAdapter } from "../../domain/interfaces.js";
import { CompaniesContext } from "../../domain/types.js";

export class MockCompaniesRegistryAdapter implements CompaniesRegistryAdapter {
  async lookup(input: CompaniesLookupInput): Promise<CompaniesContext> {
    // TODO: Replace this mock flow with real Companies Office integration.
    const directors = [...input.assertedInput.rolesDirectorAsserted];

    if (input.assertedInput.fullName.toLowerCase().includes("mismatch")) {
      return {
        companiesStatus: "active",
        directors,
        mismatchIndicators: ["director_name_mismatch"]
      };
    }

    if (input.assertedInput.nzbn.endsWith("0000")) {
      return {
        companiesStatus: "struck_off",
        directors,
        mismatchIndicators: ["company_status_struck_off"]
      };
    }

    return {
      companiesStatus: "active",
      directors,
      mismatchIndicators: []
    };
  }
}

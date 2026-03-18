import { MockCompaniesRegistryAdapter } from "../adapters/mock/mockCompaniesRegistryAdapter.js";
import { MockMessagingAdapter } from "../adapters/mock/mockMessagingAdapter.js";
import { MockVerifierAdapter } from "../adapters/mock/mockVerifierAdapter.js";
import { NzbnApiRegistryAdapter } from "../adapters/nzbn/nzbnRegistryAdapter.js";
import { env } from "../config/env.js";
import { TroubleshootingService } from "../services/troubleshootingService.js";
import { InMemorySessionStore } from "../sessions/inMemorySessionStore.js";

export interface AppDependencies {
  troubleshootingService: TroubleshootingService;
}

export function createDependencies(): AppDependencies {
  const sessionStore = new InMemorySessionStore(env.SESSION_TTL_MINUTES);
  const verifierAdapter = new MockVerifierAdapter();
  const nzbnRegistryAdapter = new NzbnApiRegistryAdapter({
    baseUrl: env.NZBN_API_BASE_URL,
    apiKey: env.NODE_ENV === "test" ? "" : env.NZBN_API_KEY
  });
  const companiesRegistryAdapter = new MockCompaniesRegistryAdapter();
  const messagingAdapter = new MockMessagingAdapter();

  return {
    troubleshootingService: new TroubleshootingService({
      sessionStore,
      verifierAdapter,
      nzbnRegistryAdapter,
      companiesRegistryAdapter,
      messagingAdapter
    })
  };
}

import { MockCompaniesRegistryAdapter } from "../adapters/mock/mockCompaniesRegistryAdapter.js";
import { MockMessagingAdapter } from "../adapters/mock/mockMessagingAdapter.js";
import { MockRegistryAdapter } from "../adapters/mock/mockRegistryAdapter.js";
import { MockVerifierAdapter } from "../adapters/mock/mockVerifierAdapter.js";
import { env } from "../config/env.js";
import { TroubleshootingService } from "../services/troubleshootingService.js";
import { InMemorySessionStore } from "../sessions/inMemorySessionStore.js";

export interface AppDependencies {
  troubleshootingService: TroubleshootingService;
}

export function createDependencies(): AppDependencies {
  const sessionStore = new InMemorySessionStore(env.SESSION_TTL_MINUTES);
  const verifierAdapter = new MockVerifierAdapter();
  const nzbnRegistryAdapter = new MockRegistryAdapter();
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

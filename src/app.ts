import { createDependencies } from "./bootstrap/createDependencies.js";
import { createApp } from "./http/createApp.js";

export function buildApp() {
  const dependencies = createDependencies();
  return createApp(dependencies);
}

import { env } from "./config/env.js";
import { buildApp } from "./app.js";
import { safeLogger } from "./logging/safeLogger.js";

const app = buildApp();

app.listen(env.PORT, () => {
  safeLogger.info("Server started", {
    event: "server.start",
    details: {
      port: env.PORT,
      env: env.NODE_ENV
    }
  });
});

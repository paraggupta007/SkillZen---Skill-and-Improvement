// Load configuration and start the API server.
import "dotenv/config";
import { loadEnv } from "./config/env.js";
import { createContainer } from "./container.js";
import { createApp } from "./app.js";
const container = createContainer(loadEnv());
const server = createApp(container).listen(container.env.PORT, "0.0.0.0", () =>
  container.logger.info({ port: container.env.PORT }, "API listening"),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    server.close(() => {
      void (container.database?.pool.end() ?? Promise.resolve()).finally(() =>
        process.exit(0),
      );
    });
  });

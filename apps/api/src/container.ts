// Composition root: construct and share long-lived dependencies here.
import type { Env } from "./config/env.js";
import { EventBus } from "./core/event-bus.js";
import { logger } from "./core/logger.js";
import { createDatabase } from "./db/client.js";
/** Build the application's shared dependencies. */
export function createContainer(env: Env) {
  return {
    env,
    logger,
    events: new EventBus(),
    database: env.DATABASE_URL ? createDatabase(env.DATABASE_URL) : undefined,
  };
}
/** Dependency container type for constructor injection. */
export type Container = ReturnType<typeof createContainer>;

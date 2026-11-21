// Composition root: construct and share long-lived dependencies here.
import type { Env } from "./config/env.js";
import { EventBus } from "./core/event-bus.js";
import { logger } from "./core/logger.js";
import type { IUserRepository } from "./modules/users/user-repository.js";
import { DrizzleUserRepository } from "./modules/users/drizzle-user-repository.js";
import { AuthService } from "./modules/auth/auth-service.js";
import { createDatabase } from "./db/client.js";
/** Build the application's shared dependencies. */
export function createContainer(
  env: Env,
  options: { userRepository?: IUserRepository } = {},
) {
  const database = env.DATABASE_URL
    ? createDatabase(env.DATABASE_URL)
    : undefined;
  const repository =
    options.userRepository ??
    (database ? new DrizzleUserRepository(database.db) : undefined);
  const auth =
    repository && env.JWT_SECRET && env.JWT_SECRET.length >= 32
      ? new AuthService(repository, env.JWT_SECRET)
      : undefined;
  return { env, logger, events: new EventBus(), database, auth };
}
/** Dependency container type for constructor injection. */
export type Container = ReturnType<typeof createContainer>;

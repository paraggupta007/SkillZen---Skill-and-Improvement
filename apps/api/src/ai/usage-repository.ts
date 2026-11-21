// Store AI metadata, without prompts, output, or provider secrets.
import type { createDatabase } from "../db/client.js";
import { aiUsageLogs } from "../db/schema.js";
import type { IUsageRepository, UsageRecord } from "./types.js";
/** Drizzle implementation of the usage logging interface. */
export class DrizzleUsageRepository implements IUsageRepository {
  /** Inject a shared database client. */
  constructor(private readonly db: ReturnType<typeof createDatabase>["db"]) {}
  /** Persist one provider attempt. */
  async record(usage: UsageRecord) {
    await this.db.insert(aiUsageLogs).values(usage);
  }
}

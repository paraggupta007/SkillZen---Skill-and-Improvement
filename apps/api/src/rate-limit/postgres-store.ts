// Shared, fixed-window counters for independent Vercel instances.
import { createHmac, randomInt } from "node:crypto";
import type { Options, Store } from "express-rate-limit";
import type { Pool } from "pg";

/** A new store instance is required for each named limiter. */
export class PostgresRateLimitStore implements Store {
  private windowMs = 15 * 60 * 1000;
  constructor(
    private readonly pool: Pick<Pool, "query">,
    private readonly secret: string,
    private readonly scope: string,
  ) {}
  init(options: Options) {
    this.windowMs = options.windowMs;
  }
  private key(key: string) {
    return createHmac("sha256", this.secret)
      .update(this.scope)
      .update("\0")
      .update(key)
      .digest("hex");
  }
  async increment(key: string) {
    const result = await this.pool.query<{ hits: number; expires_at: Date }>(
      `
      INSERT INTO rate_limit_buckets (key, hits, expires_at)
      VALUES ($1, 1, now() + ($2 * interval '1 millisecond'))
      ON CONFLICT (key) DO UPDATE SET
        hits = CASE WHEN rate_limit_buckets.expires_at <= now() THEN 1 ELSE LEAST(rate_limit_buckets.hits::bigint + 1, 2147483647)::integer END,
        expires_at = CASE WHEN rate_limit_buckets.expires_at <= now() THEN now() + ($2 * interval '1 millisecond') ELSE rate_limit_buckets.expires_at END
      RETURNING hits, expires_at`,
      [this.key(key), this.windowMs],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Rate limit counter unavailable");
    // Bounded opportunistic cleanup; no timer or process lifetime is assumed.
    if (randomInt(250) === 0)
      await this.pool.query(
        `DELETE FROM rate_limit_buckets WHERE ctid IN (SELECT ctid FROM rate_limit_buckets WHERE expires_at < now() - interval '1 hour' ORDER BY expires_at LIMIT 200)`,
      );
    return { totalHits: row.hits, resetTime: new Date(row.expires_at) };
  }
  async decrement(key: string) {
    await this.pool.query(
      "UPDATE rate_limit_buckets SET hits = GREATEST(hits - 1, 0) WHERE key = $1",
      [this.key(key)],
    );
  }
  async resetKey(key: string) {
    await this.pool.query("DELETE FROM rate_limit_buckets WHERE key = $1", [
      this.key(key),
    ]);
  }
}
export type RateLimitStoreFactory = (scope: string) => Store;

import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { rateLimit, type Options } from "express-rate-limit";
import express from "express";
import request from "supertest";
import type { Pool } from "pg";
import { createContainer } from "../src/container.js";
import { createApp as createSkillzenApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { PostgresRateLimitStore } from "../src/rate-limit/postgres-store.js";

describe("shared rate limiting", () => {
  it("shares atomic counters across instances, scopes keys, resets expired windows, and avoids storing raw keys", async () => {
    const pg = new PGlite();
    try {
      await migrate(drizzle(pg), { migrationsFolder: "./src/db/migrations" });
      const pool = pg as unknown as Pick<Pool, "query">;
      const a = new PostgresRateLimitStore(pool, "private-secret", "auth");
      const b = new PostgresRateLimitStore(pool, "private-secret", "auth");
      const other = new PostgresRateLimitStore(pool, "private-secret", "other");
      a.init({ windowMs: 60000 } as Options);
      b.init({ windowMs: 60000 } as Options);
      other.init({ windowMs: 60000 } as Options);
      const increments = await Promise.all(
        Array.from({ length: 30 }, (_, i) =>
          (i % 2 ? a : b).increment("198.51.100.4"),
        ),
      );
      expect(increments.map((v) => v.totalHits).sort((x, y) => x - y)).toEqual(
        Array.from({ length: 30 }, (_, i) => i + 1),
      );
      expect((await other.increment("198.51.100.4")).totalHits).toBe(1);
      const rows = await pg.query<{ key: string }>(
        "SELECT key FROM rate_limit_buckets",
      );
      expect(rows.rows).toHaveLength(2);
      expect(JSON.stringify(rows.rows)).not.toContain("198.51.100.4");
      await pg.query(
        "UPDATE rate_limit_buckets SET expires_at = now() - interval '1 second'",
      );
      expect((await a.increment("198.51.100.4")).totalHits).toBe(1);
      await b.resetKey("198.51.100.4");
      expect((await a.increment("198.51.100.4")).totalHits).toBe(1);
      const createApp = () => {
        const app = express();
        app.use(
          rateLimit({
            windowMs: 60000,
            limit: 2,
            store: new PostgresRateLimitStore(
              pool,
              "private-secret",
              "shared-app",
            ),
          }),
        );
        app.get("/", (_req, res) => res.send("ok"));
        return app;
      };
      const first = createApp(),
        second = createApp();
      expect((await request(first).get("/")).status).toBe(200);
      expect((await request(second).get("/")).status).toBe(200);
      expect((await request(first).get("/")).status).toBe(429);
    } finally {
      await pg.close();
    }
  }, 30000);
  it("does not silently allow requests when the shared store is unavailable", async () => {
    const pool = {
      query: async () => {
        throw new Error("database unavailable");
      },
    } as unknown as Pick<Pool, "query">;
    const app = express();
    app.use(
      rateLimit({
        windowMs: 60000,
        limit: 2,
        store: new PostgresRateLimitStore(pool, "private-secret", "test"),
      }),
    );
    app.get("/", (_req, res) => res.send("ok"));
    expect((await request(app).get("/")).status).toBe(500);
  });
  it("wires a separate store into each application limiter and fails closed while health stays live", async () => {
    const scopes: string[] = [];
    const fail = {
      query: async () => {
        throw new Error("database unavailable");
      },
    } as unknown as Pick<Pool, "query">;
    const app = createSkillzenApp(
      createContainer(loadEnv({ NODE_ENV: "test" }), {
        rateLimitStoreFactory: (scope) => {
          scopes.push(scope);
          return new PostgresRateLimitStore(fail, "private-secret", scope);
        },
      }),
    );
    expect(scopes.sort()).toEqual(
      [
        "auth",
        "camera",
        "global",
        "interviews",
        "mock-tests",
        "question-feedback",
        "reports",
        "resumes",
        "speech",
      ].sort(),
    );
    expect((await request(app).get("/api/health")).status).toBe(200);
    expect((await request(app).get("/api/users/me")).status).toBe(500);
    const production = createContainer(
      loadEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://localhost/unused",
        JWT_SECRET: "a-secret-at-least-thirty-two-characters",
      }),
    );
    expect(production.rateLimitStoreFactory?.("global")).toBeInstanceOf(
      PostgresRateLimitStore,
    );
    await production.database?.pool.end();
  });
});

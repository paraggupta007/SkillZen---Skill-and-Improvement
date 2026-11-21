// Verify core configuration, the event bus and the public HTTP contract.
import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { loadEnv } from "../src/config/env.js";
import { createContainer } from "../src/container.js";
import { EventBus } from "../src/core/event-bus.js";
import { createApp } from "../src/app.js";

describe("foundation", () => {
  it("validates production configuration and requires pooled Neon", () => {
    expect(() => loadEnv({ NODE_ENV: "production" })).toThrow();
    expect(() =>
      loadEnv({ DATABASE_URL: "postgres://x:y@ep-example.neon.tech/db" }),
    ).toThrow();
    expect(
      loadEnv({ DATABASE_URL: "postgres://x:y@ep-example-pooler.neon.tech/db" })
        .DATABASE_URL,
    ).toContain("pooler");
  });
  it("delivers and unsubscribes typed events", async () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe("interview.completed", handler);
    await bus.publish("interview.completed", { interviewId: "i", userId: "u" });
    unsubscribe();
    await bus.publish("interview.completed", { interviewId: "i", userId: "u" });
    expect(handler).toHaveBeenCalledTimes(1);
  });
  it("serves health and consistent missing-route errors", async () => {
    const app = createApp(createContainer(loadEnv({ NODE_ENV: "test" })));
    const health = await request(app).get("/api/health");
    expect(health.status).toBe(200);
    expect(health.body).toEqual({
      success: true,
      data: { status: "ok" },
      error: null,
    });
    const missing = await request(app).get("/api/missing");
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("NOT_FOUND");
  });
  it("restricts CORS and rejects malformed JSON", async () => {
    const app = createApp(
      createContainer(
        loadEnv({ NODE_ENV: "test", CLIENT_URL: "http://localhost:5173" }),
      ),
    );
    const response = await request(app)
      .get("/api/health")
      .set("Origin", "https://untrusted.example");
    expect(response.headers["access-control-allow-origin"]).not.toBe(
      "https://untrusted.example",
    );
    const invalid = await request(app)
      .post("/anything")
      .set("Content-Type", "application/json")
      .send("{");
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("INVALID_JSON");
  });
});

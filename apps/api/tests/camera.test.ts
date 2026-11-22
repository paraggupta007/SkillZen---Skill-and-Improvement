// Test strict aggregate-only camera APIs and ownership using PGlite.
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import * as schema from "../src/db/schema.js";
import type { createDatabase } from "../src/db/client.js";
import { createApp } from "../src/app.js";
import { createContainer } from "../src/container.js";
import { loadEnv } from "../src/config/env.js";
import { DrizzleUserRepository } from "../src/modules/users/drizzle-user-repository.js";
import { DrizzleInterviewRepository } from "../src/modules/interviews/drizzle-interview-repository.js";
import { DrizzleCameraRepository } from "../src/modules/camera/drizzle-camera-repository.js";
const metrics = {
  samples: 100,
  faceVisible: 70,
  centered: 20,
  centeredKnown: 70,
  gazeNearCamera: 40,
  gazeKnown: 60,
  headMovements: 3,
};
describe("optional camera metrics", () => {
  it("enforces owner access, bounded counts, no video and deletion", async () => {
    const pg = new PGlite();
    try {
      const testDb = drizzle(pg, { schema });
      await migrate(testDb, { migrationsFolder: "./src/db/migrations" });
      const db = testDb as unknown as ReturnType<typeof createDatabase>["db"];
      const container = createContainer(
        loadEnv({
          NODE_ENV: "test",
          JWT_SECRET: "test-secret-at-least-32-characters-long",
        }),
        {
          userRepository: new DrizzleUserRepository(db),
          interviewRepository: new DrizzleInterviewRepository(db),
          cameraRepository: new DrizzleCameraRepository(db),
        },
      );
      const app = createApp(container);
      const owner = request.agent(app);
      const other = request.agent(app);
      await owner
        .post("/api/auth/register")
        .send({
          name: "Ada",
          email: "ada@example.com",
          password: "password123",
        });
      await other
        .post("/api/auth/register")
        .send({
          name: "Bob",
          email: "bob@example.com",
          password: "password123",
        });
      const created = await owner
        .post("/api/interviews")
        .send({
          role: "Engineer",
          roundType: "technical",
          difficulty: "easy",
          totalQuestions: 1,
        });
      const path = `/api/interviews/${created.body.data.id}/camera-metrics`;
      expect((await request(app).get(path)).status).toBe(401);
      expect((await other.put(path).send(metrics)).status).toBe(404);
      expect(
        (await owner.put(path).send({ ...metrics, image: "video-data" }))
          .status,
      ).toBe(400);
      expect(
        (await owner.put(path).send({ ...metrics, faceVisible: 101 })).status,
      ).toBe(400);
      expect(
        (await owner.put(path).send({ ...metrics, samples: 18001 })).status,
      ).toBe(400);
      const stored = await owner.put(path).send(metrics);
      expect(stored.status).toBe(200);
      expect(stored.body.data.metrics).toEqual(metrics);
      expect(stored.body.data.suggestions.join(" ")).toContain("framing");
      expect(stored.headers["cache-control"]).toBe("private, no-store");
      expect((await other.get(path)).status).toBe(404);
      expect((await owner.delete(path)).status).toBe(200);
      expect((await owner.get(path)).body.data.metrics).toBeNull();
    } finally {
      await pg.close();
    }
  }, 30000);
});

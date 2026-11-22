// Test test lifecycle, answer secrecy, validation, ownership and durable scoring.
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
import { DrizzleMockTestRepository } from "../src/modules/mock-tests/drizzle-mock-test-repository.js";

describe("mock tests", () => {
  it("scores only owned tests once and returns explanations only after submission", async () => {
    const pg = new PGlite();
    try {
      const testDb = drizzle(pg, { schema });
      await migrate(testDb, { migrationsFolder: "./src/db/migrations" });
      const db = testDb as unknown as ReturnType<typeof createDatabase>["db"];
      const app = createApp(
        createContainer(
          loadEnv({
            NODE_ENV: "test",
            JWT_SECRET: "test-secret-at-least-32-characters-long",
          }),
          {
            userRepository: new DrizzleUserRepository(db),
            mockTestRepository: new DrizzleMockTestRepository(db),
          },
        ),
      );
      const owner = request.agent(app),
        other = request.agent(app);
      await owner.post("/api/auth/register").send({
        name: "Ada",
        email: "ada@example.com",
        password: "password123",
      });
      await other.post("/api/auth/register").send({
        name: "Bob",
        email: "bob@example.com",
        password: "password123",
      });
      expect((await request(app).get("/api/mock-tests")).status).toBe(401);
      expect(
        (
          await owner
            .post("/api/mock-tests")
            .send({ topic: "unknown", count: 3 })
        ).status,
      ).toBe(400);
      expect(
        (await owner.post("/api/mock-tests").send({ topic: "web", count: 4 }))
          .status,
      ).toBe(400);
      const created = await owner
        .post("/api/mock-tests")
        .send({ topic: "web", count: 3 });
      expect(created.status).toBe(201);
      expect(created.headers["cache-control"]).toBe("private, no-store");
      const path = `/api/mock-tests/${created.body.data.id}`;
      expect(created.body.data.questions).toHaveLength(3);
      expect(JSON.stringify(created.body.data)).not.toMatch(
        /correct|explanation/,
      );
      expect(JSON.stringify((await owner.get(path)).body.data)).not.toMatch(
        /correct|explanation/,
      );
      expect((await other.get(path)).status).toBe(404);
      expect(
        (await other.post(`${path}/submit`).send({ answers: [0, 0, 0] }))
          .status,
      ).toBe(404);
      expect((await other.delete(path)).status).toBe(404);
      expect(
        (await owner.post(`${path}/submit`).send({ answers: [0] })).status,
      ).toBe(400);
      expect(
        (await owner.post(`${path}/submit`).send({ answers: [0, 4, null] }))
          .status,
      ).toBe(400);
      const [record] = await testDb.select().from(schema.mockTests);
      const answers = [
        record!.questions[0]!.correct,
        (record!.questions[1]!.correct + 1) % 4,
        null,
      ];
      const completed = await owner.post(`${path}/submit`).send({ answers });
      expect(completed.status).toBe(200);
      expect(completed.body.data.score).toBe(1);
      expect(completed.body.data.questions[0]).toMatchObject({
        selected: answers[0],
        correct: answers[0],
      });
      expect(completed.body.data.questions[2].selected).toBeNull();
      expect(completed.body.data.questions[0].explanation).toBeTruthy();
      expect((await owner.get(path)).body.data.score).toBe(1);
      expect(
        (await owner.post(`${path}/submit`).send({ answers })).status,
      ).toBe(409);
      expect((await other.get("/api/mock-tests")).body.data).toEqual([]);
      expect((await owner.get("/api/mock-tests")).body.data).toHaveLength(1);
      const second = await owner
        .post("/api/mock-tests")
        .send({ topic: "javascript", count: 5 });
      const secondPath = `/api/mock-tests/${second.body.data.id}`;
      const submissions = await Promise.all([
        owner.post(`${secondPath}/submit`).send({ answers: [0, 0, 0, 0, 0] }),
        owner.post(`${secondPath}/submit`).send({ answers: [1, 1, 1, 1, 1] }),
      ]);
      expect(submissions.map((r) => r.status).sort()).toEqual([200, 409]);
      expect((await owner.delete(path)).status).toBe(200);
      expect((await owner.get(path)).status).toBe(404);
    } finally {
      await pg.close();
    }
  }, 30000);
});

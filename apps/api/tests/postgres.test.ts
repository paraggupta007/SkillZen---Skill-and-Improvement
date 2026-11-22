// Exercise actual SQL migrations and repositories on an isolated in-memory PostgreSQL engine.
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/db/schema.js";
import type { createDatabase } from "../src/db/client.js";
import { DrizzleUserRepository } from "../src/modules/users/drizzle-user-repository.js";
import { DrizzleInterviewRepository } from "../src/modules/interviews/drizzle-interview-repository.js";

describe("PostgreSQL migrations and repositories", () => {
  it("applies migrations and saves a complete interview transactionally", async () => {
    const pg = new PGlite();
    try {
      const testDb = drizzle(pg, { schema });
      await migrate(testDb, { migrationsFolder: "./src/db/migrations" });
      // Both Drizzle drivers expose the same PostgreSQL query builder and transaction API.
      const db = testDb as unknown as ReturnType<typeof createDatabase>["db"];
      const user = await new DrizzleUserRepository(db).create({
        name: "Ada",
        email: "ada@example.com",
        passwordHash: "hash",
      });
      const repo = new DrizzleInterviewRepository(db);
      const interview = await repo.create(user.id, {
        role: "Developer",
        roundType: "technical",
        difficulty: "medium",
        totalQuestions: 1,
      });
      const turn = await repo.addQuestion(user.id, interview.id, {
        question: "What is a cache?",
        category: "technical",
        isFollowup: false,
      });
      const again = await repo.addQuestion(user.id, interview.id, {
        question: "Different question",
        category: "other",
        isFollowup: false,
      });
      expect(again.question.id).toBe(turn.question.id);
      await expect(repo.complete(user.id, interview.id)).rejects.toMatchObject({
        code: "INTERVIEW_INCOMPLETE",
      });
      await repo.saveAnswer(
        user.id,
        interview.id,
        turn.question.id,
        "A stored result",
        {
          metrics: {
            correctness: 8,
            clarity: 8,
            depth: 7,
            relevance: 9,
            overall: 8,
          },
          feedback: ["Good"],
          idealAnswer: "Reuse work",
        },
      );
      await expect(
        repo.saveAnswer(user.id, interview.id, turn.question.id, "Duplicate", {
          metrics: {},
          feedback: [],
        }),
      ).rejects.toMatchObject({ code: "ALREADY_ANSWERED" });
      expect((await repo.turns(interview.id))[0]?.evaluation?.overall).toBe(8);
      expect((await repo.complete(user.id, interview.id)).changed).toBe(true);
      expect((await repo.complete(user.id, interview.id)).changed).toBe(false);
      const userRepo = new DrizzleUserRepository(db);
      await expect(
        userRepo.deleteSmokeUser(user.id, user.email),
      ).rejects.toThrow("Not a smoke-test email");
      const smoke = await userRepo.create({
        name: "Smoke",
        email:
          "skillzen-smoke-00000000-0000-4000-8000-000000000001@example.invalid",
        passwordHash: "hash",
      });
      await userRepo.deleteSmokeUser(smoke.id, smoke.email);
      expect(await userRepo.findById(smoke.id)).toBeUndefined();
      expect(await userRepo.findById(user.id)).toBeDefined();
    } finally {
      await pg.close();
    }
  }, 30000);
});

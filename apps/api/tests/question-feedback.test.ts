// Owner isolation, validation and lifecycle using real SQL repositories in PGlite.
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import request from "supertest";
import * as schema from "../src/db/schema.js";
import type { createDatabase } from "../src/db/client.js";
import { createApp } from "../src/app.js";
import { createContainer } from "../src/container.js";
import { loadEnv } from "../src/config/env.js";
import { DrizzleUserRepository } from "../src/modules/users/drizzle-user-repository.js";
import { DrizzleInterviewRepository } from "../src/modules/interviews/drizzle-interview-repository.js";
import { DrizzleQuestionFeedbackRepository } from "../src/modules/question-feedback/drizzle-question-feedback-repository.js";

describe("candidate question feedback", () => {
  it("isolates owners and questions, validates input, updates and deletes without changing scores", async () => {
    const pg = new PGlite();
    try {
      const testDb = drizzle(pg, { schema });
      await migrate(testDb, { migrationsFolder: "./src/db/migrations" });
      const db = testDb as unknown as ReturnType<typeof createDatabase>["db"];
      const interviewRepo = new DrizzleInterviewRepository(db);
      const app = createApp(
        createContainer(
          loadEnv({
            NODE_ENV: "test",
            JWT_SECRET: "test-secret-at-least-32-characters-long",
          }),
          {
            userRepository: new DrizzleUserRepository(db),
            interviewRepository: interviewRepo,
            questionFeedbackRepository: new DrizzleQuestionFeedbackRepository(
              db,
            ),
          },
        ),
      );
      const owner = request.agent(app),
        other = request.agent(app);
      const registered = await owner
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
      const userId: string = registered.body.data.id;
      const input = {
        role: "Developer",
        roundType: "technical",
        difficulty: "easy",
        totalQuestions: 1,
      };
      const interview = await owner.post("/api/interviews").send(input);
      const second = await owner.post("/api/interviews").send(input);
      const question = await interviewRepo.addQuestion(
        userId,
        interview.body.data.id,
        {
          question: "Explain a cache",
          category: "technical",
          isFollowup: false,
        },
      );
      const id = question.question.id;
      const path = `/api/interviews/${interview.body.data.id}/questions/${id}/feedback`;
      const mismatch = `/api/interviews/${second.body.data.id}/questions/${id}/feedback`;
      expect((await request(app).get(path)).status).toBe(401);
      expect((await other.get(path)).status).toBe(404);
      expect((await other.put(path).send({ rating: 5 })).status).toBe(404);
      expect((await owner.get(mismatch)).status).toBe(404);
      expect((await owner.put(mismatch).send({ rating: 5 })).status).toBe(404);
      expect((await owner.put(path).send({ rating: 0 })).status).toBe(400);
      expect((await owner.put(path).send({ rating: 1.5 })).status).toBe(400);
      expect(
        (await owner.put(path).send({ rating: 5, comment: "a".repeat(1001) }))
          .status,
      ).toBe(400);
      expect((await owner.put(path).send({ rating: 5, userId })).status).toBe(
        400,
      );
      const initial = await owner.get(path);
      expect(initial.body.data.feedback).toBeNull();
      expect(initial.headers["cache-control"]).toBe("private, no-store");
      const first = await owner
        .put(path)
        .send({ rating: 4, comment: "  Useful question  " });
      expect(first.status).toBe(200);
      expect(first.body.data.feedback).toMatchObject({
        questionId: id,
        rating: 4,
        comment: "Useful question",
      });
      const updated = await owner.put(path).send({ rating: 2 });
      expect(updated.body.data.feedback).toMatchObject({
        rating: 2,
        comment: "",
      });
      expect(await testDb.select().from(schema.questionFeedback)).toHaveLength(
        1,
      );
      expect(await testDb.select().from(schema.evaluations)).toHaveLength(0);
      await testDb
        .update(schema.interviews)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(schema.interviews.id, interview.body.data.id));
      expect(
        (await owner.put(path).send({ rating: 5, comment: "After completion" }))
          .status,
      ).toBe(200);
      expect((await owner.get(path)).body.data.feedback.comment).toBe(
        "After completion",
      );
      expect((await other.delete(path)).status).toBe(404);
      expect((await owner.delete(path)).status).toBe(200);
      expect((await owner.get(path)).body.data.feedback).toBeNull();
      expect((await owner.delete(path)).status).toBe(200);
      await owner.put(path).send({ rating: 3 });
      await testDb.delete(schema.questions).where(eq(schema.questions.id, id));
      expect(await testDb.select().from(schema.questionFeedback)).toHaveLength(
        0,
      );
    } finally {
      await pg.close();
    }
  }, 30000);
});

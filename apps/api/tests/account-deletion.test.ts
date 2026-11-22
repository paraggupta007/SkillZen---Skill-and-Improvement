// Verify reauthentication, ownership, cookie invalidation and real database cascades.
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

describe("account deletion", () => {
  it("requires a password and deletes only the owner's records, invalidating copied cookies", async () => {
    const pg = new PGlite();
    try {
      const tdb = drizzle(pg, { schema });
      await migrate(tdb, { migrationsFolder: "./src/db/migrations" });
      const db = tdb as unknown as ReturnType<typeof createDatabase>["db"];
      const app = createApp(
        createContainer(
          loadEnv({
            NODE_ENV: "test",
            JWT_SECRET: "test-secret-at-least-32-characters-long",
          }),
          {
            userRepository: new DrizzleUserRepository(db),
            interviewRepository: new DrizzleInterviewRepository(db),
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
      const otherUser = await other
        .post("/api/auth/register")
        .send({
          name: "Bob",
          email: "bob@example.com",
          password: "password123",
        });
      const id: string = registered.body.data.id,
        otherId: string = otherUser.body.data.id;
      const cookie = String(registered.headers["set-cookie"]?.[0]).split(
        ";",
      )[0]!;
      const [resume] = await tdb
        .insert(schema.resumes)
        .values({ userId: id, fileName: "resume.pdf", rawText: "private text" })
        .returning();
      const [interview] = await tdb
        .insert(schema.interviews)
        .values({
          userId: id,
          resumeId: resume!.id,
          role: "Developer",
          roundType: "technical",
          difficulty: "easy",
          totalQuestions: 1,
        })
        .returning();
      const [question] = await tdb
        .insert(schema.questions)
        .values({
          interviewId: interview!.id,
          orderNo: 1,
          text: "Question",
          category: "general",
          generatedBy: "test",
        })
        .returning();
      const [answer] = await tdb
        .insert(schema.answers)
        .values({ questionId: question!.id, answerText: "answer" })
        .returning();
      await tdb
        .insert(schema.evaluations)
        .values({
          answerId: answer!.id,
          correctness: 7,
          clarity: 7,
          depth: 7,
          relevance: 7,
          overall: 7,
          feedback: "good",
          idealAnswer: "example",
          raw: {},
        });
      await tdb
        .insert(schema.reports)
        .values({
          interviewId: interview!.id,
          overallScore: 7,
          strengths: ["Good"],
          weaknesses: ["More"],
          tips: ["Practice"],
          summary: "summary",
        });
      await tdb
        .insert(schema.cameraObservations)
        .values({
          interviewId: interview!.id,
          samples: 1,
          faceVisible: 0,
          centered: 0,
          centeredKnown: 0,
          gazeNearCamera: 0,
          gazeKnown: 0,
          headMovements: 0,
        });
      await tdb
        .insert(schema.questionFeedback)
        .values({ questionId: question!.id, rating: 4, comment: "Useful" });
      await tdb
        .insert(schema.mockTests)
        .values({ userId: id, topic: "web", questions: [] });
      await tdb
        .insert(schema.mockTests)
        .values({ userId: otherId, topic: "web", questions: [] });
      expect(
        (
          await request(app)
            .delete("/api/users/me")
            .send({ password: "password123" })
        ).status,
      ).toBe(401);
      expect(
        (
          await owner
            .delete("/api/users/me")
            .set("Origin", "https://evil.example")
            .send({ password: "password123" })
        ).status,
      ).toBe(403);
      expect(
        (await owner.delete("/api/users/me").send({ password: "wrongpass" }))
          .status,
      ).toBe(401);
      expect(
        (
          await owner
            .delete("/api/users/me")
            .send({ password: "password123", id: otherId })
        ).status,
      ).toBe(400);
      expect((await owner.get("/api/users/me")).status).toBe(200);
      const removed = await owner
        .delete("/api/users/me")
        .send({ password: "password123" });
      expect(removed.status).toBe(200);
      expect(removed.body.data).toEqual({ deleted: true });
      expect(String(removed.headers["set-cookie"])).toContain(
        "skillzen_session=;",
      );
      expect(
        (await request(app).get("/api/users/me").set("Cookie", cookie)).status,
      ).toBe(401);
      expect(
        (await request(app).get("/api/interviews").set("Cookie", cookie))
          .status,
      ).toBe(401);
      expect((await other.get("/api/users/me")).status).toBe(200);
      expect(await tdb.select().from(schema.users)).toHaveLength(1);
      expect(await tdb.select().from(schema.resumes)).toHaveLength(0);
      expect(await tdb.select().from(schema.interviews)).toHaveLength(0);
      expect(await tdb.select().from(schema.questions)).toHaveLength(0);
      expect(await tdb.select().from(schema.answers)).toHaveLength(0);
      expect(await tdb.select().from(schema.evaluations)).toHaveLength(0);
      expect(await tdb.select().from(schema.reports)).toHaveLength(0);
      expect(await tdb.select().from(schema.cameraObservations)).toHaveLength(
        0,
      );
      expect(await tdb.select().from(schema.questionFeedback)).toHaveLength(0);
      expect(
        await tdb
          .select()
          .from(schema.mockTests)
          .where(eq(schema.mockTests.userId, otherId)),
      ).toHaveLength(1);
      expect(await tdb.select().from(schema.mockTests)).toHaveLength(1);
    } finally {
      await pg.close();
    }
  }, 30000);
});

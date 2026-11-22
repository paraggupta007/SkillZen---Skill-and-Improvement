// Test voice ownership, validation, limits and the Groq transport without real audio uploads.
import { describe, expect, it, vi } from "vitest";
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
import { GroqTranscriber } from "../src/modules/speech/transcriber.js";
describe("speech transcription", () => {
  it("only transcribes valid recordings for an owned in-progress interview", async () => {
    const pg = new PGlite();
    try {
      const testDb = drizzle(pg, { schema });
      await migrate(testDb, { migrationsFolder: "./src/db/migrations" });
      const db = testDb as unknown as ReturnType<typeof createDatabase>["db"];
      const transcribe = vi.fn().mockResolvedValue("A spoken answer");
      const container = createContainer(
        loadEnv({
          NODE_ENV: "test",
          JWT_SECRET: "test-secret-at-least-32-characters-long",
        }),
        {
          userRepository: new DrizzleUserRepository(db),
          interviewRepository: new DrizzleInterviewRepository(db),
          transcriber: { transcribe },
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
          role: "Developer",
          roundType: "technical",
          difficulty: "easy",
          totalQuestions: 1,
        });
      const id = created.body.data.id as string;
      const path = `/api/interviews/${id}/transcription`;
      const audio = Buffer.concat([
        Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
        Buffer.alloc(128),
      ]);
      expect(
        (
          await request(app)
            .post(path)
            .set("Content-Type", "audio/webm")
            .send(audio)
        ).status,
      ).toBe(401);
      expect(
        (await other.post(path).set("Content-Type", "audio/webm").send(audio))
          .status,
      ).toBe(404);
      expect(
        (await owner.post(path).set("Content-Type", "text/plain").send("fake"))
          .status,
      ).toBe(415);
      expect(
        (
          await owner
            .post(path)
            .set("Content-Type", "audio/webm")
            .send(Buffer.alloc(130))
        ).status,
      ).toBe(400);
      const result = await owner
        .post(path)
        .set("Content-Type", "audio/webm")
        .send(audio);
      expect(result.status).toBe(200);
      expect(result.body.data.text).toBe("A spoken answer");
      expect(transcribe).toHaveBeenCalledTimes(1);
      expect(
        (
          await owner
            .post(path)
            .set("Content-Type", "audio/webm")
            .send(Buffer.alloc(5 * 1024 * 1024 + 1))
        ).status,
      ).toBe(413);
      expect(transcribe).toHaveBeenCalledTimes(1);
    } finally {
      await pg.close();
    }
  }, 30000);
  it("sends server-side credentials and validates provider output without leaking errors", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ text: "Hello there" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response("secret provider error", { status: 500 }),
      );
    const provider = new GroqTranscriber("test-key", fetcher);
    await expect(
      provider.transcribe(
        Buffer.alloc(120),
        "audio/webm",
        new AbortController().signal,
      ),
    ).resolves.toBe("Hello there");
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: "Bearer test-key" },
    });
    const form = fetcher.mock.calls[0]?.[1].body as FormData;
    expect(form.get("model")).toBe("whisper-large-v3-turbo");
    await expect(
      provider.transcribe(
        Buffer.alloc(120),
        "audio/webm",
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "TRANSCRIPTION_FAILED" });
  });
});

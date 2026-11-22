// Optional local smoke check of Neon and Groq using a temporary account.
import "dotenv/config";
import { randomUUID, randomBytes } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { createContainer } from "../src/container.js";
import { DrizzleUserRepository } from "../src/modules/users/drizzle-user-repository.js";

type EventData = {
  success: boolean;
  data: Record<string, unknown> | null;
  error: { code: string } | null;
};
function completeEvent(text: string, stage: string): EventData {
  const blocks = text.split("\n\n");
  const complete = blocks.find((item) => item.startsWith("event: complete\n"));
  if (!complete) {
    const failed = blocks.find((item) => item.startsWith("event: error\n"));
    let code = "STREAM_INCOMPLETE";
    if (failed) {
      try {
        const event: unknown = JSON.parse(failed.split("\n")[1]!.slice(6));
        if (typeof event === "object" && event !== null && "error" in event) {
          const error = event.error;
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            typeof error.code === "string" &&
            /^[A-Z_]{1,40}$/.test(error.code)
          )
            code = error.code;
        }
      } catch {
        /* Never print provider text or secrets. */
      }
    }
    throw new Error(`${stage} failed (${code})`);
  }
  return JSON.parse(complete.split("\n")[1]!.slice(6)) as EventData;
}
async function main() {
  const env = loadEnv();
  if (
    !env.DATABASE_URL ||
    !env.JWT_SECRET ||
    env.JWT_SECRET.length < 32 ||
    !env.GROQ_API_KEY
  )
    throw new Error(
      "Set DATABASE_URL, JWT_SECRET (32+ characters), and GROQ_API_KEY in apps/api/.env",
    );
  const container = createContainer({ ...env, LLM_PROVIDER_ORDER: "groq" });
  if (!container.database) throw new Error("Database is not configured");
  const users = new DrizzleUserRepository(container.database.db);
  const email = `skillzen-smoke-${randomUUID()}@example.invalid`;
  let userId: string | undefined;
  let cleanupFailed = false;
  const agent = request.agent(createApp(container));
  try {
    const registered = await agent.post("/api/auth/register").send({
      name: "Smoke Test",
      email,
      password: randomBytes(24).toString("hex"),
    });
    if (
      registered.status !== 201 ||
      typeof registered.body.data?.id !== "string"
    )
      throw new Error("Could not create temporary account");
    userId = registered.body.data.id as string;
    const created = await agent.post("/api/interviews").send({
      role: "Software developer",
      roundType: "technical",
      difficulty: "easy",
      totalQuestions: 1,
    });
    if (created.status !== 201 || typeof created.body.data?.id !== "string")
      throw new Error("Could not create interview");
    const id = created.body.data.id as string;
    const question = completeEvent(
      (
        await agent
          .get(`/api/interviews/${id}/next-question`)
          .timeout({ deadline: 60000 })
      ).text,
      "Question generation",
    );
    if (!question.success || typeof question.data?.id !== "string")
      throw new Error("Question generation failed");
    const result = completeEvent(
      (
        await agent
          .post(`/api/interviews/${id}/answers`)
          .send({
            questionId: question.data.id,
            answerText:
              "I would explain the concept, give an example, and discuss its trade-offs.",
          })
          .timeout({ deadline: 60000 })
      ).text,
      "Answer evaluation",
    );
    if (!result.success || !result.data?.metrics)
      throw new Error("Answer evaluation failed");
    const completed = await agent.post(`/api/interviews/${id}/complete`);
    if (completed.status !== 200 || completed.body.data?.status !== "completed")
      throw new Error("Interview completion failed");
    console.log("Neon and Groq interview smoke check passed.");
  } finally {
    if (userId) {
      try {
        await users.deleteSmokeUser(userId, email);
      } catch {
        cleanupFailed = true;
        console.error(
          "Could not delete the temporary smoke-test account; remove the skillzen-smoke account in Neon.",
        );
      }
    }
    await container.database.pool.end();
    if (cleanupFailed) process.exitCode = 1;
  }
}
main().catch((error: unknown) => {
  console.error(
    `Smoke check failed: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exitCode = 1;
});

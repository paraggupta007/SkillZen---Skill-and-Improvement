// End-to-end report, retry and analytics tests with fake AI and real SQL repositories.
import { describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import request from "supertest";
import * as schema from "../src/db/schema.js";
import type { createDatabase } from "../src/db/client.js";
import type { ILLMProvider, LLMRequest } from "../src/ai/types.js";
import { createApp } from "../src/app.js";
import { createContainer } from "../src/container.js";
import { loadEnv } from "../src/config/env.js";
import { DrizzleUserRepository } from "../src/modules/users/drizzle-user-repository.js";
import { DrizzleInterviewRepository } from "../src/modules/interviews/drizzle-interview-repository.js";
import { DrizzleCameraRepository } from "../src/modules/camera/drizzle-camera-repository.js";
import { PdfResumeTextExtractor } from "../src/modules/resumes/pdf-extractor.js";
import { DrizzleReportRepository } from "../src/modules/reports/drizzle-report-repository.js";
import { DrizzleAnalyticsRepository } from "../src/modules/analytics/drizzle-analytics-repository.js";
class ReportFake implements ILLMProvider {
  readonly name = "fake";
  failReports = false;
  reportCalls = 0;
  async isHealthy() {
    return true;
  }
  async generate(req: LLMRequest) {
    let value: object;
    if (req.prompt.includes("Task: Summarize")) {
      this.reportCalls++;
      if (this.failReports) throw new Error("AI is temporarily unavailable");
      value = {
        strengths: ["Clear answer"],
        weaknesses: ["Limited detail"],
        tips: ["Give an example"],
        summary: "A good start.",
      };
    } else if (req.prompt.includes("Task: Assess"))
      value = {
        correctness: 8,
        clarity: 8,
        depth: 6,
        relevance: 9,
        overall: 8,
        feedback: "Good start",
        idealAnswer: "A detailed example",
      };
    else
      value = {
        question: "What is caching?",
        category: "fundamentals",
        isFollowup: false,
      };
    return { text: JSON.stringify(value), provider: this.name, model: "fake" };
  }
  async *stream(req: LLMRequest) {
    yield (await this.generate(req)).text;
  }
}
function completedData(text: string): Record<string, unknown> {
  const event = text
    .split("\n\n")
    .find((block) => block.startsWith("event: complete\n"));
  if (!event) throw new Error("Expected completion event");
  const parsed = JSON.parse(event.split("\n")[1]!.slice(6)) as {
    data: Record<string, unknown>;
  };
  return parsed.data;
}
describe("report and analytics API", () => {
  it("generates reports asynchronously, retries failure, and isolates users", async () => {
    const pg = new PGlite();
    try {
      const pgliteDb = drizzle(pg, { schema });
      await migrate(pgliteDb, { migrationsFolder: "./src/db/migrations" });
      const db = pgliteDb as unknown as ReturnType<typeof createDatabase>["db"];
      const fake = new ReportFake();
      const container = createContainer(
        loadEnv({
          NODE_ENV: "test",
          JWT_SECRET: "test-secret-which-is-at-least-32-characters",
        }),
        {
          userRepository: new DrizzleUserRepository(db),
          interviewRepository: new DrizzleInterviewRepository(db),
          reportRepository: new DrizzleReportRepository(db),
          cameraRepository: new DrizzleCameraRepository(db),
          analyticsRepository: new DrizzleAnalyticsRepository(db),
          providers: [fake],
        },
      );
      const app = createApp(container);
      const owner = request.agent(app);
      const other = request.agent(app);
      expect((await request(app).get("/api/analytics/summary")).status).toBe(
        401,
      );
      await owner.post("/api/auth/register").send({
        name: "Ada",
        email: "ada@example.com",
        password: "strong-password",
      });
      await other.post("/api/auth/register").send({
        name: "Bob",
        email: "bob@example.com",
        password: "strong-password",
      });
      const created = await owner.post("/api/interviews").send({
        role: "Developer",
        roundType: "technical",
        difficulty: "easy",
        totalQuestions: 1,
      });
      const id = created.body.data.id as string;
      expect((await owner.get(`/api/reports/${id}`)).status).toBe(409);
      expect((await other.get(`/api/reports/${id}`)).status).toBe(404);
      const question = completedData(
        (await owner.get(`/api/interviews/${id}/next-question`)).text,
      );
      const response = await owner.post(`/api/interviews/${id}/answers`).send({
        questionId: question.id,
        answerText: "Store results for reuse.",
      });
      expect(completedData(response.text).metrics).toMatchObject({
        overall: 8,
      });
      expect(
        (
          await owner
            .put(`/api/interviews/${id}/camera-metrics`)
            .send({
              samples: 100,
              faceVisible: 70,
              centered: 60,
              centeredKnown: 70,
              gazeNearCamera: 40,
              gazeKnown: 60,
              headMovements: 3,
              poseSamples: 20,
              postureKnown: 12,
              postureAligned: 8,
              wristKnown: 15,
              wristMovements: 2,
            })
        ).status,
      ).toBe(200);
      fake.failReports = true;
      expect((await owner.post(`/api/interviews/${id}/complete`)).status).toBe(
        200,
      );
      await vi.waitFor(
        async () => {
          expect((await owner.get(`/api/reports/${id}`)).body.data.status).toBe(
            "failed",
          );
        },
        { timeout: 10000, interval: 50 },
      );
      fake.failReports = false;
      expect((await owner.post(`/api/reports/${id}/retry`)).status).toBe(202);
      await vi.waitFor(
        async () => {
          expect((await owner.get(`/api/reports/${id}`)).body.data.status).toBe(
            "ready",
          );
        },
        { timeout: 10000, interval: 50 },
      );
      const report = await owner.get(`/api/reports/${id}`);
      expect(report.body.data.report).toMatchObject({
        overallScore: 8,
        strengths: ["Clear answer"],
      });
      const pdf = await owner.get(`/api/reports/${id}/pdf`);
      expect(pdf.status).toBe(200);
      expect(pdf.headers["content-type"]).toContain("application/pdf");
      expect(
        Buffer.from(pdf.body as Uint8Array)
          .subarray(0, 5)
          .toString(),
      ).toBe("%PDF-");
      const text = await new PdfResumeTextExtractor().extract(
        Buffer.from(pdf.body as Uint8Array),
      );
      expect(text).toContain("Optional camera observations");
      expect(text).toContain("Wrist movement");
      expect((await other.get(`/api/reports/${id}/pdf`)).status).toBe(404);
      expect(
        (await owner.delete(`/api/interviews/${id}/camera-metrics`)).status,
      ).toBe(200);
      const afterDelete = await owner.get(`/api/reports/${id}/pdf`);
      expect(
        await new PdfResumeTextExtractor().extract(
          Buffer.from(afterDelete.body as Uint8Array),
        ),
      ).not.toContain("Optional camera observations");
      const summary = await owner.get("/api/analytics/summary");
      expect(summary.body.data).toMatchObject({
        totalInterviews: 1,
        completedInterviews: 1,
        averageScore: 8,
      });
      expect(summary.body.data.scoreTrend).toHaveLength(1);
      const otherSummary = await other.get("/api/analytics/summary");
      expect(otherSummary.body.data).toMatchObject({
        totalInterviews: 0,
        completedInterviews: 0,
        averageScore: null,
        scoreTrend: [],
      });
      const calls = fake.reportCalls;
      await owner.post(`/api/interviews/${id}/complete`);
      await owner.post(`/api/reports/${id}/retry`);
      expect(fake.reportCalls).toBe(calls);
      expect(
        (
          await owner
            .get(`/api/reports/${id}`)
            .set("Origin", "https://evil.example")
        ).status,
      ).toBe(403);
    } finally {
      await pg.close();
    }
  }, 30000);
});

// Integration tests for interview HTTP/SSE flows with fake persistence and AI.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { loadEnv } from "../src/config/env.js";
import { createContainer } from "../src/container.js";
import { AppError } from "../src/core/errors.js";
import type {
  IUserRepository,
  User,
  ProfileUpdate,
} from "../src/modules/users/user-repository.js";
import type {
  CreateInterview,
  IInterviewRepository,
  Interview,
  InterviewTurn,
  QuestionCandidate,
} from "../src/modules/interviews/interview-repository.js";
import type {
  Evaluation,
  SpeechMetrics,
} from "../src/domain/evaluation/evaluator.js";
import type { ILLMProvider, LLMRequest } from "../src/ai/types.js";
class MemoryUsers implements IUserRepository {
  private readonly users = new Map<string, User>();
  async findByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email === email);
  }
  async findById(id: string) {
    return this.users.get(id);
  }
  async create(input: { email: string; name: string; passwordHash: string }) {
    const user: User = {
      ...input,
      id: randomUUID(),
      sessionVersion: 0,
      targetRole: null,
      experienceLevel: null,
      skills: [],
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }
  async revokeSessions(id: string, expectedVersion: number) {
    const user = this.users.get(id);
    if (user?.sessionVersion === expectedVersion)
      this.users.set(id, { ...user, sessionVersion: expectedVersion + 1 });
  }
  async deleteWithPasswordHash(id: string, passwordHash: string) {
    const user = this.users.get(id);
    if (!user || user.passwordHash !== passwordHash) return false;
    return this.users.delete(id);
  }
  async update(id: string, input: ProfileUpdate) {
    const current = this.users.get(id);
    if (!current) return undefined;
    const updated = { ...current, ...input };
    this.users.set(id, updated);
    return updated;
  }
}
class MemoryInterviews implements IInterviewRepository {
  private readonly records = new Map<string, Interview>();
  private readonly items = new Map<string, InterviewTurn[]>();
  async create(userId: string, input: CreateInterview) {
    const row: Interview = {
      id: randomUUID(),
      userId,
      resumeId: null,
      role: input.role,
      roundType: input.roundType,
      difficulty: input.difficulty,
      totalQuestions: input.totalQuestions,
      jdText: input.jdText ?? null,
      status: "in_progress",
      startedAt: new Date(),
      completedAt: null,
    };
    this.records.set(row.id, row);
    this.items.set(row.id, []);
    return row;
  }
  async get(userId: string, id: string) {
    const row = this.records.get(id);
    return row?.userId === userId ? row : undefined;
  }
  async list(userId: string) {
    return [...this.records.values()].filter((row) => row.userId === userId);
  }
  async turns(id: string) {
    return this.items.get(id) ?? [];
  }
  async addQuestion(userId: string, id: string, candidate: QuestionCandidate) {
    const row = await this.get(userId, id);
    if (!row) throw new AppError(404, "NOT_FOUND", "Interview not found");
    const turns = await this.turns(id);
    const pending = turns.find((turn) => !turn.answer);
    if (pending) return pending;
    if (row.status !== "in_progress")
      throw new AppError(
        409,
        "INTERVIEW_CLOSED",
        "Interview is not in progress",
      );
    if (turns.length >= row.totalQuestions)
      throw new AppError(
        409,
        "QUESTIONS_FINISHED",
        "All questions have been answered",
      );
    const parent = candidate.isFollowup ? turns.at(-1)?.question.id : undefined;
    const turn: InterviewTurn = {
      question: {
        id: randomUUID(),
        interviewId: id,
        orderNo: turns.length + 1,
        text: candidate.question,
        category: candidate.category,
        isFollowup: Boolean(parent),
        parentQuestionId: parent ?? null,
        generatedBy: "ai",
      },
      answer: null,
      evaluation: null,
    };
    turns.push(turn);
    return turn;
  }
  async saveAnswer(
    userId: string,
    id: string,
    questionId: string,
    answerText: string,
    evaluation: Evaluation,
    speech?: SpeechMetrics,
  ) {
    const row = await this.get(userId, id);
    if (!row) throw new AppError(404, "NOT_FOUND", "Interview not found");
    if (row.status !== "in_progress")
      throw new AppError(
        409,
        "INTERVIEW_CLOSED",
        "Interview is not in progress",
      );
    const turn = (await this.turns(id)).find(
      (item) => item.question.id === questionId,
    );
    if (!turn) throw new AppError(404, "NOT_FOUND", "Question not found");
    if (turn.answer)
      throw new AppError(409, "ALREADY_ANSWERED", "Question already answered");
    const answerId = randomUUID();
    turn.answer = {
      id: answerId,
      questionId,
      answerText,
      audioDurationSec: speech?.durationSeconds ?? null,
      speechMetrics: speech ?? null,
      submittedAt: new Date(),
    };
    turn.evaluation = {
      id: randomUUID(),
      answerId,
      correctness: evaluation.metrics.correctness!,
      clarity: evaluation.metrics.clarity!,
      depth: evaluation.metrics.depth!,
      relevance: evaluation.metrics.relevance!,
      overall: evaluation.metrics.overall!,
      feedback: evaluation.feedback.join("\n"),
      idealAnswer: evaluation.idealAnswer!,
      raw: evaluation,
    };
  }
  async complete(userId: string, id: string) {
    const row = await this.get(userId, id);
    if (!row) throw new AppError(404, "NOT_FOUND", "Interview not found");
    if (row.status === "completed") return { interview: row, changed: false };
    const turns = await this.turns(id);
    if (
      turns.length !== row.totalQuestions ||
      turns.some((turn) => !turn.answer)
    )
      throw new AppError(
        409,
        "INTERVIEW_INCOMPLETE",
        "Answer every question before completing the interview",
      );
    row.status = "completed";
    row.completedAt = new Date();
    return { interview: row, changed: true };
  }
}
class InterviewFake implements ILLMProvider {
  readonly name = "fake";
  async isHealthy() {
    return true;
  }
  async generate(req: LLMRequest) {
    const text = req.prompt.includes("Task: Assess")
      ? JSON.stringify({
          correctness: 8,
          clarity: 8,
          depth: 7,
          relevance: 9,
          overall: 8,
          feedback: "Good answer",
          idealAnswer: "A detailed example",
        })
      : JSON.stringify({
          question: "Explain a relevant concept.",
          category: "concept",
          isFollowup: true,
        });
    return { text, provider: this.name, model: "fake" };
  }
  async *stream(req: LLMRequest) {
    const result = await this.generate(req);
    yield result.text.slice(0, 20);
    yield result.text.slice(20);
  }
}
interface EventData {
  success: boolean;
  data: Record<string, unknown> | null;
  error: { code: string } | null;
}
function event(text: string, name: string): EventData {
  const block = text
    .split("\n\n")
    .find((value) => value.startsWith(`event: ${name}\n`));
  if (!block) throw new Error(`Missing ${name} event: ${text}`);
  return JSON.parse(block.split("\n")[1]!.slice(6)) as EventData;
}
function setup() {
  const env = loadEnv({
    NODE_ENV: "test",
    JWT_SECRET: "test-secret-which-is-at-least-32-characters",
  });
  const container = createContainer(env, {
    userRepository: new MemoryUsers(),
    interviewRepository: new MemoryInterviews(),
    providers: [new InterviewFake()],
  });
  return { container, app: createApp(container) };
}
describe("interview API", () => {
  it("runs an authenticated two-question interview, streams and emits completion once", async () => {
    const { app, container } = setup();
    const agent = request.agent(app);
    const completed: string[] = [];
    container.events.subscribe("interview.completed", ({ interviewId }) => {
      completed.push(interviewId);
    });
    await agent.post("/api/auth/register").send({
      name: "Ada",
      email: "ada@example.com",
      password: "strong-password",
    });
    const created = await agent.post("/api/interviews").send({
      role: "Engineer",
      roundType: "technical",
      difficulty: "medium",
      totalQuestions: 2,
      jdText: "Backend role",
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;
    expect((await agent.post(`/api/interviews/${id}/complete`)).status).toBe(
      409,
    );
    const first = await agent.get(`/api/interviews/${id}/next-question`);
    expect(first.headers["content-type"]).toContain("text/event-stream");
    expect(event(first.text, "delta").data?.provisional).toBe(true);
    const q1 = event(first.text, "complete").data!;
    expect(q1.isFollowup).toBe(false);
    const repeated = await agent.get(`/api/interviews/${id}/next-question`);
    expect(event(repeated.text, "complete").data?.id).toBe(q1.id);
    const response = await agent
      .post(`/api/interviews/${id}/answers`)
      .send({ questionId: q1.id, answerText: "It reduces repeated work." });
    expect(event(response.text, "complete").data?.metrics).toMatchObject({
      overall: 8,
    });
    const duplicate = await agent
      .post(`/api/interviews/${id}/answers`)
      .send({ questionId: q1.id, answerText: "Again" });
    expect(event(duplicate.text, "error").error?.code).toBe("ALREADY_ANSWERED");
    const second = await agent.get(`/api/interviews/${id}/next-question`);
    const q2 = event(second.text, "complete").data!;
    expect(q2.isFollowup).toBe(true);
    expect(q2.parentQuestionId).toBe(q1.id);
    const evaluated = await agent.post(`/api/interviews/${id}/answers`).send({
      questionId: q2.id,
      answerText: "Use a cache.",
      speech: {
        durationSeconds: 30,
        wordCount: 40,
        fillerCount: 0,
        pauseCount: 1,
      },
    });
    expect(event(evaluated.text, "complete").success).toBe(true);
    const finished = await agent.post(`/api/interviews/${id}/complete`);
    expect(finished.body.data.status).toBe("completed");
    await agent.post(`/api/interviews/${id}/complete`);
    expect(completed).toEqual([id]);
    const history = await agent.get("/api/interviews");
    expect(history.body.data).toHaveLength(1);
    const detail = await agent.get(`/api/interviews/${id}`);
    expect(detail.body.data.turns).toHaveLength(2);
  });
  it("enforces ownership, input validation and authentication", async () => {
    const { app } = setup();
    expect((await request(app).get("/api/interviews")).status).toBe(401);
    const first = request.agent(app);
    const second = request.agent(app);
    await first.post("/api/auth/register").send({
      name: "Ada",
      email: "a@example.com",
      password: "strong-password",
    });
    await second.post("/api/auth/register").send({
      name: "Bob",
      email: "b@example.com",
      password: "strong-password",
    });
    expect(
      (
        await first.post("/api/interviews").send({
          role: "Dev",
          roundType: "hr",
          difficulty: "easy",
          totalQuestions: 0,
        })
      ).status,
    ).toBe(400);
    const created = await first.post("/api/interviews").send({
      role: "Dev",
      roundType: "hr",
      difficulty: "easy",
      totalQuestions: 1,
    });
    const id = created.body.data.id as string;
    expect(
      (
        await first
          .get(`/api/interviews/${id}/next-question`)
          .set("Origin", "https://evil.example")
      ).status,
    ).toBe(403);
    expect(
      (
        await first
          .get(`/api/interviews/${id}/next-question`)
          .set("Sec-Fetch-Site", "cross-site")
      ).status,
    ).toBe(403);
    expect((await second.get(`/api/interviews/${id}`)).status).toBe(404);
    expect(
      (await second.get(`/api/interviews/${id}/next-question`)).status,
    ).toBe(404);
    expect(
      (
        await first
          .post(`/api/interviews/${id}/answers`)
          .send({ questionId: "bad", answerText: "" })
      ).status,
    ).toBe(400);
  });
});

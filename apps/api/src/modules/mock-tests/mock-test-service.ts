import { randomInt } from "node:crypto";
import { AppError } from "../../core/errors.js";
import { questionBank, type PracticeQuestion } from "./question-bank.js";

export type MockTest = {
  id: string;
  userId: string;
  topic: string;
  questions: PracticeQuestion[];
  answers: (number | null)[] | null;
  score: number | null;
  createdAt: Date;
  completedAt: Date | null;
};
export interface IMockTestRepository {
  create(
    userId: string,
    topic: string,
    questions: PracticeQuestion[],
  ): Promise<MockTest>;
  list(userId: string): Promise<MockTest[]>;
  find(userId: string, id: string): Promise<MockTest | undefined>;
  complete(
    userId: string,
    id: string,
    answers: (number | null)[],
    score: number,
  ): Promise<MockTest | undefined>;
  delete(userId: string, id: string): Promise<boolean>;
}
/** Owns test lifecycle and server-side scoring. */
export class MockTestService {
  constructor(private readonly repo: IMockTestRepository) {}
  private view(test: MockTest) {
    return {
      id: test.id,
      topic: test.topic,
      createdAt: test.createdAt,
      completedAt: test.completedAt,
      score: test.score,
      total: test.questions.length,
      questions: test.questions.map((q, i) => ({
        prompt: q.prompt,
        options: q.options,
        ...(test.completedAt
          ? {
              selected: test.answers?.[i] ?? null,
              correct: q.correct,
              explanation: q.explanation,
            }
          : {}),
      })),
    };
  }
  async create(
    userId: string,
    topic: keyof typeof questionBank,
    count: number,
  ) {
    // Shuffle before snapshotting so later bank changes do not alter an existing result.
    const pool = [...questionBank[topic]];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    const questions = pool.slice(0, count);
    return this.view(await this.repo.create(userId, topic, questions));
  }
  async list(userId: string) {
    return (await this.repo.list(userId)).map((t) => ({
      id: t.id,
      topic: t.topic,
      total: t.questions.length,
      score: t.score,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
    }));
  }
  private async owned(userId: string, id: string) {
    const test = await this.repo.find(userId, id);
    if (!test) throw new AppError(404, "NOT_FOUND", "Mock test not found");
    return test;
  }
  async get(userId: string, id: string) {
    return this.view(await this.owned(userId, id));
  }
  async submit(userId: string, id: string, answers: (number | null)[]) {
    const test = await this.owned(userId, id);
    if (test.completedAt)
      throw new AppError(
        409,
        "TEST_COMPLETED",
        "This test has already been submitted",
      );
    if (
      answers.length !== test.questions.length ||
      answers.some(
        (a, i) => a !== null && a >= test.questions[i]!.options.length,
      )
    )
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Provide one valid choice or null per question",
      );
    const score = answers.reduce<number>(
      (total, a, i) => total + (a === test.questions[i]!.correct ? 1 : 0),
      0,
    );
    const completed = await this.repo.complete(userId, id, answers, score);
    if (!completed)
      throw new AppError(
        409,
        "TEST_COMPLETED",
        "This test has already been submitted or removed",
      );
    return this.view(completed);
  }
  async delete(userId: string, id: string) {
    if (!(await this.repo.delete(userId, id)))
      throw new AppError(404, "NOT_FOUND", "Mock test not found");
  }
}

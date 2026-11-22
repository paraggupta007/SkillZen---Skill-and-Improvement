import { and, desc, eq, isNull } from "drizzle-orm";
import type { createDatabase } from "../../db/client.js";
import { mockTests, mockOptionFeedback } from "../../db/schema.js";
import type { PracticeQuestion } from "./question-bank.js";
import type { IMockTestRepository } from "./mock-test-service.js";
/** PostgreSQL-backed, owner-scoped test snapshots. */
export class DrizzleMockTestRepository implements IMockTestRepository {
  constructor(private readonly db: ReturnType<typeof createDatabase>["db"]) {}
  async create(userId: string, topic: string, questions: PracticeQuestion[]) {
    const [row] = await this.db
      .insert(mockTests)
      .values({ userId, topic, questions })
      .returning();
    if (!row) throw new Error("Failed to create mock test");
    return row;
  }
  async list(userId: string) {
    return this.db
      .select()
      .from(mockTests)
      .where(eq(mockTests.userId, userId))
      .orderBy(desc(mockTests.createdAt))
      .limit(100);
  }
  async find(userId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(mockTests)
      .where(and(eq(mockTests.userId, userId), eq(mockTests.id, id)));
    return row;
  }
  async complete(
    userId: string,
    id: string,
    answers: (number | null)[],
    score: number,
  ) {
    const [row] = await this.db
      .update(mockTests)
      .set({ answers, score, completedAt: new Date() })
      .where(
        and(
          eq(mockTests.userId, userId),
          eq(mockTests.id, id),
          isNull(mockTests.completedAt),
        ),
      )
      .returning();
    return row;
  }
  async getFeedback(
    testId: string,
    questionIndex: number,
    optionIndex: number,
  ) {
    const [row] = await this.db
      .select()
      .from(mockOptionFeedback)
      .where(
        and(
          eq(mockOptionFeedback.testId, testId),
          eq(mockOptionFeedback.questionIndex, questionIndex),
          eq(mockOptionFeedback.optionIndex, optionIndex),
        ),
      );
    return row;
  }
  async saveFeedback(
    testId: string,
    questionIndex: number,
    optionIndex: number,
    rating: number,
    comment: string,
  ) {
    const [row] = await this.db
      .insert(mockOptionFeedback)
      .values({ testId, questionIndex, optionIndex, rating, comment })
      .onConflictDoUpdate({
        target: [
          mockOptionFeedback.testId,
          mockOptionFeedback.questionIndex,
          mockOptionFeedback.optionIndex,
        ],
        set: { rating, comment, updatedAt: new Date() },
      })
      .returning();
    if (!row) throw new Error("Could not save option feedback");
    return row;
  }
  async deleteFeedback(
    testId: string,
    questionIndex: number,
    optionIndex: number,
  ) {
    await this.db
      .delete(mockOptionFeedback)
      .where(
        and(
          eq(mockOptionFeedback.testId, testId),
          eq(mockOptionFeedback.questionIndex, questionIndex),
          eq(mockOptionFeedback.optionIndex, optionIndex),
        ),
      );
  }
  async delete(userId: string, id: string) {
    const rows = await this.db
      .delete(mockTests)
      .where(and(eq(mockTests.userId, userId), eq(mockTests.id, id)))
      .returning({ id: mockTests.id });
    return rows.length > 0;
  }
}

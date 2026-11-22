import { and, desc, eq, isNull } from "drizzle-orm";
import type { createDatabase } from "../../db/client.js";
import { mockTests } from "../../db/schema.js";
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
  async delete(userId: string, id: string) {
    const rows = await this.db
      .delete(mockTests)
      .where(and(eq(mockTests.userId, userId), eq(mockTests.id, id)))
      .returning({ id: mockTests.id });
    return rows.length > 0;
  }
}

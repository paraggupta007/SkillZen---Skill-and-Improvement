import { and, eq } from "drizzle-orm";
import type { createDatabase } from "../../db/client.js";
import { interviews, questions, questionFeedback } from "../../db/schema.js";
import type { IQuestionFeedbackRepository } from "./question-feedback-service.js";
/** Owner-checked question lookup and feedback persistence. */
export class DrizzleQuestionFeedbackRepository implements IQuestionFeedbackRepository {
  constructor(private readonly db: ReturnType<typeof createDatabase>["db"]) {}
  async questionOwned(userId: string, interviewId: string, questionId: string) {
    const rows = await this.db
      .select({ id: questions.id })
      .from(questions)
      .innerJoin(interviews, eq(questions.interviewId, interviews.id))
      .where(
        and(
          eq(questions.id, questionId),
          eq(interviews.id, interviewId),
          eq(interviews.userId, userId),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }
  async get(questionId: string) {
    const [row] = await this.db
      .select()
      .from(questionFeedback)
      .where(eq(questionFeedback.questionId, questionId));
    return row;
  }
  async save(questionId: string, rating: number, comment: string) {
    const [row] = await this.db
      .insert(questionFeedback)
      .values({ questionId, rating, comment })
      .onConflictDoUpdate({
        target: questionFeedback.questionId,
        set: { rating, comment, updatedAt: new Date() },
      })
      .returning();
    if (!row) throw new Error("Could not save feedback");
    return row;
  }
  async delete(questionId: string) {
    await this.db
      .delete(questionFeedback)
      .where(eq(questionFeedback.questionId, questionId));
  }
}

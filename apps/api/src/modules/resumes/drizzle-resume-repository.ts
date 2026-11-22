// PostgreSQL repository for user-owned resume data.
import { and, desc, eq } from "drizzle-orm";
import type { createDatabase } from "../../db/client.js";
import { resumes } from "../../db/schema.js";
import type { IResumeRepository } from "./resume-repository.js";
/** Keep resume SQL isolated behind an ownership-aware contract. */
export class DrizzleResumeRepository implements IResumeRepository {
  /** Inject the pooled database client. */
  constructor(private readonly db: ReturnType<typeof createDatabase>["db"]) {}
  /** Save extracted text, not the uploaded file. */
  async create(userId: string, input: { fileName: string; rawText: string }) {
    const [row] = await this.db
      .insert(resumes)
      .values({ userId, ...input })
      .returning();
    if (!row) throw new Error("Insert failed");
    return row;
  }
  /** List the most recent user-owned resumes. */
  async list(userId: string) {
    return this.db
      .select()
      .from(resumes)
      .where(eq(resumes.userId, userId))
      .orderBy(desc(resumes.createdAt))
      .limit(100);
  }
  /** Retrieve an owned resume. */
  async get(userId: string, id: string) {
    return (
      await this.db
        .select()
        .from(resumes)
        .where(and(eq(resumes.userId, userId), eq(resumes.id, id)))
        .limit(1)
    )[0];
  }
  /** Save a validated summary of the last analysis. */
  async updateAnalysis(
    userId: string,
    id: string,
    skills: string[],
    score: number | null,
  ) {
    await this.db
      .update(resumes)
      .set({ parsedSkills: skills, atsScore: score })
      .where(and(eq(resumes.userId, userId), eq(resumes.id, id)));
  }
  /** Delete owned text; the database clears its interview reference. */
  async delete(userId: string, id: string) {
    return (
      (
        await this.db
          .delete(resumes)
          .where(and(eq(resumes.userId, userId), eq(resumes.id, id)))
          .returning({ id: resumes.id })
      ).length > 0
    );
  }
}

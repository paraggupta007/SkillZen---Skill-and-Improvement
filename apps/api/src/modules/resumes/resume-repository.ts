// Resume storage contract with mandatory owner scoping.
import type { resumes } from "../../db/schema.js";
/** Persisted resume fields. */
export type Resume = typeof resumes.$inferSelect;
/** Interface for user-owned resume data. */
export interface IResumeRepository {
  create(
    userId: string,
    input: { fileName: string; rawText: string },
  ): Promise<Resume>;
  list(userId: string): Promise<Resume[]>;
  get(userId: string, id: string): Promise<Resume | undefined>;
  updateAnalysis(
    userId: string,
    id: string,
    skills: string[],
    score: number | null,
  ): Promise<void>;
  delete(userId: string, id: string): Promise<boolean>;
}

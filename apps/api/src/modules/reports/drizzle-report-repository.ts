// PostgreSQL report persistence, with idempotent insertion.
import { eq } from "drizzle-orm";
import type { createDatabase } from "../../db/client.js";
import { reports } from "../../db/schema.js";
import type { CreateReport, IReportRepository } from "./report-repository.js";
/** Persist reports using Drizzle. */
export class DrizzleReportRepository implements IReportRepository {
  /** Inject the shared database client. */
  constructor(private readonly db: ReturnType<typeof createDatabase>["db"]) {}
  /** Find the report for an interview. */
  async findByInterview(interviewId: string) {
    return (
      await this.db
        .select()
        .from(reports)
        .where(eq(reports.interviewId, interviewId))
        .limit(1)
    )[0];
  }
  /** Insert once; concurrent generators return the existing report. */
  async saveIfAbsent(report: CreateReport) {
    const [created] = await this.db
      .insert(reports)
      .values(report)
      .onConflictDoNothing({ target: reports.interviewId })
      .returning();
    const result = created ?? (await this.findByInterview(report.interviewId));
    if (!result) throw new Error("Report could not be saved");
    return result;
  }
}

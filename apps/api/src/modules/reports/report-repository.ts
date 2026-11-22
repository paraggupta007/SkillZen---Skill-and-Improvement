// Persistence contract for completed interview reports.
import type { reports } from "../../db/schema.js";
/** A stored report. */
export type Report = typeof reports.$inferSelect;
/** Fields required to insert one report. */
export type CreateReport = Pick<
  Report,
  | "interviewId"
  | "overallScore"
  | "strengths"
  | "weaknesses"
  | "tips"
  | "summary"
>;
/** Repository abstraction used by report generation. */
export interface IReportRepository {
  findByInterview(interviewId: string): Promise<Report | undefined>;
  saveIfAbsent(report: CreateReport): Promise<Report>;
}

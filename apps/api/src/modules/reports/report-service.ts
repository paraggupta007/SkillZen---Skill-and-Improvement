// Asynchronous report generation with user ownership and bounded local state.
import { z } from "zod";
import { AppError } from "../../core/errors.js";
import type { JsonGenerator } from "../../ai/json-generator.js";
import type { ReportPrompt } from "../../domain/prompts/report-prompt.js";
import type { IInterviewRepository } from "../interviews/interview-repository.js";
import type { IReportPdfRenderer } from "./pdf-renderer.js";
import type { IReportRepository } from "./report-repository.js";
const list = z.array(z.string().trim().min(1).max(500)).min(1).max(6);
const reportSchema = z.object({
  strengths: list,
  weaknesses: list,
  tips: list,
  summary: z.string().trim().min(1).max(2500),
});
type State = "pending" | "failed";
/** Generate and retrieve coaching reports without exposing underlying provider errors. */
export class ReportService {
  private readonly jobs = new Map<string, State>();
  /** Inject repository interfaces and the structured AI generator. */
  constructor(
    private readonly interviews: IInterviewRepository,
    private readonly reports: IReportRepository,
    private readonly generator: Pick<JsonGenerator, "generate">,
    private readonly prompt: ReportPrompt,
    private readonly pdf: IReportPdfRenderer,
  ) {}
  private key(userId: string, interviewId: string) {
    return `${userId}:${interviewId}`;
  }
  private async ownedCompleted(userId: string, id: string) {
    const interview = await this.interviews.get(userId, id);
    if (!interview) throw new AppError(404, "NOT_FOUND", "Interview not found");
    if (interview.status !== "completed")
      throw new AppError(
        409,
        "INTERVIEW_INCOMPLETE",
        "Complete the interview before requesting a report",
      );
    return interview;
  }
  /** Start a best-effort generation job; duplicate jobs in this process are suppressed. */
  schedule(userId: string, id: string, retry = false): void {
    const key = this.key(userId, id);
    const state = this.jobs.get(key);
    if (state === "pending" || (state === "failed" && !retry)) return;
    this.jobs.set(key, "pending");
    void this.generate(userId, id)
      .then(() => {
        this.jobs.delete(key);
      })
      .catch(() => {
        this.jobs.set(key, "failed");
        // Bound retained failure states; pending jobs are never evicted.
        const failures = [...this.jobs].filter(
          ([, value]) => value === "failed",
        );
        for (const [old] of failures.slice(
          0,
          Math.max(0, failures.length - 200),
        ))
          this.jobs.delete(old);
      });
  }
  private async generate(userId: string, id: string) {
    const interview = await this.ownedCompleted(userId, id);
    if (await this.reports.findByInterview(id)) return;
    const turns = await this.interviews.turns(id);
    if (
      !turns.length ||
      turns.length !== interview.totalQuestions ||
      turns.some((turn) => !turn.answer || !turn.evaluation)
    )
      throw new Error("Interview evaluations are incomplete");
    const scores = turns.map((turn) => turn.evaluation!.overall);
    const overallScore = Math.round(
      scores.reduce((total, value) => total + value, 0) / scores.length,
    );
    const context = {
      role: interview.role,
      difficulty: interview.difficulty,
      roundType: interview.roundType,
      turnsIncluded: Math.min(turns.length, 10),
      totalTurns: turns.length,
      turns: turns.slice(-10).map((turn) => ({
        question: turn.question.text.slice(0, 300),
        answer: turn.answer!.answerText.slice(0, 350),
        correctness: turn.evaluation!.correctness,
        clarity: turn.evaluation!.clarity,
        depth: turn.evaluation!.depth,
        relevance: turn.evaluation!.relevance,
        feedback: turn.evaluation!.feedback.slice(0, 300),
      })),
    };
    const report = await this.generator.generate(
      this.prompt.build(context),
      reportSchema,
    );
    await this.reports.saveIfAbsent({
      interviewId: id,
      overallScore,
      ...report,
    });
  }
  /** Return a report, or the current pending/failed generation status. */
  async get(userId: string, id: string) {
    await this.ownedCompleted(userId, id);
    const report = await this.reports.findByInterview(id);
    if (report) return { status: "ready" as const, report };
    const state = this.jobs.get(this.key(userId, id));
    if (state === "failed")
      return { status: "failed" as const, error: "REPORT_GENERATION_FAILED" };
    if (!state) this.schedule(userId, id);
    return { status: "pending" as const };
  }
  /** Render an owned ready report, without exposing pending data. */
  async download(userId: string, id: string) {
    await this.ownedCompleted(userId, id);
    const report = await this.reports.findByInterview(id);
    if (!report)
      throw new AppError(
        409,
        "REPORT_NOT_READY",
        "Report is not ready for download",
      );
    return this.pdf.render(report);
  }
  /** Retry a failed or missing report generation without duplicating an active job. */
  async retry(userId: string, id: string) {
    await this.ownedCompleted(userId, id);
    const report = await this.reports.findByInterview(id);
    if (report) return { status: "ready" as const, report };
    this.schedule(userId, id, true);
    return { status: "pending" as const };
  }
}

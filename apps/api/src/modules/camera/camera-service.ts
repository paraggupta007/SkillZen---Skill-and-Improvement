// Authorization and coaching for optional interview camera aggregates.
import { AppError } from "../../core/errors.js";
import type { ICameraEvaluator } from "../../domain/evaluation/camera-evaluator.js";
import type { IInterviewRepository } from "../interviews/interview-repository.js";
import type { CameraMetrics, ICameraRepository } from "./camera-repository.js";
/** Provide user-controlled, aggregate-only camera coaching. */
export class CameraService {
  /** Inject ownership, persistence and coaching interfaces. */
  constructor(
    private readonly interviews: IInterviewRepository,
    private readonly repository: ICameraRepository,
    private readonly evaluator: ICameraEvaluator,
  ) {}
  private async owned(userId: string, interviewId: string) {
    const interview = await this.interviews.get(userId, interviewId);
    if (!interview) throw new AppError(404, "NOT_FOUND", "Interview not found");
    return interview;
  }
  /** Return saved counters and optional suggestions for an owned interview. */
  async get(userId: string, interviewId: string) {
    await this.owned(userId, interviewId);
    const metrics = await this.repository.get(interviewId);
    return {
      metrics: metrics
        ? {
            samples: metrics.samples,
            faceVisible: metrics.faceVisible,
            centered: metrics.centered,
            centeredKnown: metrics.centeredKnown,
            gazeNearCamera: metrics.gazeNearCamera,
            gazeKnown: metrics.gazeKnown,
            headMovements: metrics.headMovements,
          }
        : null,
      suggestions: metrics ? this.evaluator.evaluate(metrics) : [],
    };
  }
  /** Replace saved aggregate counters only after explicit user submission. */
  async save(userId: string, interviewId: string, metrics: CameraMetrics) {
    const interview = await this.owned(userId, interviewId);
    if (interview.status !== "in_progress")
      throw new AppError(
        409,
        "INTERVIEW_CLOSED",
        "Interview is not in progress",
      );
    await this.repository.save(interviewId, metrics);
    return this.get(userId, interviewId);
  }
  /** Remove previously shared counts without touching interview data. */
  async delete(userId: string, interviewId: string) {
    await this.owned(userId, interviewId);
    await this.repository.delete(interviewId);
  }
}

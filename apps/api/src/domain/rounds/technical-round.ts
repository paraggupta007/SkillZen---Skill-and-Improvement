// Technical interview round strategy.
import { InterviewRound } from "./interview-round.js";
/** Evaluate technical accuracy and problem-solving. */
export class TechnicalRound extends InterviewRound {
  readonly type = "technical";
  /** Criteria for technical answers. */
  get rubric() {
    return {
      description:
        "Assess technical correctness, reasoning, clarity, trade-offs and relevance to the role.",
    };
  }
}

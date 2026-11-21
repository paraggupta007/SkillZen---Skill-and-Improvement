// HR interview round strategy.
import { InterviewRound } from "./interview-round.js";
/** Evaluate communication and workplace fit without protected-trait judgments. */
export class HRRound extends InterviewRound {
  readonly type = "hr";
  /** Criteria for HR answers. */
  get rubric() {
    return {
      description:
        "Assess clear communication, motivation, professional judgement and relevance; do not infer protected traits.",
    };
  }
}

// Behavioral interview round strategy.
import { InterviewRound } from "./interview-round.js";
/** Evaluate evidence and reflection in past-experience stories. */
export class BehavioralRound extends InterviewRound {
  readonly type = "behavioral";
  /** Criteria for behavioral answers. */
  get rubric() {
    return {
      description:
        "Assess situation, task, action, result, reflection and relevance of the example.",
    };
  }
}

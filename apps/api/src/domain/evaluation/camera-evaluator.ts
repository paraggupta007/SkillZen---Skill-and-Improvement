// Conservative camera coaching based only on optional user-supplied aggregate counts.
import type { CameraMetrics } from "../../modules/camera/camera-repository.js";
/** Produce non-diagnostic visual-practice suggestions. */
export interface ICameraEvaluator {
  evaluate(metrics: CameraMetrics): string[];
}
/** Explain framing limitations without treating gaze as attention or performance. */
export class CameraEvaluator implements ICameraEvaluator {
  /** Provide suggestions only when enough usable samples exist. */
  evaluate(metrics: CameraMetrics): string[] {
    const tips: string[] = [];
    if (metrics.samples >= 25 && metrics.faceVisible / metrics.samples < 0.5)
      tips.push(
        "If helpful, adjust your camera or lighting so your face is easier to see.",
      );
    if (
      metrics.centeredKnown >= 25 &&
      metrics.centered / metrics.centeredKnown < 0.5
    )
      tips.push(
        "Consider adjusting the camera framing to keep your face comfortably visible.",
      );
    if (
      metrics.postureKnown >= 10 &&
      metrics.postureAligned / metrics.postureKnown < 0.5
    )
      tips.push(
        "If useful, check your camera angle and choose a comfortable sitting position; alignment estimates can be inaccurate.",
      );
    if (metrics.wristKnown >= 10)
      tips.push(
        "Use gestures that feel natural; wrist movement counts do not measure communication skill.",
      );
    if (!tips.length)
      tips.push(
        "Check that your camera setup is comfortable and works for you.",
      );
    return tips;
  }
}

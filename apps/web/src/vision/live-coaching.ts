// Ephemeral, conservative visual cues. They are not assessments of attention or performance.
import type { FaceObservation, Point, PoseObservation } from "./analyzers";
type Direction = -1 | 0 | 1 | null;
type Cue = "multiple" | "missing" | "framing" | "eyes" | "wrists";
export const cueText: Record<Cue, string> = {
  multiple:
    "More than one face-like shape may be in the frame. Check your camera view; the model can be mistaken.",
  missing:
    "A face is not clearly visible. You can adjust the camera or lighting.",
  framing:
    "Your face may be away from the center of the frame. Try adjusting your position or camera.",
  eyes: "Iris position appears to shift from side to side. This estimate can be inaccurate; use the preview if helpful.",
  wrists:
    "Repeated wrist movement is visible. If you wish, try a steadier hand position; natural gestures are fine.",
};
/** Approximate direction from both visible irises; not a measurement of attention. */
export function irisDirection(points: readonly Point[]): Direction {
  function ratio(a: number, b: number, iris: number) {
    const p = points[a],
      q = points[b],
      pupil = points[iris];
    if (
      !p ||
      !q ||
      !pupil ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(q.x) ||
      !Number.isFinite(pupil.x)
    )
      return null;
    const width = Math.abs(p.x - q.x);
    if (width < 0.005) return null;
    const value = (pupil.x - Math.min(p.x, q.x)) / width;
    return value >= 0 && value <= 1 ? value : null;
  }
  const left = ratio(33, 133, 468),
    right = ratio(362, 263, 473);
  if (left === null || right === null) return null;
  if (left < 0.35 && right < 0.35) return -1;
  if (left > 0.65 && right > 0.65) return 1;
  return 0;
}
/** Recent bounded windows provide sustained cues and clear when data is absent. */
export class LiveCoaching {
  private faces: number[] = [];
  private centered: (boolean | null)[] = [];
  private directions: Direction[] = [];
  private movements: (boolean | null)[] = [];
  private wrists: [Point | null, Point | null] = [null, null];
  face(count: number, observation: FaceObservation, direction: Direction) {
    this.faces.push(Math.min(count, 2));
    this.faces = this.faces.slice(-10);
    this.centered.push(count === 1 ? observation.centered : null);
    this.centered = this.centered.slice(-15);
    if (count !== 1 || observation.centered !== true || direction === null) {
      this.directions = [];
    } else {
      this.directions.push(direction);
    }
    this.directions = this.directions.slice(-25);
  }
  pose(observation: PoseObservation | null) {
    if (!observation) {
      this.wrists = [null, null];
      this.movements = [];
      return;
    }
    const comparable = observation.wrists.some((p, i) => p && this.wrists[i]);
    const moved = observation.wrists.some((p, i) => {
      const previous = this.wrists[i];
      return (
        p && previous && Math.hypot(p.x - previous.x, p.y - previous.y) > 0.08
      );
    });
    this.movements.push(comparable ? moved : null);
    this.movements = this.movements.slice(-6);
    this.wrists = observation.wrists;
  }
  cues(): string[] {
    const result: Cue[] = [];
    const recent = this.faces.slice(-5);
    if (recent.length >= 5 && recent.filter((n) => n >= 2).length >= 4)
      result.push("multiple");
    if (
      this.faces.length >= 10 &&
      this.faces.filter((n) => n === 0).length >= 8
    )
      result.push("missing");
    if (
      this.centered.length >= 15 &&
      this.centered.filter((value) => value === false).length >= 12
    )
      result.push("framing");
    const directions = this.directions.filter(
      (value): value is -1 | 1 => value === -1 || value === 1,
    );
    let changes = 0;
    for (let i = 1; i < directions.length; i++)
      if (directions[i] !== directions[i - 1]) changes++;
    if (
      directions.length >= 6 &&
      changes >= 3 &&
      this.directions.slice(-5).some((d) => d === -1 || d === 1)
    )
      result.push("eyes");
    if (
      this.movements.length >= 6 &&
      this.movements.filter((value) => value === true).length >= 4
    )
      result.push("wrists");
    return result.map((key) => cueText[key]);
  }
}

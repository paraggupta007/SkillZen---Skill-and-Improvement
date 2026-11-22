// Conservative face-framing and approximate gaze heuristics; never infer attention or emotion.
/** A normalized face landmark. */
export interface Point {
  x: number;
  y: number;
  z?: number;
}
/** One frame's approximate observations. Null means insufficient landmarks. */
export interface FaceObservation {
  faceVisible: boolean;
  centered: boolean | null;
  gazeNearCamera: boolean | null;
  headX: number | null;
}
/** Pure analyzer contract, allowing independent alternatives. */
export interface IFaceAnalyzer {
  analyze(points: readonly Point[]): FaceObservation;
}
/** Estimate head framing and iris position from MediaPipe face landmarks. */
export class FaceAnalyzer implements IFaceAnalyzer {
  /** Compute visual estimates, not attention, identity, or medical measurements. */
  analyze(points: readonly Point[]): FaceObservation {
    const nose = points[1];
    const left = points[234];
    const right = points[454];
    if (!nose || !left || !right)
      return {
        faceVisible: false,
        centered: null,
        gazeNearCamera: null,
        headX: null,
      };
    const width = Math.abs(right.x - left.x);
    if (width < 0.04)
      return {
        faceVisible: true,
        centered: null,
        gazeNearCamera: null,
        headX: nose.x,
      };
    const centered =
      nose.x > 0.25 && nose.x < 0.75 && nose.y > 0.15 && nose.y < 0.85;
    const eyeRatio = (a: number, b: number, iris: number) => {
      const p = points[a];
      const q = points[b];
      const pupil = points[iris];
      if (!p || !q || !pupil || Math.abs(p.x - q.x) < 0.005) return null;
      return (pupil.x - Math.min(p.x, q.x)) / Math.abs(p.x - q.x);
    };
    const a = eyeRatio(33, 133, 468);
    const b = eyeRatio(362, 263, 473);
    const gazeNearCamera =
      a === null || b === null
        ? null
        : a > 0.25 && a < 0.75 && b > 0.25 && b < 0.75;
    return { faceVisible: true, centered, gazeNearCamera, headX: nose.x };
  }
}
/** Aggregate coarse counters without retaining frames or landmarks. */
export class FaceMetricsAggregator {
  private samples = 0;
  private visible = 0;
  private centered = 0;
  private centeredKnown = 0;
  private gaze = 0;
  private gazeKnown = 0;
  private movement = 0;
  private previousX: number | null = null;
  /** Incorporate a single approximate observation. */
  add(result: FaceObservation) {
    this.samples++;
    if (result.faceVisible) this.visible++;
    if (result.centered !== null) {
      this.centeredKnown++;
      if (result.centered) this.centered++;
    }
    if (result.gazeNearCamera !== null) {
      this.gazeKnown++;
      if (result.gazeNearCamera) this.gaze++;
    }
    if (
      result.headX !== null &&
      this.previousX !== null &&
      Math.abs(result.headX - this.previousX) > 0.08
    )
      this.movement++;
    this.previousX = result.headX;
  }
  /** Return counts and known denominators; no biometric landmarks leave the analyzer. */
  snapshot() {
    return {
      samples: this.samples,
      faceVisible: this.visible,
      centered: this.centered,
      centeredKnown: this.centeredKnown,
      gazeNearCamera: this.gaze,
      gazeKnown: this.gazeKnown,
      headMovements: this.movement,
    };
  }
}

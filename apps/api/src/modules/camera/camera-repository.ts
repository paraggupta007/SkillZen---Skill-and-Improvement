// Persistence contract for optional, user-shared camera counters.
import type { cameraObservations } from "../../db/schema.js";
/** Coarse counters only; no image, video or landmarks. */
export type CameraMetrics = Pick<
  typeof cameraObservations.$inferSelect,
  | "samples"
  | "faceVisible"
  | "centered"
  | "centeredKnown"
  | "gazeNearCamera"
  | "gazeKnown"
  | "headMovements"
>;
/** Storage contract after ownership has been verified by the service. */
export interface ICameraRepository {
  get(interviewId: string): Promise<CameraMetrics | undefined>;
  save(interviewId: string, metrics: CameraMetrics): Promise<void>;
  delete(interviewId: string): Promise<void>;
}

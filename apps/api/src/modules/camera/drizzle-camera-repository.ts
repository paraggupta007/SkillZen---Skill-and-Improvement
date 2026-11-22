// SQL adapter for optional aggregate camera counters.
import { eq } from "drizzle-orm";
import type { createDatabase } from "../../db/client.js";
import { cameraObservations } from "../../db/schema.js";
import type { CameraMetrics, ICameraRepository } from "./camera-repository.js";
/** Store coarse counts without retaining camera images. */
export class DrizzleCameraRepository implements ICameraRepository {
  /** Inject the shared database client. */
  constructor(private readonly db: ReturnType<typeof createDatabase>["db"]) {}
  /** Find a previously saved aggregate. */
  async get(interviewId: string) {
    return (
      await this.db
        .select()
        .from(cameraObservations)
        .where(eq(cameraObservations.interviewId, interviewId))
        .limit(1)
    )[0];
  }
  /** Replace the aggregate for one interview. */
  async save(interviewId: string, metrics: CameraMetrics) {
    await this.db
      .insert(cameraObservations)
      .values({ interviewId, ...metrics })
      .onConflictDoUpdate({
        target: cameraObservations.interviewId,
        set: { ...metrics, updatedAt: new Date() },
      });
  }
  /** Remove the user's shared aggregate. */
  async delete(interviewId: string) {
    await this.db
      .delete(cameraObservations)
      .where(eq(cameraObservations.interviewId, interviewId));
  }
}

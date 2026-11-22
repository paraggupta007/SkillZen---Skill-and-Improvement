// Database aggregate queries for the authenticated user's dashboard.
import { and, count, desc, eq, sql } from "drizzle-orm";
import type { createDatabase } from "../../db/client.js";
import { interviews, reports } from "../../db/schema.js";
import type { IAnalyticsRepository } from "./analytics-repository.js";
/** Calculate dashboard statistics with indexed, user-scoped queries. */
export class DrizzleAnalyticsRepository implements IAnalyticsRepository {
  /** Inject the shared database client. */
  constructor(private readonly db: ReturnType<typeof createDatabase>["db"]) {}
  /** Return counts, average report score and up to 20 recent report scores. */
  async summary(userId: string) {
    const [counts] = await this.db
      .select({
        total: count(),
        completed:
          sql<number>`count(*) filter (where ${interviews.status} = 'completed')`.mapWith(
            Number,
          ),
      })
      .from(interviews)
      .where(eq(interviews.userId, userId));
    const [scores] = await this.db
      .select({
        average: sql<number | null>`avg(${reports.overallScore})`.mapWith({
          mapFromDriverValue: (value: unknown) =>
            value === null ? null : Number(value),
        }),
      })
      .from(interviews)
      .innerJoin(reports, eq(reports.interviewId, interviews.id))
      .where(
        and(eq(interviews.userId, userId), eq(interviews.status, "completed")),
      );
    const trend = await this.db
      .select({
        interviewId: interviews.id,
        startedAt: interviews.startedAt,
        score: reports.overallScore,
      })
      .from(interviews)
      .innerJoin(reports, eq(reports.interviewId, interviews.id))
      .where(
        and(eq(interviews.userId, userId), eq(interviews.status, "completed")),
      )
      .orderBy(desc(interviews.startedAt))
      .limit(20);
    return {
      totalInterviews: counts?.total ?? 0,
      completedInterviews: counts?.completed ?? 0,
      averageScore:
        scores?.average === null || scores?.average === undefined
          ? null
          : Math.round(scores.average * 10) / 10,
      scoreTrend: trend.reverse(),
    };
  }
}

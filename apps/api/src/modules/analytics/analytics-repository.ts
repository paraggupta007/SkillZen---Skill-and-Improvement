// Interface for user-scoped dashboard aggregates.
/** Summary metrics and recent available report scores. */
export interface AnalyticsSummary {
  totalInterviews: number;
  completedInterviews: number;
  averageScore: number | null;
  scoreTrend: { interviewId: string; startedAt: Date; score: number }[];
}
/** Data source for dashboard analytics. */
export interface IAnalyticsRepository {
  summary(userId: string): Promise<AnalyticsSummary>;
}

// Simple application service for user-scoped dashboard data.
import type { IAnalyticsRepository } from "./analytics-repository.js";
/** Fetch dashboard analytics through a repository interface. */
export class AnalyticsService {
  /** Inject the analytics data source. */
  constructor(private readonly repository: IAnalyticsRepository) {}
  /** Return the authenticated user's summary. */
  summary(userId: string) {
    return this.repository.summary(userId);
  }
}

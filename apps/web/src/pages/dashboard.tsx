// Authenticated dashboard with real history and score trend data.
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  CirclePlay,
  Sparkles,
  Target,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiRequest } from "../services/api";
import { useCurrentUser } from "../services/queries";
import type { Analytics, Interview } from "../services/types";
import { ErrorState, Eyebrow, formatDate, Loading } from "../components/ui";
/** Show the user's interview history and available report scores. */
export function Dashboard() {
  const user = useCurrentUser();
  const summary = useQuery({
    queryKey: ["analytics"],
    queryFn: () => apiRequest<Analytics>("/analytics/summary"),
  });
  const history = useQuery({
    queryKey: ["interviews"],
    queryFn: () => apiRequest<Interview[]>("/interviews"),
  });
  const firstName = user.data?.name.trim().split(/\s+/)[0] ?? "there";
  return (
    <div className="page dashboard-page">
      <div className="page-top">
        <div>
          <Eyebrow>YOUR WORKSPACE</Eyebrow>
          <h1>
            Welcome back, {firstName}
            <span className="heading-dot">.</span>
          </h1>
          <p>A little better with every session. Ready to keep going?</p>
        </div>
        <Link to="/app/setup" className="button button-dark">
          Start an interview <ArrowRight size={17} />
        </Link>
      </div>
      <section className="dashboard-banner">
        <div className="banner-copy">
          <span className="banner-tag">
            <Sparkles size={13} /> YOUR NEXT STEP
          </span>
          <h2>
            Confidence is built,
            <br />
            <em>one answer at a time.</em>
          </h2>
          <p>
            Take a moment for your future self. Your next practice session is
            waiting.
          </p>
          <Link to="/app/setup">
            Let’s practice <ArrowRight size={15} />
          </Link>
        </div>
        <div className="banner-art" aria-hidden="true">
          <span className="banner-art-circle" />
          <span className="banner-art-card">
            <Sparkles size={23} />
            <b>
              Keep
              <br />
              growing.
            </b>
            <small>SKILLZEN / 01</small>
          </span>
        </div>
      </section>
      {summary.isLoading ? (
        <Loading label="Loading your progress..." />
      ) : summary.isError ? (
        <ErrorState
          message={summary.error.message}
          retry={() => void summary.refetch()}
        />
      ) : (
        summary.data && (
          <>
            <div className="section-label">
              YOUR PROGRESS <span>AN OVERVIEW</span>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">
                  <span>Interviews started</span>
                  <span className="stat-icon mint">
                    <CirclePlay size={17} />
                  </span>
                </div>
                <strong>
                  {summary.data.totalInterviews.toString().padStart(2, "0")}
                </strong>
                <small>All practice sessions</small>
              </div>
              <div className="stat-card">
                <div className="stat-label">
                  <span>Sessions completed</span>
                  <span className="stat-icon peach">
                    <Target size={17} />
                  </span>
                </div>
                <strong>
                  {summary.data.completedInterviews.toString().padStart(2, "0")}
                </strong>
                <small>Finished interviews</small>
              </div>
              <div className="stat-card">
                <div className="stat-label">
                  <span>Average score</span>
                  <span className="stat-icon lavender">
                    <BarChart3 size={17} />
                  </span>
                </div>
                <strong>
                  {summary.data.averageScore === null
                    ? "—"
                    : summary.data.averageScore}
                  <span className="stat-denom"> / 10</span>
                </strong>
                <small>Based on available reports</small>
              </div>
            </div>
            <div className="dashboard-grid">
              <section className="panel chart-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Your growth, over time</h2>
                    <p>Scores from completed interview reports.</p>
                  </div>
                  <span className="panel-icon">
                    <TrendingUpIcon />
                  </span>
                </div>
                {summary.data.scoreTrend.length ? (
                  <>
                    <div className="chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={summary.data.scoreTrend.map((item) => ({
                            ...item,
                            label: formatDate(item.startedAt),
                          }))}
                          margin={{ top: 15, right: 15, left: -24, bottom: 0 }}
                        >
                          <CartesianGrid stroke="#edf0e9" vertical={false} />
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#829189", fontSize: 11 }}
                            minTickGap={30}
                          />
                          <YAxis
                            domain={[0, 10]}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#829189", fontSize: 11 }}
                          />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="#397d62"
                            strokeWidth={3}
                            dot={{ fill: "#397d62", r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="sr-only">
                      {summary.data.scoreTrend.map((item) => (
                        <li key={item.interviewId}>
                          {formatDate(item.startedAt)}: {item.score} out of 10
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <div className="chart-empty">
                    <BarChart3 size={24} />
                    <strong>Your progress will appear here</strong>
                    <span>
                      Complete an interview to start your score trend.
                    </span>
                  </div>
                )}
              </section>
              <section className="panel next-panel">
                <div className="next-symbol">
                  <Sparkles size={22} />
                </div>
                <span className="next-kicker">A NOTE FOR YOU</span>
                <h2>
                  Start where
                  <br />
                  <em>you are.</em>
                </h2>
                <p>
                  Every answer is an opportunity to learn. You don’t need to be
                  perfect to begin.
                </p>
                <Link to="/app/setup">
                  Set up a session <ArrowUpRight size={15} />
                </Link>
              </section>
            </div>
          </>
        )
      )}
      <section className="history-section">
        <div className="section-row">
          <div>
            <h2>Recent sessions</h2>
            <p>Your practice, all in one place.</p>
          </div>
          <span className="history-count">
            {history.data?.length ?? 0} SESSIONS
          </span>
        </div>
        {history.isLoading ? (
          <Loading label="Loading sessions..." />
        ) : history.isError ? (
          <ErrorState
            message={history.error.message}
            retry={() => void history.refetch()}
          />
        ) : history.data?.length ? (
          <div className="history-list">
            {history.data.map((item) => (
              <Link
                key={item.id}
                to={
                  item.status === "completed"
                    ? `/app/report/${item.id}`
                    : `/app/interview/${item.id}`
                }
                className="history-item"
              >
                <span className="history-icon">
                  <MessageIcon />
                </span>
                <span className="history-title">
                  <strong>{item.role}</strong>
                  <small>
                    {item.roundType} · {item.difficulty} · {item.totalQuestions}{" "}
                    questions
                  </small>
                </span>
                <span
                  className={`status-pill ${item.status === "completed" ? "done" : ""}`}
                >
                  {item.status === "in_progress" ? "In progress" : item.status}
                </span>
                <span className="history-date">
                  <CalendarDays size={14} />
                  {formatDate(item.startedAt)}
                </span>
                <ChevronRight size={17} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-panel">
            <div className="empty-icon">
              <Sparkles size={21} />
            </div>
            <h3>It starts with one session.</h3>
            <p>You haven’t practiced an interview yet. Let’s change that.</p>
            <Link
              to="/app/setup"
              className="button button-outline button-small"
            >
              Start your first interview <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
function TrendingUpIcon() {
  return <BarChart3 size={18} />;
}
function MessageIcon() {
  return <Sparkles size={17} />;
}

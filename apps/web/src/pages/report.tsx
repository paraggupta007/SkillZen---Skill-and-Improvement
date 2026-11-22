// Report page that polls asynchronous report generation and supports retry.
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { apiRequest } from "../services/api";
import type { InterviewDetail, ReportState } from "../services/types";
import { ErrorState, Eyebrow, Loading } from "../components/ui";
/** Display a generated interview report, or its current generation status. */
export function ReportPage() {
  const { id = "" } = useParams();
  const client = useQueryClient();
  const report = useQuery({
    queryKey: ["report", id],
    queryFn: () => apiRequest<ReportState>(`/reports/${id}`),
    enabled: Boolean(id),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 20000 : false,
  });
  const interview = useQuery({
    queryKey: ["interview", id],
    queryFn: () => apiRequest<InterviewDetail>(`/interviews/${id}`),
    enabled: Boolean(id),
    retry: false,
  });
  const retry = useMutation({
    mutationFn: () =>
      apiRequest<ReportState>(`/reports/${id}/retry`, { method: "POST" }),
    onSuccess: async (result) => {
      client.setQueryData(["report", id], result);
      await client.invalidateQueries({ queryKey: ["report", id] });
    },
  });
  useEffect(() => {
    if (report.data?.status === "ready")
      void client.invalidateQueries({ queryKey: ["analytics"] });
  }, [report.data?.status, client]);
  return (
    <div className="page report-page">
      <Link className="back-link" to="/app">
        <ArrowLeft size={15} /> Back to dashboard
      </Link>
      <div className="report-header">
        <div>
          <Eyebrow>YOUR SESSION REPORT</Eyebrow>
          <h1>
            Look how far you’ve come<span className="heading-dot">.</span>
          </h1>
          <p>
            {interview.data?.interview.role ?? "Interview"} · A moment to
            reflect, and a plan to grow.
          </p>
        </div>
        <Link to="/app/setup" className="button button-outline">
          Practice again <ArrowRight size={16} />
        </Link>
      </div>
      {report.isLoading ? (
        <Loading label="Loading your report..." />
      ) : report.isError ? (
        <ErrorState
          message={report.error.message}
          retry={() => void report.refetch()}
        />
      ) : report.data?.status === "pending" ? (
        <div className="report-wait">
          <span className="report-wait-icon">
            <Sparkles size={24} />
          </span>
          <h2>Putting your report together.</h2>
          <p>
            We’re looking at your answers and gathering useful next steps. This
            page will update automatically.
          </p>
          <Loading label="Preparing your feedback..." />
        </div>
      ) : report.data?.status === "failed" ? (
        <div className="report-wait">
          <span className="report-wait-icon">
            <RefreshCw size={24} />
          </span>
          <h2>Your report needs another try.</h2>
          <p>
            Your interview is saved. You can safely retry generating the report.
          </p>
          <button
            type="button"
            className="button button-dark"
            disabled={retry.isPending}
            onClick={() => retry.mutate()}
          >
            {retry.isPending ? "Trying again..." : "Retry report"}{" "}
            <ArrowRight size={16} />
          </button>
          {retry.isError && <ErrorState message={retry.error.message} />}
        </div>
      ) : (
        report.data?.status === "ready" && (
          <>
            <section className="report-hero">
              <div>
                <span className="report-hero-label">
                  <Sparkles size={14} /> YOUR OVERALL PERFORMANCE
                </span>
                <h2>
                  Good work showing up
                  <br />
                  <em>for yourself.</em>
                </h2>
                <p>{report.data.report.summary}</p>
              </div>
              <div className="score-ring">
                <span>
                  <strong>{report.data.report.overallScore}</strong>
                  <small>OUT OF 10</small>
                </span>
              </div>
            </section>
            <div className="report-grid">
              <ReportList
                title="Your strengths"
                subtitle="What’s already working well."
                items={report.data.report.strengths}
                icon="strength"
              />
              <ReportList
                title="Room to grow"
                subtitle="Areas to give a little more attention."
                items={report.data.report.weaknesses}
                icon="growth"
              />
              <ReportList
                title="Your next steps"
                subtitle="Small actions for your next session."
                items={report.data.report.tips}
                icon="tip"
              />
            </div>
            <div className="report-disclaimer">
              AI feedback is a practice aid, not a hiring decision. Use your own
              judgment and keep improving.
            </div>
          </>
        )
      )}
    </div>
  );
}
/** Render one list of actionable report insights. */
function ReportList({
  title,
  subtitle,
  items,
  icon,
}: {
  title: string;
  subtitle: string;
  items: string[];
  icon: "strength" | "growth" | "tip";
}) {
  const Icon =
    icon === "strength" ? CheckCircle2 : icon === "growth" ? Target : Lightbulb;
  return (
    <section className="panel report-list">
      <span className={`report-list-icon ${icon}`}>
        <Icon size={19} />
      </span>
      <h2>{title}</h2>
      <p>{subtitle}</p>
      <ul>
        {items.map((item, index) => (
          <li key={`${index}-${item}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            {item}
          </li>
        ))}
      </ul>
      {icon === "growth" && <TrendingUp size={16} className="report-deco" />}
    </section>
  );
}

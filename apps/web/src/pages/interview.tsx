// Live interview screen with provisional SSE text and validated answer feedback.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
} from "lucide-react";
import { apiRequest } from "../services/api";
import { partialJsonString, streamRequest } from "../services/sse";
import type {
  Evaluation,
  Interview,
  InterviewDetail,
  Question,
} from "../services/types";
import {
  speakQuestion,
  useSpeech,
  type SpeechMetrics,
} from "../hooks/use-speech";
import { useRecording } from "../hooks/use-recording";
import { useInterviewStore } from "../store/interview-store";
import { QuestionFeedback } from "../components/question-feedback";
import { CameraCoaching } from "../components/camera-coaching";
import { ErrorState, Eyebrow, Loading } from "../components/ui";
/** Show the live question, answer editor and validated feedback. */
export function InterviewPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const detail = useQuery({
    queryKey: ["interview", id],
    queryFn: () => apiRequest<InterviewDetail>(`/interviews/${id}`),
    enabled: Boolean(id),
    retry: false,
  });
  const [question, setQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<Evaluation | null>(null);
  const [preview, setPreview] = useState("");
  const [speechMetrics, setSpeechMetrics] = useState<SpeechMetrics | null>(
    null,
  );
  const dictationBase = useRef("");
  const voice = useSpeech((text, metrics) => {
    setDraft(
      [dictationBase.current, text].filter(Boolean).join(" ").slice(0, 12000),
    );
    setSpeechMetrics(
      dictationBase.current || text.length > 12000 ? null : metrics,
    );
  });
  const recordedBase = useRef("");
  const recording = useRecording(id, (text) => {
    setDraft(
      [recordedBase.current, text].filter(Boolean).join(" ").slice(0, 12000),
    );
    setSpeechMetrics(null);
  });
  const voiceBusy = voice.listening || recording.status !== "idle";
  const raw = useRef("");
  const requested = useRef("");
  const controller = useRef(new AbortController());
  const draft = useInterviewStore((state) => state.draft);
  const setDraft = useInterviewStore((state) => state.setDraft);
  const clear = useInterviewStore((state) => state.clear);
  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    clear();
    return () => current.abort();
  }, [id, clear]);
  const nextQuestion = useMutation({
    mutationFn: async () => {
      raw.current = "";
      setPreview("");
      return streamRequest<Question>(`/interviews/${id}/next-question`, {
        signal: controller.current.signal,
        onDelta: (chunk) => {
          raw.current += chunk;
          setPreview(partialJsonString(raw.current, "question"));
        },
      });
    },
    onSuccess: async (value) => {
      setQuestion(value);
      setPreview("");
      await client.invalidateQueries({ queryKey: ["interview", id] });
    },
  });
  const submitAnswer = useMutation({
    mutationFn: async (input: {
      questionId: string;
      answerText: string;
      speech?: SpeechMetrics;
    }) => {
      raw.current = "";
      setPreview("");
      return streamRequest<Evaluation>(`/interviews/${id}/answers`, {
        method: "POST",
        body: input,
        signal: controller.current.signal,
        onDelta: (chunk) => {
          raw.current += chunk;
          setPreview(partialJsonString(raw.current, "feedback"));
        },
      });
    },
    onSuccess: async (value) => {
      setFeedback(value);
      setPreview("");
      setQuestion(null);
      clear();
      setSpeechMetrics(null);
      await client.invalidateQueries({ queryKey: ["interview", id] });
    },
  });
  const complete = useMutation({
    mutationFn: () =>
      apiRequest<Interview>(`/interviews/${id}/complete`, { method: "POST" }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["interviews"] }),
        client.invalidateQueries({ queryKey: ["analytics"] }),
      ]);
      navigate(`/app/report/${id}`);
    },
  });
  const record = detail.data;
  const pending = record?.turns.find((turn) => !turn.answer)?.question;
  const active = question ?? pending;
  const allAnswered = Boolean(
    record &&
    record.turns.length >= record.interview.totalQuestions &&
    record.turns.every((turn) => turn.answer),
  );
  const nextKey = record ? `${id}:${record.turns.length}` : "";
  useEffect(() => {
    if (
      !record ||
      record.interview.status !== "in_progress" ||
      active ||
      feedback ||
      allAnswered ||
      nextQuestion.isPending ||
      requested.current === nextKey
    )
      return;
    requested.current = nextKey;
    nextQuestion.mutate();
  }, [record, active, feedback, allAnswered, nextQuestion, nextKey]);
  if (detail.isLoading) return <Loading label="Preparing your interview..." />;
  if (detail.isError)
    return (
      <ErrorState
        message={detail.error.message}
        retry={() => void detail.refetch()}
      />
    );
  if (!record) return <ErrorState message="Interview not found." />;
  if (record.interview.status === "completed")
    return <Navigate to={`/app/report/${id}`} replace />;
  if (record.interview.status !== "in_progress")
    return <ErrorState message="This interview is no longer in progress." />;
  const number =
    active?.orderNo ??
    Math.min(record.turns.length + 1, record.interview.totalQuestions);
  const progress = Math.min(
    100,
    (number / record.interview.totalQuestions) * 100,
  );
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active && draft.trim())
      submitAnswer.mutate({
        questionId: active.id,
        answerText: draft.trim(),
        ...(speechMetrics ? { speech: speechMetrics } : {}),
      });
  }
  return (
    <div className="page interview-page">
      <div className="interview-top">
        <Link className="back-link" to="/app">
          <ArrowLeft size={15} /> Save & exit
        </Link>
        <span className="session-badge">
          <span /> PRACTICE IN PROGRESS
        </span>
      </div>
      <div className="interview-head">
        <div>
          <Eyebrow>
            {record.interview.roundType.toUpperCase()} INTERVIEW
          </Eyebrow>
          <h1>
            {record.interview.role}
            <span className="heading-dot">.</span>
          </h1>
          <p>A thoughtful answer is better than a perfect one.</p>
        </div>
        <div className="progress-info">
          <span>YOUR PROGRESS</span>
          <strong>
            {String(number).padStart(2, "0")}{" "}
            <small>
              / {String(record.interview.totalQuestions).padStart(2, "0")}
            </small>
          </strong>
        </div>
      </div>
      <div
        className="progress-track"
        aria-label={`Question ${number} of ${record.interview.totalQuestions}`}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="interview-grid">
        <div className="interview-content">
          {feedback ? (
            <section className="panel feedback-panel">
              <div className="question-overline">
                <span>
                  <CheckCircle2 size={15} /> ANSWER REVIEW
                </span>
                <span className="validated-tag">COMPLETE</span>
              </div>
              <h2>Here’s how you did.</h2>
              <p className="feedback-intro">
                A little reflection goes a long way.
              </p>
              <div className="score-row">
                {["correctness", "clarity", "depth", "relevance"].map(
                  (metric) => (
                    <div key={metric}>
                      <small>{metric}</small>
                      <strong>
                        {feedback.metrics[metric] ?? "—"}
                        <span>/10</span>
                      </strong>
                    </div>
                  ),
                )}
              </div>
              <div className="feedback-block">
                <span>YOUR FEEDBACK</span>
                {feedback.feedback.map((item, index) => (
                  <p key={`${index}-${item}`}>{item}</p>
                ))}
              </div>
              {feedback.idealAnswer && (
                <div className="ideal-block">
                  <span>
                    <Sparkles size={15} /> A STRONGER EXAMPLE
                  </span>
                  <p>{feedback.idealAnswer}</p>
                </div>
              )}
              <div className="feedback-actions">
                {allAnswered ? (
                  <button
                    className="button button-dark"
                    onClick={() => complete.mutate()}
                    disabled={complete.isPending}
                  >
                    {complete.isPending
                      ? "Finishing..."
                      : "Finish & view report"}{" "}
                    <ArrowRight size={17} />
                  </button>
                ) : (
                  <button
                    className="button button-dark"
                    disabled={submitAnswer.isPending}
                    onClick={() => {
                      setFeedback(null);
                      setPreview("");
                    }}
                  >
                    Next question <ArrowRight size={17} />
                  </button>
                )}
              </div>
              {complete.isError && (
                <ErrorState message={complete.error.message} />
              )}
            </section>
          ) : allAnswered ? (
            <section className="panel feedback-panel">
              <div className="empty-icon">
                <CheckCircle2 size={22} />
              </div>
              <h2>That’s a wrap.</h2>
              <p className="feedback-intro">
                You’ve answered every question. Your report is next.
              </p>
              <button
                className="button button-dark"
                onClick={() => complete.mutate()}
                disabled={complete.isPending}
              >
                {complete.isPending ? "Finishing..." : "Finish & view report"}{" "}
                <ArrowRight size={17} />
              </button>
              {complete.isError && (
                <ErrorState message={complete.error.message} />
              )}
            </section>
          ) : (
            <>
              <section className="panel question-panel">
                <div className="question-overline">
                  <span>
                    <Sparkles size={15} /> QUESTION{" "}
                    {String(number).padStart(2, "0")}
                  </span>
                  {active && (
                    <span className="question-category">
                      {active.isFollowup
                        ? "FOLLOW-UP"
                        : active.category.toUpperCase()}
                    </span>
                  )}
                </div>
                {active ? (
                  <h2>{active.text}</h2>
                ) : (
                  <>
                    <h2>
                      {preview || "Putting your next question together..."}
                    </h2>
                    <p className="provisional-note">
                      {preview
                        ? "Draft preview · the final question may change."
                        : "Your AI interviewer is preparing a question."}
                    </p>
                  </>
                )}
                {active && (
                  <button
                    type="button"
                    className="voice-button"
                    disabled={voiceBusy}
                    onClick={() => speakQuestion(active.text)}
                  >
                    <Volume2 size={16} /> Read question aloud
                  </button>
                )}
                {active && (
                  <QuestionFeedback
                    key={active.id}
                    interviewId={id}
                    questionId={active.id}
                  />
                )}
                {nextQuestion.isError && (
                  <ErrorState
                    message={nextQuestion.error.message}
                    retry={() => nextQuestion.mutate()}
                  />
                )}
              </section>
              <form className="panel answer-panel" onSubmit={submit}>
                <div className="answer-heading">
                  <div>
                    <h2>Your answer</h2>
                    <p>Think it through, then put it in your own words.</p>
                  </div>
                  {active && <QuestionTimer key={active.id} />}
                </div>
                <label className="sr-only" htmlFor="answer">
                  Your answer
                </label>
                <textarea
                  id="answer"
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setSpeechMetrics(null);
                  }}
                  maxLength={12000}
                  placeholder="Take a breath, and start typing your answer here..."
                  rows={8}
                  disabled={
                    !active || submitAnswer.isPending || voice.listening
                  }
                />
                <div className="voice-controls">
                  {voice.supported ? (
                    <button
                      type="button"
                      className="voice-button"
                      disabled={
                        !active ||
                        submitAnswer.isPending ||
                        recording.status !== "idle"
                      }
                      onClick={() => {
                        if (voice.listening) voice.stop();
                        else {
                          dictationBase.current = draft.trim();
                          setSpeechMetrics(null);
                          voice.start();
                        }
                      }}
                    >
                      {voice.listening ? (
                        <MicOff size={16} />
                      ) : (
                        <Mic size={16} />
                      )}{" "}
                      {voice.listening ? "Stop dictation" : "Dictate answer"}
                    </button>
                  ) : (
                    <span>
                      Dictation is unavailable in this browser. You can type
                      your answer.
                    </span>
                  )}
                  <span>
                    Browser speech recognition may send audio to its service.
                    Stop anytime.
                  </span>
                </div>
                {recording.supported && (
                  <div className="voice-controls">
                    <button
                      type="button"
                      className="voice-button"
                      disabled={
                        !active ||
                        submitAnswer.isPending ||
                        voice.listening ||
                        recording.status === "starting" ||
                        recording.status === "uploading"
                      }
                      onClick={() => {
                        if (recording.status === "recording") recording.stop();
                        else {
                          recordedBase.current = draft.trim();
                          setSpeechMetrics(null);
                          void recording.start();
                        }
                      }}
                    >
                      <Mic size={16} />{" "}
                      {recording.status === "recording"
                        ? "Stop & transcribe"
                        : recording.status === "uploading"
                          ? "Transcribing..."
                          : recording.status === "starting"
                            ? "Starting microphone..."
                            : "Record with Groq"}
                    </button>
                    <span>
                      Audio is sent to Groq for transcription when recording
                      stops (up to 2 minutes / 4 MB).
                    </span>
                  </div>
                )}
                {recording.error && (
                  <p className="voice-error" role="alert">
                    {recording.error}
                  </p>
                )}
                {voice.error && (
                  <p className="voice-error" role="alert">
                    {voice.error}
                  </p>
                )}
                <div className="answer-footer">
                  <span>{draft.length} / 12,000 characters</span>
                  <button
                    type="submit"
                    disabled={
                      !active ||
                      !draft.trim() ||
                      submitAnswer.isPending ||
                      voiceBusy
                    }
                    className="button button-dark"
                  >
                    {submitAnswer.isPending
                      ? "Reviewing answer..."
                      : "Submit answer"}{" "}
                    <ArrowRight size={17} />
                  </button>
                </div>
                {submitAnswer.isPending && (
                  <div className="stream-note" role="status">
                    <Sparkles size={16} />
                    <div>
                      <strong>Thinking through your answer</strong>
                      <p>{preview || "Your feedback is on its way..."}</p>
                      {preview && (
                        <small>
                          Draft preview · final feedback may change.
                        </small>
                      )}
                    </div>
                  </div>
                )}
                {submitAnswer.isError && (
                  <ErrorState
                    message={`${submitAnswer.error.message} Refresh the session before retrying in case your answer was saved.`}
                    retry={() => {
                      void detail.refetch().then((result) => {
                        if (
                          result.data?.turns.some(
                            (turn) =>
                              turn.question.id === active?.id && turn.answer,
                          )
                        ) {
                          setQuestion(null);
                          clear();
                        }
                        submitAnswer.reset();
                      });
                    }}
                  />
                )}
              </form>
            </>
          )}
        </div>
        <aside className="interview-aside">
          <div className="aside-card">
            <span className="aside-icon">
              <MessageSquareText size={20} />
            </span>
            <h3>A little reminder</h3>
            <p>
              There’s no pressure to get it perfect. Explain your thinking, use
              an example, and be yourself.
            </p>
            <div className="aside-divider" />
            <span className="aside-label">BEFORE YOU ANSWER</span>
            <ul>
              <li>
                <CheckCircle2 size={15} /> Take a moment to think
              </li>
              <li>
                <CheckCircle2 size={15} /> Be clear and specific
              </li>
              <li>
                <CheckCircle2 size={15} /> Share your reasoning
              </li>
            </ul>
          </div>
          <div className="aside-note">
            <Clock3 size={15} /> The 2-minute timer is a guide, not a hard
            limit.
          </div>
        </aside>
      </div>
      <CameraCoaching interviewId={id} />
    </div>
  );
}
/** Display a non-enforced two-minute practice timer for the current question. */
function QuestionTimer() {
  const [seconds, setSeconds] = useState(120);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(
      () =>
        setSeconds(
          Math.max(0, 120 - Math.floor((Date.now() - started) / 1000)),
        ),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  return (
    <span
      className={`question-timer ${seconds === 0 ? "expired" : ""}`}
      aria-label={`Practice timer: ${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds`}
    >
      <Clock3 size={14} />
      {String(Math.floor(seconds / 60)).padStart(2, "0")}:
      {String(seconds % 60).padStart(2, "0")}
    </span>
  );
}

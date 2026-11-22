// Interview setup form and session creation.
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  BriefcaseBusiness,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { apiRequest } from "../services/api";
import { useCurrentUser } from "../services/queries";
import type { CreateInterview, Interview, Resume } from "../services/types";
import { ErrorState, Eyebrow } from "../components/ui";
const rounds = [
  {
    id: "technical",
    title: "Technical",
    desc: "Skills & problem solving",
    icon: BrainCircuit,
  },
  {
    id: "hr",
    title: "HR",
    desc: "Motivation & workplace",
    icon: BriefcaseBusiness,
  },
  {
    id: "behavioral",
    title: "Behavioral",
    desc: "Experiences & decisions",
    icon: MessageCircle,
  },
];
/** Collect a role and preferences before creating an interview. */
export function Setup() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [role, setRole] = useState(user.data?.targetRole ?? "");
  const [roundType, setRoundType] = useState("technical");
  const [difficulty, setDifficulty] = useState("medium");
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [jdText, setJdText] = useState("");
  const [resumeId, setResumeId] = useState("");
  const resumes = useQuery({
    queryKey: ["resumes"],
    queryFn: () => apiRequest<Resume[]>("/resumes"),
    retry: false,
  });
  const create = useMutation({
    mutationFn: (input: CreateInterview) =>
      apiRequest<Interview>("/interviews", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: async (interview) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["interviews"] }),
        client.invalidateQueries({ queryKey: ["analytics"] }),
      ]);
      navigate(`/app/interview/${interview.id}`);
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate({
      role: role.trim(),
      roundType,
      difficulty,
      totalQuestions,
      ...(jdText.trim() ? { jdText: jdText.trim() } : {}),
      ...(resumeId ? { resumeId } : {}),
    });
  }
  return (
    <div className="page narrow-page">
      <Link className="back-link" to="/app">
        <ArrowLeft size={15} /> Back to dashboard
      </Link>
      <div className="setup-header">
        <Eyebrow>MAKE IT YOURS</Eyebrow>
        <h1>
          Let’s set the scene<span className="heading-dot">.</span>
        </h1>
        <p>
          A few details help us make your practice session feel more relevant.
        </p>
      </div>
      <form onSubmit={submit} className="setup-form">
        <section className="form-panel">
          <div className="form-section-heading">
            <span>01</span>
            <div>
              <h2>What role are you preparing for?</h2>
              <p>We’ll tailor your questions to this role.</p>
            </div>
          </div>
          <label className="field-label">
            Target role
            <input
              required
              maxLength={120}
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="e.g. Frontend developer"
            />
          </label>
        </section>
        <section className="form-panel">
          <div className="form-section-heading">
            <span>02</span>
            <div>
              <h2>Choose your interview type</h2>
              <p>Pick the conversation you want to practice.</p>
            </div>
          </div>
          <div className="choice-grid">
            {rounds.map(({ id, title, desc, icon: Icon }) => (
              <button
                type="button"
                key={id}
                aria-pressed={roundType === id}
                className={`choice-card ${roundType === id ? "selected" : ""}`}
                onClick={() => setRoundType(id)}
              >
                <span className="choice-icon">
                  <Icon size={20} />
                </span>
                <strong>{title}</strong>
                <small>{desc}</small>
                <span className="choice-check" />
              </button>
            ))}
          </div>
        </section>
        <section className="form-panel">
          <div className="form-section-heading">
            <span>03</span>
            <div>
              <h2>Set your pace</h2>
              <p>There’s no wrong place to begin.</p>
            </div>
          </div>
          <div className="form-columns">
            <div>
              <label className="field-label">Difficulty</label>
              <div className="segmented">
                {["easy", "medium", "hard"].map((item) => (
                  <button
                    type="button"
                    key={item}
                    aria-pressed={difficulty === item}
                    className={difficulty === item ? "selected" : ""}
                    onClick={() => setDifficulty(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <label className="field-label">
              Number of questions
              <select
                value={totalQuestions}
                onChange={(event) =>
                  setTotalQuestions(Number(event.target.value))
                }
              >
                {[3, 5, 8, 10].map((value) => (
                  <option value={value} key={value}>
                    {value} questions
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field-label optional-field">
            Resume <span>OPTIONAL</span>
            <select
              value={resumeId}
              onChange={(event) => setResumeId(event.target.value)}
            >
              <option value="">No resume</option>
              {resumes.data?.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  Resume from {new Date(resume.createdAt).toLocaleDateString()}
                </option>
              ))}
            </select>
            <small>
              Selected resume text is sent to the AI provider for interview
              questions and evaluations.{" "}
              <Link className="text-link" to="/app/resumes">
                Manage resumes
              </Link>
            </small>
          </label>
          {resumes.isError && (
            <p className="voice-error">
              Could not load resumes; you can continue without one.
            </p>
          )}
          <label className="field-label optional-field">
            Job description <span>OPTIONAL</span>
            <textarea
              maxLength={12000}
              rows={4}
              value={jdText}
              onChange={(event) => setJdText(event.target.value)}
              placeholder="Paste a job description to help tailor your questions..."
            />
            <small>
              Only include details you’re comfortable sending to the AI
              provider.
            </small>
          </label>
        </section>
        {create.isError && <ErrorState message={create.error.message} />}
        <div className="setup-bottom">
          <p>
            <Sparkles size={16} /> You can take your time with every answer.
          </p>
          <button
            className="button button-dark"
            disabled={create.isPending || !role.trim()}
            type="submit"
          >
            {create.isPending ? "Getting ready..." : "Begin interview"}{" "}
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </div>
  );
}

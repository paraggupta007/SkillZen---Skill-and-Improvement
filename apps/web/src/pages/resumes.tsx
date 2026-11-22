// Resume upload and optional job description comparison.
import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Trash2, Upload, Sparkles } from "lucide-react";
import { apiRequest } from "../services/api";
import type { Resume, ResumeAnalysis } from "../services/types";
import { ErrorState, Eyebrow, formatDate, Loading } from "../components/ui";
/** Upload a resume, review optional AI coaching and remove stored text. */
export function ResumesPage() {
  const client = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [consent, setConsent] = useState(false);
  const [selected, setSelected] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const resumes = useQuery({
    queryKey: ["resumes"],
    queryFn: () => apiRequest<Resume[]>("/resumes"),
  });
  const upload = useMutation({
    mutationFn: (pdf: File) =>
      apiRequest<Resume>("/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: pdf,
      }),
    onSuccess: async (resume) => {
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setConsent(false);
      setSelected(resume.id);
      await client.invalidateQueries({ queryKey: ["resumes"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/resumes/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setSelected("");
      analysis.reset();
      await client.invalidateQueries({ queryKey: ["resumes"] });
    },
  });
  const analysis = useMutation({
    mutationFn: () =>
      apiRequest<ResumeAnalysis>(`/resumes/${selected}/analyze`, {
        method: "POST",
        body: JSON.stringify({ jobDescription }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["resumes"] }),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (file && consent && file.size <= 5 * 1024 * 1024) upload.mutate(file);
  }
  return (
    <div className="page narrow-page">
      <Link to="/app" className="back-link">
        <ArrowLeft size={15} /> Back to dashboard
      </Link>
      <div className="setup-header">
        <Eyebrow>PREPARE WITH CONTEXT</Eyebrow>
        <h1>
          Your resume<span className="heading-dot">.</span>
        </h1>
        <p>
          Bring your experience into your practice, and find useful next steps.
        </p>
      </div>
      <form className="form-panel" onSubmit={submit}>
        <div className="form-section-heading">
          <span>01</span>
          <div>
            <h2>Upload a text-based PDF</h2>
            <p>Maximum 5 MB and 10 pages. Scanned images are not supported.</p>
          </div>
        </div>
        <label className="field-label">
          Choose PDF
          <input
            type="file"
            ref={fileInput}
            accept="application/pdf,.pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        {file && file.size > 5 * 1024 * 1024 && (
          <p className="voice-error" role="alert">
            Choose a PDF smaller than 5 MB.
          </p>
        )}
        <label className="resume-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <span>
            I understand extracted resume text is stored in my account until I
            delete it. If I analyze it or use it for an interview, text is sent
            to the configured AI provider.
          </span>
        </label>
        {upload.isError && <ErrorState message={upload.error.message} />}
        <button
          type="submit"
          className="button button-dark button-small"
          disabled={
            !file || !consent || file.size > 5 * 1024 * 1024 || upload.isPending
          }
        >
          <Upload size={15} />
          {upload.isPending ? "Uploading..." : "Upload resume"}
        </button>
      </form>
      <section className="form-panel resume-section">
        <div className="form-section-heading">
          <span>02</span>
          <div>
            <h2>Choose a saved resume</h2>
            <p>
              Deleting removes stored resume text; generated interview content
              may still contain information derived from it.
            </p>
          </div>
        </div>
        {resumes.isLoading ? (
          <Loading />
        ) : resumes.isError ? (
          <ErrorState
            message={resumes.error.message}
            retry={() => void resumes.refetch()}
          />
        ) : !resumes.data?.length ? (
          <p className="resume-muted">No saved resumes yet.</p>
        ) : (
          <div className="resume-list">
            {resumes.data.map((resume) => (
              <div className="resume-row" key={resume.id}>
                <FileText size={20} />
                <label>
                  <input
                    type="radio"
                    name="resume"
                    checked={selected === resume.id}
                    onChange={() => {
                      setSelected(resume.id);
                      analysis.reset();
                    }}
                  />
                  <span>Resume · {formatDate(resume.createdAt)}</span>
                </label>
                <button
                  type="button"
                  className="voice-button"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (
                      window.confirm("Delete this resume and its stored text?")
                    )
                      remove.mutate(resume.id);
                  }}
                  aria-label={`Delete resume from ${formatDate(resume.createdAt)}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
        {remove.isError && <ErrorState message={remove.error.message} />}
      </section>
      <section className="form-panel resume-section">
        <div className="form-section-heading">
          <span>03</span>
          <div>
            <h2>Get constructive feedback</h2>
            <p>Optionally compare your resume with a job description.</p>
          </div>
        </div>
        <label className="field-label">
          Job description <span>OPTIONAL</span>
          <textarea
            rows={5}
            maxLength={12000}
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder="Paste the role description here..."
          />
        </label>
        <p className="resume-muted resume-disclaimer">
          Analyzing sends your resume text and job description to the configured
          AI provider. Feedback and any match score are estimates, not an ATS
          result or hiring decision.
        </p>
        <button
          type="button"
          className="button button-dark button-small"
          disabled={!selected || analysis.isPending}
          onClick={() => analysis.mutate()}
        >
          <Sparkles size={15} />
          {analysis.isPending ? "Analyzing..." : "Analyze resume"}
        </button>
        {analysis.isError && <ErrorState message={analysis.error.message} />}{" "}
        {analysis.data && (
          <div className="resume-results">
            <h3>
              Coaching summary{" "}
              {analysis.data.matchScore !== null && (
                <span>· {analysis.data.matchScore}% estimated match</span>
              )}
            </h3>
            <p>{analysis.data.summary}</p>
            {(
              [
                ["Skills", analysis.data.skills],
                ["Strengths", analysis.data.strengths],
                ["Areas to improve", analysis.data.gaps],
                ["Suggestions", analysis.data.suggestions],
              ] as const
            ).map(([title, items]) => (
              <div key={title}>
                <h4>{title}</h4>
                {items.length ? (
                  <ul>
                    {items.map((item, i) => (
                      <li key={`${i}-${item}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>None identified.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

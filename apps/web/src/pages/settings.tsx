// Account settings and explicit account-data deletion.
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck, Trash2 } from "lucide-react";
import { apiRequest } from "../services/api";
import { useCurrentUser } from "../services/queries";
import { useInterviewStore } from "../store/interview-store";
import { ErrorState, Eyebrow } from "../components/ui";
/** Let a signed-in user permanently remove their account after reauthentication. */
export function SettingsPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [understood, setUnderstood] = useState(false);
  const deletion = useMutation({
    mutationFn: () =>
      apiRequest<{ deleted: boolean }>("/users/me", {
        method: "DELETE",
        body: JSON.stringify({ password }),
      }),
    onSuccess: () => {
      setPassword("");
      useInterviewStore.getState().clear();
      client.clear();
      navigate("/", { replace: true, state: { accountDeleted: true } });
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (understood && confirmation === "DELETE" && password) deletion.mutate();
  }
  return (
    <div className="page narrow-page">
      <Link to="/app" className="back-link">
        <ArrowLeft size={15} /> Back to dashboard
      </Link>
      <div className="setup-header">
        <Eyebrow>YOUR ACCOUNT</Eyebrow>
        <h1>
          Account settings<span className="heading-dot">.</span>
        </h1>
        <p>Manage your account and the data you keep with SkillZen.</p>
      </div>
      <section className="form-panel account-overview">
        <div className="form-section-heading">
          <span>
            <ShieldCheck size={18} />
          </span>
          <div>
            <h2>Your profile</h2>
            <p>
              Signed in as {user.data?.name} · {user.data?.email}
            </p>
          </div>
        </div>
      </section>
      <section className="form-panel account-danger">
        <div className="form-section-heading">
          <span>
            <Trash2 size={18} />
          </span>
          <div>
            <h2>Delete your account</h2>
            <p>This action is permanent and cannot be undone.</p>
          </div>
        </div>
        <p>
          Deleting your account removes your profile, resumes, interviews,
          answers, reports, camera counts, question feedback and mock tests from
          the app’s database. You will be signed out.
        </p>
        <p>
          Copies already downloaded, backups, operational logs and information
          sent to AI or transcription providers may remain under their own
          retention policies. In-flight requests may already have sent data.
        </p>
        <form onSubmit={submit}>
          <label className="field-label">
            Current password
            <input
              type="password"
              autoComplete="current-password"
              required
              maxLength={72}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="field-label">
            Type DELETE to confirm
            <input
              type="text"
              autoComplete="off"
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          <label className="resume-consent">
            <input
              type="checkbox"
              checked={understood}
              onChange={(event) => setUnderstood(event.target.checked)}
            />
            <span>
              I understand that my account and app data will be permanently
              deleted.
            </span>
          </label>
          {deletion.isError && <ErrorState message={deletion.error.message} />}
          <button
            type="submit"
            className="button button-delete"
            disabled={
              !password ||
              confirmation !== "DELETE" ||
              !understood ||
              deletion.isPending
            }
          >
            <Trash2 size={16} />
            {deletion.isPending ? "Deleting account..." : "Delete my account"}
          </button>
        </form>
      </section>
    </div>
  );
}

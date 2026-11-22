// Public introduction to SkillZen and its current capabilities.
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiRequest } from "../services/api";
import { useCurrentUser } from "../services/queries";
import { useInterviewStore } from "../store/interview-store";
import {
  ArrowDown,
  ArrowRight,
  AudioLines,
  Check,
  CircleCheck,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { Brand } from "../components/layout";
import { Eyebrow } from "../components/ui";
/** Public landing page with a clearly marked illustrative interview preview. */
export function Landing() {
  const user = useCurrentUser();
  const location = useLocation();
  const client = useQueryClient();
  const navigate = useNavigate();
  const logout = useMutation({
    mutationFn: () => apiRequest("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      useInterviewStore.getState().clear();
      client.clear();
      navigate("/login");
    },
  });
  const guest = user.error instanceof ApiError && user.error.status === 401;
  const signedIn = !!user.data && !user.isError;
  const sessionUnavailable = user.isError && !guest;
  return (
    <div className="landing">
      <header className="landing-header">
        <Brand />
        <nav aria-label="Public navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#features">The experience</a>
          <Link to="/contact">Contact</Link>
        </nav>
        <div className="landing-actions">
          {signedIn ? (
            <>
              <span className="landing-user">Hi, {user.data.name}</span>
              <Link className="button button-dark button-small" to="/app">
                Dashboard <ArrowRight size={15} />
              </Link>
              <button
                type="button"
                className="landing-signout"
                aria-label="Sign out on all devices"
                title="Signs out all devices"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                Sign out all
              </button>
            </>
          ) : guest ? (
            <>
              <Link className="header-login" to="/login">
                Log in
              </Link>
              <Link className="button button-dark button-small" to="/register">
                Get started <ArrowRight size={15} />
              </Link>
            </>
          ) : sessionUnavailable ? (
            <button
              type="button"
              className="landing-session-retry"
              onClick={() => void user.refetch()}
            >
              Retry session check
            </button>
          ) : (
            <span className="landing-session-status" role="status">
              Checking session...
            </span>
          )}
        </div>
      </header>
      {location.state?.accountDeleted === true && (
        <p className="landing-account-deleted" role="status">
          Your account and its app data have been deleted.
        </p>
      )}
      {sessionUnavailable && (
        <p className="landing-session-message" role="alert">
          We couldn’t check your session. Please try again.
        </p>
      )}
      {logout.isError && (
        <p className="landing-session-message" role="alert">
          Could not sign out. Please try again.
        </p>
      )}
      <main>
        <section className="hero">
          <div className="hero-copy">
            <Eyebrow>YOUR PRACTICE SPACE</Eyebrow>
            <h1>
              Better interviews
              <br />
              <em>start here.</em>
            </h1>
            <p>
              Build confidence one answer at a time. Practice real interview
              questions, get thoughtful AI feedback, and see how far you’ve
              come.
            </p>
            <div className="hero-actions">
              <Link
                className="button button-dark"
                to={guest ? "/register" : "/app"}
              >
                {signedIn ? "Continue practicing" : "Start practicing"}{" "}
                <ArrowRight size={17} />
              </Link>
              <a className="button button-ghost" href="#how-it-works">
                See how it works <ArrowDown size={16} />
              </a>
            </div>
            <div className="hero-footnote">
              <span className="footnote-icon">
                <Check size={14} />
              </span>{" "}
              Practice at your own pace <span className="footnote-dot">•</span>{" "}
              Feedback you can act on
            </div>
          </div>
          <div
            className="hero-visual"
            aria-label="Illustrative interview preview"
          >
            <div className="visual-orbit orbit-one" />
            <div className="visual-orbit orbit-two" />
            <div className="visual-spark">
              <Sparkles size={20} />
            </div>
            <div className="preview-card">
              <div className="preview-top">
                <span className="preview-avatar">
                  <Sparkles size={16} />
                </span>
                <span>
                  <strong>Your practice session</strong>
                  <small>ILLUSTRATIVE PREVIEW</small>
                </span>
                <span className="preview-live">
                  <span /> In progress
                </span>
              </div>
              <div className="preview-question">
                <div className="preview-kicker">
                  QUESTION 01 <span>·</span> TECHNICAL
                </div>
                <h2>How would you explain a complex idea simply?</h2>
                <div className="preview-lines">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
              <div className="preview-answer">
                <span className="preview-answer-icon">
                  <AudioLines size={18} />
                </span>
                <div>
                  <small>YOUR ANSWER</small>
                  <span>Thoughtful practice starts here...</span>
                </div>
              </div>
              <div className="preview-bottom">
                <span>
                  <span /> AI feedback ready
                </span>
                <strong>
                  Keep going <ArrowRight size={14} />
                </strong>
              </div>
            </div>
            <div className="floating-note">
              <span>
                <TrendingUp size={18} />
              </span>
              <div>
                <strong>Small steps, real growth</strong>
                <small>Build your confidence over time</small>
              </div>
            </div>
          </div>
        </section>
        <section className="trust-strip">
          <span>MADE FOR YOUR NEXT STEP</span>
          <p>
            <CircleCheck size={16} /> Practice without pressure
          </p>
          <p>
            <CircleCheck size={16} /> Feedback after every answer
          </p>
          <p>
            <CircleCheck size={16} /> Your progress, in one place
          </p>
        </section>
        <section className="feature-section" id="how-it-works">
          <div className="section-heading">
            <div>
              <Eyebrow>THE PROCESS</Eyebrow>
              <h2>Practice with purpose.</h2>
            </div>
            <p>
              Skip the guesswork. A calmer, more focused way to prepare for
              what’s next.
            </p>
          </div>
          <div className="steps-grid">
            <article className="step-card">
              <div className="step-top">
                <span className="step-icon mint">
                  <Target size={21} />
                </span>
                <span>01 / SET UP</span>
              </div>
              <h3>Make it yours.</h3>
              <p>
                Choose your role, interview type, difficulty and number of
                questions. Add a job description for context.
              </p>
            </article>
            <article className="step-card">
              <div className="step-top">
                <span className="step-icon peach">
                  <MessageSquareText size={21} />
                </span>
                <span>02 / PRACTICE</span>
              </div>
              <h3>Find your words.</h3>
              <p>
                Work through tailored questions at your own pace and receive
                feedback for each answer.
              </p>
            </article>
            <article className="step-card">
              <div className="step-top">
                <span className="step-icon lavender">
                  <TrendingUp size={21} />
                </span>
                <span>03 / IMPROVE</span>
              </div>
              <h3>See your progress.</h3>
              <p>
                Reflect on strengths, focus areas and practical next steps in
                your interview report.
              </p>
            </article>
          </div>
        </section>
        <section className="closing-section" id="features">
          <div>
            <Eyebrow>GROW WITH INTENTION</Eyebrow>
            <h2>
              Your next opportunity
              <br />
              <em>is worth preparing for.</em>
            </h2>
            <p>
              Make preparation more personal with mock tests, voice practice and
              optional, privacy-conscious camera observations.
            </p>
            <Link
              to={guest ? "/register" : "/app"}
              className="button button-light"
            >
              {signedIn
                ? "Go to dashboard"
                : guest
                  ? "Create your account"
                  : "Go to your workspace"}{" "}
              <ArrowRight size={17} />
            </Link>
          </div>
          <div className="closing-aside">
            <ShieldCheck size={28} />
            <strong>Practice should feel safe.</strong>
            <p>
              Camera coaching is optional. Video is processed on your device;
              only the aggregate counts you choose to save are shared.
            </p>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand />
        <span>Built for practice. Made for progress.</span>
        <Link className="footer-contact" to="/contact">
          Contact the developer
        </Link>
        <span>© {new Date().getFullYear()} SkillZen</span>
      </footer>
    </div>
  );
}

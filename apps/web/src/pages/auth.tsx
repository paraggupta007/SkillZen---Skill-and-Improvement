// Sign-in and registration forms backed by the authenticated API.
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { Brand } from "../components/layout";
import { ErrorState } from "../components/ui";
import { apiRequest } from "../services/api";
import type { User } from "../services/types";
/** Sign-in or registration page, selected by the route. */
export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const register = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const client = useQueryClient();
  const auth = useMutation({
    mutationFn: () =>
      apiRequest<User>(register ? "/auth/register" : "/auth/login", {
        method: "POST",
        body: JSON.stringify(
          register ? { name, email, password } : { email, password },
        ),
      }),
    onSuccess: (user) => {
      client.setQueryData(["me"], user);
      navigate("/app");
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    auth.mutate();
  }
  return (
    <div className="auth-layout">
      <div className="auth-main">
        <div className="auth-top">
          <Brand />
          <Link to="/" className="back-link">
            <ArrowLeft size={15} /> Back to home
          </Link>
        </div>
        <div className="auth-form-wrap">
          <span className="auth-icon">
            <Sparkles size={20} />
          </span>
          <div className="auth-kicker">
            {register ? "YOUR NEXT CHAPTER" : "WELCOME BACK"}
          </div>
          <h1>
            {register ? "Let’s get you started." : "Good to see you again."}
          </h1>
          <p>
            {register
              ? "Create an account and make your next interview feel a little more familiar."
              : "Pick up where you left off and keep building confidence."}
          </p>
          <form className="auth-form" onSubmit={submit}>
            {register && (
              <label>
                Full name
                <input
                  autoComplete="name"
                  required
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={320}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  register ? "At least 8 characters" : "Your password"
                }
              />
            </label>
            {auth.isError && <ErrorState message={auth.error.message} />}
            <button
              className="button button-dark auth-submit"
              disabled={auth.isPending}
              type="submit"
            >
              {auth.isPending
                ? "Please wait..."
                : register
                  ? "Create account"
                  : "Log in"}{" "}
              <ArrowRight size={17} />
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to SkillZen?"}{" "}
            <Link to={register ? "/login" : "/register"}>
              {register ? "Log in" : "Create an account"}
            </Link>
          </p>
        </div>
        <div className="auth-footer">Thoughtful preparation starts here.</div>
      </div>
      <aside className="auth-aside">
        <div className="auth-aside-inner">
          <span className="auth-aside-icon">
            <Sparkles size={24} />
          </span>
          <h2>
            A little practice.
            <br />
            <em>A lot more confidence.</em>
          </h2>
          <p>
            Preparation isn’t about having perfect answers. It’s about showing
            up ready to share your best thinking.
          </p>
          <ul>
            <li>
              <Check size={17} /> Practice at your own pace
            </li>
            <li>
              <Check size={17} /> Learn from useful feedback
            </li>
            <li>
              <Check size={17} /> Track your improvement
            </li>
          </ul>
          <div className="auth-aside-bottom">
            YOUR JOURNEY, YOUR PACE <span>✳</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

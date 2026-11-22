// Public branding and authenticated navigation layout.
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  LayoutDashboard,
  FileText,
  LogOut,
  Plus,
  Sparkles,
} from "lucide-react";
import { apiRequest } from "../services/api";
import { useCurrentUser } from "../services/queries";
/** Product wordmark linked to the landing page. */
export function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link
      to="/"
      className={`brand ${inverted ? "brand-light" : ""}`}
      aria-label="SkillZen home"
    >
      <span className="brand-mark">
        <Sparkles size={16} />
      </span>
      <span>
        skill<span>zen</span>
        <small>SKILL & IMPROVEMENT</small>
      </span>
    </Link>
  );
}
/** Navigation and page frame for signed-in screens. */
export function AppLayout() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const client = useQueryClient();
  const logout = useMutation({
    mutationFn: () => apiRequest("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      client.clear();
      navigate("/login");
    },
  });
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand inverted />
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <NavLink to="/app" end>
            <LayoutDashboard size={18} /> Dashboard
          </NavLink>
          <NavLink to="/app/setup">
            <Plus size={18} /> New interview
          </NavLink>
          <NavLink to="/app/resumes">
            <FileText size={18} /> Resumes
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="side-note">
            <span className="side-note-icon">
              <Sparkles size={17} />
            </span>
            <strong>Progress, not perfection.</strong>
            <p>Every practice session is a step forward.</p>
            <Link to="/app/setup">
              Start practicing <ArrowUpRight size={14} />
            </Link>
          </div>
          <button
            className="profile-button"
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <span className="avatar">
              {user.data?.name?.slice(0, 1).toUpperCase() || "S"}
            </span>
            <span>
              <strong>{user.data?.name ?? "Your account"}</strong>
              <small>Sign out</small>
            </span>
            <LogOut size={16} />
          </button>
          {logout.isError && (
            <p className="sidebar-error" role="alert">
              Could not sign out. Please try again.
            </p>
          )}
        </div>
      </aside>
      <div className="app-main">
        <header className="mobile-header">
          <Brand />
          <div className="mobile-actions">
            <Link to="/app" className="back-link">
              Dashboard
            </Link>
            <Link to="/app/resumes" className="back-link">
              Resumes
            </Link>
            <Link to="/app/setup" className="button button-small button-dark">
              New interview
            </Link>
            <button
              type="button"
              className="mobile-logout"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              aria-label="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        {logout.isError && (
          <p className="mobile-logout-error" role="alert">
            Could not sign out. Please try again.
          </p>
        )}
        <main className="workspace">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

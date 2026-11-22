// Public branding and authenticated navigation layout.
import { useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  LayoutDashboard,
  FileText,
  ListChecks,
  Menu,
  X,
  Mail,
  Settings,
  LogOut,
  Plus,
  Sparkles,
} from "lucide-react";
import { apiRequest } from "../services/api";
import { useInterviewStore } from "../store/interview-store";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggle = useRef<HTMLButtonElement>(null);
  const user = useCurrentUser();
  const navigate = useNavigate();
  const client = useQueryClient();
  const logout = useMutation({
    mutationFn: () => apiRequest("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      useInterviewStore.getState().clear();
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
          <NavLink to="/app/mock-tests">
            <ListChecks size={18} /> Mock tests
          </NavLink>
          <NavLink to="/app/resumes">
            <FileText size={18} /> Resumes
          </NavLink>
          <NavLink to="/app/settings">
            <Settings size={18} /> Account settings
          </NavLink>
          <NavLink to="/contact">
            <Mail size={18} /> Contact developer
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
        <header
          className="mobile-header"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setMenuOpen(false);
              menuToggle.current?.focus();
            }
          }}
        >
          <div className="mobile-header-top">
            <Brand />
            <button
              type="button"
              ref={menuToggle}
              className="mobile-menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}{" "}
              <span>{menuOpen ? "Close" : "Menu"}</span>
            </button>
          </div>
          <nav
            id="mobile-navigation"
            aria-label="Mobile navigation"
            className="mobile-navigation"
            hidden={!menuOpen}
          >
            <NavLink to="/app" end onClick={() => setMenuOpen(false)}>
              Dashboard
            </NavLink>
            <NavLink to="/app/setup" onClick={() => setMenuOpen(false)}>
              New interview
            </NavLink>
            <NavLink to="/app/mock-tests" onClick={() => setMenuOpen(false)}>
              Mock tests
            </NavLink>
            <NavLink to="/app/resumes" onClick={() => setMenuOpen(false)}>
              Resumes
            </NavLink>
            <NavLink to="/app/settings" onClick={() => setMenuOpen(false)}>
              Account settings
            </NavLink>
            <NavLink to="/contact" onClick={() => setMenuOpen(false)}>
              Contact developer
            </NavLink>
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              <LogOut size={17} /> Sign out
            </button>
          </nav>
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

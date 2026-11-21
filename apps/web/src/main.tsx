// Entry point for the initial frontend scaffold.
import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <main className="mx-auto max-w-3xl px-6 py-24">
      <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
        SkillZen
      </p>
      <h1 className="mt-4 text-4xl font-bold">
        Practice with purpose. Improve with confidence.
      </h1>
      <p className="mt-6 text-slate-600">
        AI mock interviews, actionable feedback, and mock tests are on the
        roadmap. The application is under construction.
      </p>
    </main>
  </React.StrictMode>,
);

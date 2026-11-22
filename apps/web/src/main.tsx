// Browser application entry point, routing and shared query cache.
import { lazy, Suspense } from "react";
import { Loading } from "./components/ui";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout";
import { ProtectedRoute } from "./components/protected-route";
import { Landing } from "./pages/landing";
import { AuthPage } from "./pages/auth";
const Dashboard = lazy(() =>
  import("./pages/dashboard").then((module) => ({ default: module.Dashboard })),
);
import { ResumesPage } from "./pages/resumes";
import { Setup } from "./pages/setup";
import { InterviewPage } from "./pages/interview";
import { ReportPage } from "./pages/report";
import "./style.css";
const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppLayout />}>
            <Route
              index
              element={
                <Suspense fallback={<Loading />}>
                  <Dashboard />
                </Suspense>
              }
            />
            <Route path="resumes" element={<ResumesPage />} />
            <Route path="setup" element={<Setup />} />
            <Route path="interview/:id" element={<InterviewPage />} />
            <Route path="report/:id" element={<ReportPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>,
);

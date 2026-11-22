// User-facing resume consent, upload, analysis and deletion flow.
// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ResumesPage } from "../src/pages/resumes";
const resume = {
  id: "r1",
  fileName: "resume.pdf",
  parsedSkills: [],
  matchScore: null,
  createdAt: "2025-01-01T00:00:00Z",
};
function json(data: unknown) {
  return new Response(JSON.stringify({ success: true, data, error: null }));
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("requires consent and supports upload, AI analysis and deletion", async () => {
  let saved = false;
  const fetcher = vi
    .fn()
    .mockImplementation((url: string, options: RequestInit) => {
      if (url.endsWith("/resumes") && options.method === "POST") {
        saved = true;
        return Promise.resolve(json(resume));
      }
      if (url.endsWith("/analyze"))
        return Promise.resolve(
          json({
            skills: ["TypeScript"],
            strengths: ["Good projects"],
            gaps: [],
            suggestions: ["Add details"],
            summary: "Good start",
            matchScore: 80,
          }),
        );
      if (options.method === "DELETE") {
        saved = false;
        return Promise.resolve(json({ deleted: true }));
      }
      return Promise.resolve(json(saved ? [resume] : []));
    });
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ResumesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const actor = userEvent.setup();
  await screen.findByText("No saved resumes yet.");
  await actor.upload(
    screen.getByLabelText("Choose PDF"),
    new File(["pdf"], "resume.pdf", { type: "application/pdf" }),
  );
  expect(
    (
      screen.getByRole("button", {
        name: /upload resume/i,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await actor.click(screen.getByRole("checkbox"));
  await actor.click(screen.getByRole("button", { name: /upload resume/i }));
  await screen.findByText(/Resume ·/);
  await actor.type(
    screen.getByLabelText(/job description/i),
    "TypeScript developer",
  );
  await actor.click(screen.getByRole("button", { name: /analyze resume/i }));
  await screen.findByText("Good projects");
  expect(screen.getByText(/80% estimated match/)).toBeTruthy();
  await actor.click(screen.getByRole("button", { name: /delete resume/i }));
  await waitFor(() =>
    expect(screen.getByText("No saved resumes yet.")).toBeTruthy(),
  );
});

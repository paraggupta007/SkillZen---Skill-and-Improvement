// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MockTestPage, MockTestsPage } from "../src/pages/mock-tests";
const attempt = {
  id: "abc",
  topic: "web",
  total: 3,
  score: null,
  createdAt: "2026-01-01T00:00:00Z",
  completedAt: null,
  questions: Array.from({ length: 3 }, (_, i) => ({
    prompt: `Question prompt ${i + 1}`,
    options: ["First", "Second"],
  })),
};
const json = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, error: null }), {
    headers: { "Content-Type": "application/json" },
  });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("mock tests page", () => {
  it("sets up a test and submits answers for feedback", async () => {
    const fetchMock = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        const path = String(url);
        if (path.endsWith("/feedback")) {
          if (init?.method === "PUT")
            return json({ feedback: { rating: 4, comment: "Clear option" } });
          if (init?.method === "DELETE") return json({ deleted: true });
          return json({ feedback: null });
        }
        if (path.endsWith("/submit")) {
          expect(JSON.parse(String(init?.body))).toEqual({
            answers: [0, null, null],
          });
          return json({
            ...attempt,
            score: 1,
            completedAt: "2026-01-01T00:00:00Z",
            questions: attempt.questions.map((q, i) => ({
              ...q,
              selected: i === 0 ? 0 : null,
              correct: 0,
              explanation: "Explanation here",
            })),
          });
        }
        if (path.endsWith("/abc")) return json(attempt);
        if (init?.method === "POST") return json(attempt);
        return json([]);
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/app/mock-tests"]}>
          <Routes>
            <Route path="/app/mock-tests" element={<MockTestsPage />} />
            <Route path="/app/mock-tests/:id" element={<MockTestPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await screen.findByText("No attempts yet.");
    await user.selectOptions(screen.getByLabelText("Topic"), "web");
    await user.selectOptions(screen.getByLabelText("Number of questions"), "3");
    await user.click(screen.getByRole("button", { name: "Start test" }));
    await screen.findByText("Question prompt 1");
    await user.click(screen.getAllByRole("radio", { name: "First" })[0]!);
    await user.click(screen.getByRole("button", { name: "Submit test" }));
    await screen.findByText(/Your score: 1 of 3 correct/);
    expect(screen.getAllByText("Explanation here")).toHaveLength(3);
    await user.click(screen.getAllByText("Rate option 1: First")[0]!);
    const rating = await screen.findByRole("radio", { name: "4" });
    await user.click(rating);
    await user.type(
      screen.getByLabelText("Comment (optional)"),
      "Clear option",
    );
    await user.click(screen.getByRole("button", { name: "Save feedback" }));
    await screen.findByText("Option feedback saved.");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/mock-tests/abc/questions/0/options/0/feedback"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ rating: 4, comment: "Clear option" }),
      }),
    );
    await user.click(screen.getByRole("button", { name: "Delete feedback" }));
    await screen.findByText("Option feedback deleted.");
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/mock-tests"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ topic: "web", count: 3 }),
        }),
      ),
    );
  });
});

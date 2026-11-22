// Exercise key frontend interactions with mocked HTTP and streaming responses.
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthPage } from "../src/pages/auth";
import { Setup } from "../src/pages/setup";
import { InterviewPage } from "../src/pages/interview";
import { ProtectedRoute } from "../src/components/protected-route";
const user = {
  id: "u1",
  name: "Ada Lovelace",
  email: "ada@example.com",
  targetRole: null,
  experienceLevel: null,
  skills: [],
  createdAt: "2025-01-01T00:00:00Z",
};
function json(data: unknown, status = 200) {
  return new Response(
    JSON.stringify({
      success: status < 400,
      data: status < 400 ? data : null,
      error:
        status < 400
          ? null
          : { code: "UNAUTHENTICATED", message: "Please log in" },
    }),
    { status },
  );
}
function mount(path: string, element: React.ReactNode, route: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={element} />
          <Route path="/login" element={<div>Login destination</div>} />
          <Route path="/app" element={<div>Dashboard destination</div>} />
          <Route
            path="/app/interview/:id"
            element={<div>Interview destination</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("frontend pages", () => {
  it("registers using the cookie-based API and navigates to the dashboard", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(user, 201));
    vi.stubGlobal("fetch", fetcher);
    mount("/register", <AuthPage mode="register" />, "/register");
    const actor = userEvent.setup();
    await actor.type(screen.getByLabelText("Full name"), "Ada Lovelace");
    await actor.type(screen.getByLabelText("Email address"), "ada@example.com");
    await actor.type(screen.getByLabelText("Password"), "password123");
    await actor.click(screen.getByRole("button", { name: /create account/i }));
    await screen.findByText("Dashboard destination");
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      credentials: "include",
    });
  });
  it("redirects unauthenticated visitors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(null, 401)));
    mount("/protected", <ProtectedRoute />, "/protected");
    await screen.findByText("Login destination");
  });
  it("creates an interview using selected options", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith("/users/me")
            ? json(user)
            : url.endsWith("/resumes")
              ? json([])
              : json({ id: "abc" }, 201),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    mount("/setup", <Setup />, "/setup");
    const actor = userEvent.setup();
    await actor.type(screen.getByLabelText("Target role"), "Developer");
    await actor.click(screen.getByRole("button", { name: /behavioral/i }));
    await actor.click(screen.getByRole("button", { name: /begin interview/i }));
    await screen.findByText("Interview destination");
    const [, request] = fetcher.mock.calls.find(([url]: [string]) =>
      url.endsWith("/interviews"),
    )!;
    expect(JSON.parse(request.body as string)).toMatchObject({
      role: "Developer",
      roundType: "behavioral",
      difficulty: "medium",
      totalQuestions: 5,
    });
  });
  it("loads an existing question and submits an answer over SSE", async () => {
    const question = {
      id: "q1",
      text: "What is caching?",
      category: "technical",
      orderNo: 1,
      isFollowup: false,
    };
    let answered = false;
    const fetcher = vi
      .fn()
      .mockImplementation((url: string, init?: RequestInit) => {
        if (url.endsWith("/answers")) {
          answered = true;
          const event =
            "event: complete\ndata: " +
            JSON.stringify({
              success: true,
              data: {
                metrics: { correctness: 8, clarity: 7, depth: 8, relevance: 9 },
                feedback: ["Nice work"],
                idealAnswer: "A good answer",
              },
              error: null,
            }) +
            "\n\n";
          return Promise.resolve(new Response(event));
        }
        if (url.endsWith("/interviews/abc"))
          return Promise.resolve(
            json({
              interview: {
                id: "abc",
                role: "Developer",
                roundType: "technical",
                difficulty: "medium",
                totalQuestions: 1,
                status: "in_progress",
              },
              turns: [
                {
                  question,
                  answer: answered
                    ? { id: "a", answerText: "Reuse results" }
                    : null,
                  evaluation: null,
                },
              ],
            }),
          );
        throw new Error(`Unexpected ${url} ${init?.method}`);
      });
    vi.stubGlobal("fetch", fetcher);
    mount("/app/interview/abc", <InterviewPage />, "/app/interview/:id");
    await screen.findByText("What is caching?");
    const actor = userEvent.setup();
    await actor.type(screen.getByLabelText("Your answer"), "Reuse results");
    await actor.click(screen.getByRole("button", { name: /submit answer/i }));
    await screen.findByText("Nice work");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /finish & view report/i }),
      ).toBeTruthy(),
    );
  });
});

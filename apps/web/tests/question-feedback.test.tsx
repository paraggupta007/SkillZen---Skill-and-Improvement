// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QuestionFeedback } from "../src/components/question-feedback";
const json = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify({
      success: status === 200,
      data: status === 200 ? data : null,
      error: status === 200 ? null : { code: "FAILED", message: "Try again" },
    }),
    { status },
  );
function mount() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <QuestionFeedback interviewId="int" questionId="q1" />
    </QueryClientProvider>,
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("question feedback", () => {
  it("loads on demand, saves, edits and deletes feedback", async () => {
    let current: {
      questionId: string;
      rating: number;
      comment: string;
      updatedAt: string;
    } | null = null;
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        const input = JSON.parse(String(init.body));
        current = { questionId: "q1", ...input, updatedAt: "2026-01-01" };
      }
      if (init?.method === "DELETE") {
        current = null;
        return json({ deleted: true });
      }
      return json({ feedback: current });
    });
    vi.stubGlobal("fetch", fetcher);
    mount();
    expect(fetcher).not.toHaveBeenCalled();
    const actor = userEvent.setup();
    await actor.click(screen.getByText("Rate this question"));
    const save = await screen.findByRole("button", { name: "Save feedback" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    await actor.click(screen.getByRole("radio", { name: "4" }));
    await actor.type(screen.getByLabelText("Comment (optional)"), "Useful");
    await actor.click(save);
    await screen.findByText("Question feedback saved.");
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/interviews/int/questions/q1/feedback"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ rating: 4, comment: "Useful" }),
      }),
    );
    await actor.click(screen.getByRole("radio", { name: "2" }));
    await actor.click(save);
    await screen.findByText("Question feedback saved.");
    expect(current?.rating).toBe(2);
    await actor.click(screen.getByRole("button", { name: "Delete feedback" }));
    await screen.findByText("Question feedback deleted.");
    expect(
      (screen.getByRole("radio", { name: "2" }) as HTMLInputElement).checked,
    ).toBe(false);
    expect(
      (screen.getByLabelText("Comment (optional)") as HTMLTextAreaElement)
        .value,
    ).toBe("");
  });
  it("shows load errors without allowing an overwrite and supports retry", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(null, 503))
      .mockResolvedValueOnce(json({ feedback: null }));
    vi.stubGlobal("fetch", fetcher);
    mount();
    const actor = userEvent.setup();
    await actor.click(screen.getByText("Rate this question"));
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Save feedback" })).toBeNull();
    await actor.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("button", { name: "Save feedback" }),
    ).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ReportPage } from "../src/pages/report";
const json = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, error: null }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("offers saved question feedback even while the report is pending", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/camera-metrics"))
        return json({ metrics: null, suggestions: [] });
      if (url.endsWith("/feedback"))
        return json({
          feedback: {
            questionId: "q1",
            rating: 3,
            comment: "Clear",
            updatedAt: "2026-01-01",
          },
        });
      if (url.includes("/reports/")) return json({ status: "pending" });
      return json({
        interview: { role: "Developer" },
        turns: [
          { question: { id: "q1", text: "What is caching?", orderNo: 1 } },
        ],
      });
    }),
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/app/report/abc"]}>
        <Routes>
          <Route path="/app/report/:id" element={<ReportPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const actor = userEvent.setup();
  await actor.click(await screen.findByText("1. What is caching?"));
  expect(
    ((await screen.findByRole("radio", { name: "3" })) as HTMLInputElement)
      .checked,
  ).toBe(true);
  expect(
    (screen.getByLabelText("Comment (optional)") as HTMLTextAreaElement).value,
  ).toBe("Clear");
  expect(screen.getByText("Putting your report together.")).toBeTruthy();
});

// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SettingsPage } from "../src/pages/settings";
import { useInterviewStore } from "../src/store/interview-store";
const json = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify({
      success: status === 200,
      data: status === 200 ? data : null,
      error:
        status === 200
          ? null
          : { code: "INVALID_CREDENTIALS", message: "Incorrect password" },
    }),
    { status },
  );
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  useInterviewStore.getState().clear();
});
it("requires deliberate confirmation, reports errors and clears local data after deletion", async () => {
  let deleted = false;
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/users/me") && init?.method === "DELETE") {
      if (init.body === JSON.stringify({ password: "password123" })) {
        deleted = true;
        return json({ deleted: true });
      }
      return json(null, 401);
    }
    return deleted
      ? json(null, 401)
      : json({ name: "Ada", email: "ada@example.com" });
  });
  vi.stubGlobal("fetch", fetcher);
  useInterviewStore.getState().setDraft("private draft");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Home() {
    const location = useLocation();
    return (
      <div>
        {location.state?.accountDeleted ? "Deleted confirmation" : "Home"}
      </div>
    );
  }
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/app/settings"]}>
        <Routes>
          <Route path="/app/settings" element={<SettingsPage />} />
          <Route path="/" element={<Home />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByText(/Signed in as Ada/);
  const actor = userEvent.setup();
  const button = screen.getByRole("button", { name: "Delete my account" });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  await actor.type(screen.getByLabelText("Current password"), "wrongpass");
  await actor.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE");
  await actor.click(screen.getByRole("checkbox"));
  await actor.click(button);
  expect(await screen.findByText("Incorrect password")).toBeTruthy();
  await actor.clear(screen.getByLabelText("Current password"));
  await actor.type(screen.getByLabelText("Current password"), "password123");
  await actor.click(button);
  expect(await screen.findByText("Deleted confirmation")).toBeTruthy();
  expect(useInterviewStore.getState().draft).toBe("");
  expect(client.getQueryData(["me"])).toBeUndefined();
  expect(fetcher).toHaveBeenCalledWith(
    expect.stringContaining("/users/me"),
    expect.objectContaining({
      method: "DELETE",
      body: JSON.stringify({ password: "password123" }),
      credentials: "include",
    }),
  );
});

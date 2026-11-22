// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Landing } from "../src/pages/landing";
import { AppLayout } from "../src/components/layout";
import { ProtectedRoute } from "../src/components/protected-route";

const profile = {
  id: "u1",
  name: "Parag",
  email: "parag@example.com",
  targetRole: null,
  experienceLevel: null,
  skills: [],
};
function json(data: unknown, status = 200) {
  return new Response(
    JSON.stringify(
      status === 200
        ? { success: true, data, error: null }
        : {
            success: false,
            data: null,
            error: {
              code: status === 401 ? "UNAUTHENTICATED" : "FAILED",
              message: "Unavailable",
            },
          },
    ),
    { status },
  );
}
function mount(initial = "/app") {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<div>Login page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<div>Dashboard page</div>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("landing page session", () => {
  it("keeps a signed-in user on home after clicking the logo and can return to dashboard", async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.endsWith("/users/me") ? json(profile) : json({ loggedOut: true }),
    );
    vi.stubGlobal("fetch", fetcher);
    mount();
    await screen.findByText("Dashboard page");
    const actor = userEvent.setup();
    await actor.click(
      screen.getAllByRole("link", { name: "SkillZen home" })[0]!,
    );
    expect(await screen.findByText("Hi, Parag")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Create your account" }),
    ).toBeNull();
    expect(
      fetcher.mock.calls.every(([url]) => !url.endsWith("/auth/logout")),
    ).toBe(true);
    await actor.click(
      within(screen.getByRole("banner")).getByRole("link", {
        name: /dashboard/i,
      }),
    );
    expect(await screen.findByText("Dashboard page")).toBeTruthy();
  });
  it("restores signed-in UI on a fresh visit and explicitly logs out", async () => {
    const fetcher = vi.fn(async (url: string) =>
      url.endsWith("/users/me") ? json(profile) : json({ loggedOut: true }),
    );
    vi.stubGlobal("fetch", fetcher);
    mount("/");
    await screen.findByText("Hi, Parag");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("Login page")).toBeTruthy();
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/auth/logout"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });
  it("shows guest links for an unauthenticated visitor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(null, 401)));
    mount("/");
    expect(await screen.findByRole("link", { name: "Log in" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /get started/i }).getAttribute("href"),
    ).toBe("/register");
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });
  it("does not mistake a network error for logout and allows retry", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(json(profile));
    vi.stubGlobal("fetch", fetcher);
    mount("/");
    expect((await screen.findByRole("alert")).textContent).toContain(
      "couldn’t check your session",
    );
    expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry session check" }));
    expect(await screen.findByText("Hi, Parag")).toBeTruthy();
  });
});

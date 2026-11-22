// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ContactPage } from "../src/pages/contact";
import { Landing } from "../src/pages/landing";
import { AppLayout } from "../src/components/layout";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function wrap(element: React.ReactNode) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>{element}</MemoryRouter>
    </QueryClientProvider>
  );
}
describe("developer contact and responsive navigation", () => {
  it("exposes the owner's supplied contact details without login", () => {
    render(wrap(<ContactPage />));
    expect(screen.getByRole("heading", { name: "Parag Gupta" })).toBeTruthy();
    expect(screen.getByText(/B.Tech · Batch 2027/)).toBeTruthy();
    expect(
      screen.getByText("GL Bajaj Institute of Engineering and Technology"),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /paragpggupta@gmail.com/i })
        .getAttribute("href"),
    ).toBe("mailto:paragpggupta@gmail.com");
    const linkedin = screen.getByRole("link", { name: /connect with parag/i });
    expect(linkedin.getAttribute("href")).toBe(
      "https://www.linkedin.com/in/parag-gupta-modinagar/",
    );
    expect(linkedin.getAttribute("rel")).toContain("noopener");
  });
  it("links to contact and login on the landing page", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              success: false,
              data: null,
              error: { code: "UNAUTHENTICATED", message: "Please log in" },
            }),
            { status: 401 },
          ),
        ),
    );
    render(wrap(<Landing />));
    await screen.findByRole("link", { name: "Log in" });
    expect(
      screen
        .getAllByRole("link", { name: /contact/i })
        .every((link) => link.getAttribute("href") === "/contact"),
    ).toBe(true);
    expect(
      screen.getByRole("link", { name: "Log in" }).getAttribute("href"),
    ).toBe("/login");
  });
  it("opens and closes an accessible mobile navigation menu", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            data: { name: "Ada" },
            error: null,
          }),
        ),
      ),
    );
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <MemoryRouter initialEntries={["/app"]}>
          <Routes>
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<div>Dashboard content</div>} />
              <Route path="mock-tests" element={<div>Mock content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const actor = userEvent.setup();
    const toggle = screen.getByRole("button", { name: "Menu" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await actor.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    await actor.click(
      within(
        screen.getByRole("navigation", { name: "Mobile navigation" }),
      ).getByRole("link", { name: "Mock tests" }),
    );
    expect(screen.getByText("Mock content")).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
});

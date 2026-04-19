import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import Header from "@/components/Header";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const mockUseOutbox = vi.fn().mockReturnValue({
  pendingCount: 0,
  refreshCount: vi.fn(),
});

vi.mock("@/lib/outbox-context", () => ({
  useOutbox: () => mockUseOutbox(),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuthContext: () => ({
    user: null,
    isAdmin: false,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

function renderHeader(locale = "en") {
  return render(
    <MemoryRouter initialEntries={[`/${locale}`]}>
      <Routes>
        <Route path="/:locale" element={<Header />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Header", () => {
  it("renders logo, language switcher, and volunteer button", () => {
    renderHeader();
    expect(screen.getByText("Kapwa Help")).toBeInTheDocument();
    const reportLink = screen.getByRole("link", { name: "Navigation.report" });
    expect(reportLink).toBeInTheDocument();
    expect(reportLink).toHaveAttribute("href", "/en/report");
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows all three language options", () => {
    renderHeader();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent("English");
    expect(options[1]).toHaveTextContent("Filipino");
    expect(options[2]).toHaveTextContent("Ilocano");
  });

  it("selects the current locale", () => {
    renderHeader("fil");
    expect(screen.getByRole("combobox")).toHaveValue("fil");
  });

  it("shows pending count badge when outbox has items", () => {
    mockUseOutbox.mockReturnValue({
      pendingCount: 3,
      refreshCount: vi.fn(),
    });
    renderHeader();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("hides badge when outbox count is zero", () => {
    mockUseOutbox.mockReturnValue({
      pendingCount: 0,
      refreshCount: vi.fn(),
    });
    renderHeader();
    const reportLink = screen.getByRole("link", { name: "Navigation.report" });
    expect(reportLink.querySelector("span")).toBeNull();
  });

  it("renders navigation links for relief map and dashboard", () => {
    renderHeader();
    // Each link appears twice (desktop nav + mobile nav)
    expect(screen.getAllByRole("link", { name: "Navigation.reliefMap" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Navigation.dashboard" })).toHaveLength(2);
  });

  it("navigation links point to locale-prefixed routes", () => {
    renderHeader();
    // Check the desktop nav links (first of each pair)
    expect(screen.getAllByRole("link", { name: "Navigation.reliefMap" })[0]).toHaveAttribute("href", "/en");
    expect(screen.getAllByRole("link", { name: "Navigation.dashboard" })[0]).toHaveAttribute("href", "/en/dashboard");
  });

  it("renders a hamburger menu button on mobile", () => {
    renderHeader();
    const menuButton = screen.getByRole("button", { name: /menu/i });
    expect(menuButton).toBeInTheDocument();
  });

  it("toggles mobile nav when hamburger is clicked", () => {
    renderHeader();
    const menuButton = screen.getByRole("button", { name: /menu/i });

    // Mobile nav should be hidden initially
    const mobileNav = screen.getByTestId("mobile-nav");
    expect(mobileNav).toHaveClass("hidden");

    // Click to open
    fireEvent.click(menuButton);
    expect(mobileNav).not.toHaveClass("hidden");

    // Click to close
    fireEvent.click(menuButton);
    expect(mobileNav).toHaveClass("hidden");
  });

  it("mobile nav contains all navigation links", () => {
    renderHeader();
    const menuButton = screen.getByRole("button", { name: /menu/i });
    fireEvent.click(menuButton);

    const mobileNav = screen.getByTestId("mobile-nav");
    const links = mobileNav.querySelectorAll("a");
    expect(links).toHaveLength(2);
  });
});

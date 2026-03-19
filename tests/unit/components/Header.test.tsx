import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
    expect(screen.getByText("LUaid.org")).toBeInTheDocument();
    const reportLink = screen.getByRole("link", { name: "Navigation.report" });
    expect(reportLink).toBeInTheDocument();
    expect(reportLink).toHaveAttribute("href", "/en/submit");
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
});

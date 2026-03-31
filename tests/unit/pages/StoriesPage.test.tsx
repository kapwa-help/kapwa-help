import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StoriesPage } from "@/pages/StoriesPage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("@/lib/outbox-context", () => ({
  useOutbox: () => ({ pendingCount: 0, refreshCount: vi.fn() }),
}));

vi.mock("react-router", () => ({
  useParams: () => ({ locale: "en" }),
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/en/stories" }),
  Link: ({ children, ...props }: any) => <a href={props.to}>{children}</a>,
  NavLink: ({ children, ...props }: any) => <a href={props.to}>{children}</a>,
}));

describe("StoriesPage", () => {
  it("renders heading and coming soon message", () => {
    render(<StoriesPage />);
    expect(screen.getByRole("heading", { name: "Navigation.stories" })).toBeInTheDocument();
    expect(screen.getByText("Stories.comingSoon")).toBeInTheDocument();
  });
});

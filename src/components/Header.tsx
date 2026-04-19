import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useLocation, Link, NavLink } from "react-router";
import { supportedLocales, type Locale } from "../i18n";
import { useOutbox } from "@/lib/outbox-context";
import { AUTH_MODE } from "@/lib/auth-mode";
import { useAuthContext } from "@/lib/auth-context";
import { InviteAdminModal } from "./InviteAdminModal";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fil: "Filipino",
  ilo: "Ilocano",
};

function GlobeIcon() {
  return (
    <svg
      className="h-4 w-4 text-neutral-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-1.264.26-2.467.729-3.558"
      />
    </svg>
  );
}

function navLinkClass(isActive: boolean, mobile = false) {
  return `rounded-lg px-3 ${mobile ? "py-2" : "py-1.5"} text-sm transition-colors ${isActive
    ? "bg-neutral-400/10 text-neutral-50"
    : "text-neutral-400 hover:text-neutral-100"
    }`;
}

export default function Header() {
  const { t } = useTranslation();
  const { locale } = useParams<{ locale: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { pendingCount } = useOutbox();
  const { isAdmin } = useAuthContext();
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const showInvite = AUTH_MODE === 'strict' && isAdmin;

  const handleLocaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subPath = locale ? location.pathname.replace(`/${locale}`, "") : "";
    navigate(`/${e.target.value}${subPath}`);
  };

  const navItems = [
    { to: `/${locale}`, label: t("Navigation.reliefMap"), end: true },
    { to: `/${locale}/dashboard`, label: t("Navigation.dashboard") },
  ];

  return (
    <header className="bg-secondary shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
      <div className="mx-auto flex max-w-7xl items-center px-6 py-4">
        <div className="flex flex-1 items-center">
          <Link to={`/${locale}`} className="flex items-center gap-2 font-logo text-xl font-bold text-white hover:text-neutral-100">
            <img src="/icons/kapwahelp_v1.svg" alt="" aria-hidden="true" className="h-8 w-8" />
            Kapwa Help
          </Link>
        </div>
        <nav className="hidden items-center gap-1 sm:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => navLinkClass(isActive)}
            >
              {item.label}
            </NavLink>
          ))}
          {showInvite && (
            <button
              type="button"
              onClick={() => setInviteOpen(true)}
              className={navLinkClass(false)}
            >
              Invite admin
            </button>
          )}
        </nav>
        <div className="flex flex-1 items-center justify-end gap-4">
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline"><GlobeIcon /></span>
            <select
              value={locale}
              onChange={handleLocaleChange}
              aria-label="Language"
              className="rounded-lg border border-neutral-400/20 bg-secondary px-3 py-1.5 text-sm text-neutral-400"
            >
              {supportedLocales.map((loc) => (
                <option key={loc} value={loc}>
                  {LOCALE_LABELS[loc]}
                </option>
              ))}
            </select>
          </div>
          <Link
            to={`/${locale}/report`}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white shadow-[0_0_12px_rgba(14,154,167,0.3)] hover:bg-primary/80 hover:shadow-[0_0_16px_rgba(14,154,167,0.4)] transition-all duration-200"
          >
            {t("Navigation.report")}
            {pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-warning px-1.5 py-0.5 text-xs font-medium text-secondary">
                {pendingCount}
              </span>
            )}
          </Link>
          <button
            className="text-neutral-400 hover:text-neutral-100 sm:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>
      <div
        data-testid="mobile-nav"
        className={`${menuOpen ? "flex" : "hidden"} flex-col gap-1 border-t border-neutral-400/20 px-6 py-3 sm:hidden`}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) => navLinkClass(isActive, true)}
          >
            {item.label}
          </NavLink>
        ))}
        {showInvite && (
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setInviteOpen(true);
            }}
            className={`${navLinkClass(false, true)} text-left`}
          >
            Invite admin
          </button>
        )}
      </div>
      <InviteAdminModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </header>
  );
}

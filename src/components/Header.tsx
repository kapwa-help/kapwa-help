import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useLocation, Link } from "react-router";
import { supportedLocales, type Locale } from "../i18n";
import { useOutbox } from "@/lib/outbox-context";

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

export default function Header() {
  const { t } = useTranslation();
  const { locale } = useParams<{ locale: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { pendingCount } = useOutbox();

  const handleLocaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const subPath = locale ? location.pathname.replace(`/${locale}`, "") : "";
    navigate(`/${e.target.value}${subPath}`);
  };

  return (
    <header className="border-b border-neutral-400/20 bg-secondary">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to={`/${locale}`} className="text-xl font-bold text-white hover:text-neutral-100">Kapwa Help</Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <GlobeIcon />
            <select
              value={locale}
              onChange={handleLocaleChange}
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
            to={`/${locale}/submit`}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary/80"
          >
            {t("Navigation.report")}
            {pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-warning px-1.5 py-0.5 text-xs font-medium text-secondary">
                {pendingCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

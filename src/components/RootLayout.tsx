import { useEffect } from "react";
import { prewarmTileCache } from "@/lib/tile-prewarm";
import { Outlet, useParams, Navigate } from "react-router";
import { useTranslation } from "react-i18next";
import { supportedLocales, type Locale } from "../i18n";
import { OutboxProvider } from "@/lib/outbox-context";
import { useEagerCache } from "@/lib/eager-cache";

export function RootLayout() {
  const { locale } = useParams<{ locale: string }>();
  const { i18n } = useTranslation();

  const isValid = supportedLocales.includes(locale as Locale);

  useEffect(() => {
    if (isValid && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale, i18n, isValid]);

  useEffect(() => {
    if (isValid) {
      document.documentElement.lang = locale!;
    }
  }, [locale, isValid]);

  useEagerCache();

  useEffect(() => {
    // Defer by one tick so tile fetches don't compete with the critical
    // path (bundle parse, first paint, reference data fetch).
    const handle = window.setTimeout(prewarmTileCache, 0);
    return () => window.clearTimeout(handle);
  }, []);

  if (!isValid) {
    return <Navigate to="/en" replace />;
  }

  return (
    <OutboxProvider>
      <Outlet />
    </OutboxProvider>
  );
}

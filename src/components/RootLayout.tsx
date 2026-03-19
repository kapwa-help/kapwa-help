import { useEffect } from "react";
import { Outlet, useParams, Navigate } from "react-router";
import { useTranslation } from "react-i18next";
import { supportedLocales, type Locale } from "../i18n";
import { OutboxProvider } from "@/lib/outbox-context";

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

  if (!isValid) {
    return <Navigate to="/en" replace />;
  }

  return (
    <OutboxProvider>
      <Outlet />
    </OutboxProvider>
  );
}

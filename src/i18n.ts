import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpBackend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";
import { mark } from "./lib/perf-log";

export const supportedLocales = ["en", "fil", "ilo"] as const;
export type Locale = (typeof supportedLocales)[number];

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: supportedLocales,
    defaultNS: "translation",

    interpolation: { escapeValue: false },

    backend: {
      loadPath: "/locales/{{lng}}/translation.json",
    },

    detection: {
      order: ["path"],
      lookupFromPathIndex: 0,
      caches: [],
    },

    react: { useSuspense: true },
  });

// Fires the first time any namespace resolves; `mark()` dedupes on
// subsequent locale switches so only the cold-load timing is captured.
i18n.on("loaded", () => {
  mark("app:i18n-ready");
});

export default i18n;

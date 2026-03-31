import { useTranslation } from "react-i18next";

export default function StatusFooter() {
  const { t } = useTranslation();
  const now = new Date();
  const time = now.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <footer className="mt-6 flex items-center gap-6 rounded-2xl bg-secondary px-6 py-4 text-sm text-neutral-400 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]">
      <span className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        {t("Dashboard.online")}
      </span>
      <span className="flex items-center gap-2">
        {t("Dashboard.lastUpdated")}: {time}
      </span>
    </footer>
  );
}

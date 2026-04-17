import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type Props = {
  eventName?: string;
  updatedAt?: Date | null;
};

export default function StatusFooter({ eventName, updatedAt }: Props) {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const displayTime = (updatedAt ?? new Date()).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <footer className="flex items-center gap-6 bg-secondary px-6 py-3 text-sm text-neutral-400 shadow-[0_-1px_3px_rgba(0,0,0,0.3)]">
      <span className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          {isOnline && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          )}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${isOnline ? "bg-success" : "bg-warning"}`} />
        </span>
        {isOnline ? t("Dashboard.online") : t("Dashboard.offline")}
      </span>
      {eventName && (
        <span className="flex items-center gap-2">
          {t("Dashboard.respondingTo")}: {eventName}
        </span>
      )}
      <span className="flex items-center gap-2">
        {t("Dashboard.lastUpdated")}: {displayTime}
      </span>
    </footer>
  );
}

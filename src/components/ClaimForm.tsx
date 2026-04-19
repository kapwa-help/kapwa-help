import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  getHubs,
  createDeployment,
  getActiveEvent,
} from "@/lib/queries";
import type { NeedPoint } from "@/lib/queries";
import { AdminOnly } from "@/components/AdminOnly";

type Props = {
  point: NeedPoint;
  onClaimed: () => void;
};

export default function ClaimForm({ point, onClaimed }: Props) {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hubs, setHubs] = useState<{ id: string; name: string }[]>([]);
  const [hubId, setHubId] = useState("");
  const [notes, setNotes] = useState("");

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

  async function handleOpen() {
    setIsOpen(true);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
    try {
      const event = await getActiveEvent();
      if (event) {
        const hubData = await getHubs(event.id);
        setHubs(hubData);
      }
    } catch {
      setError(t("ClaimForm.error"));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hubId || !isOnline) return;

    setSubmitting(true);
    setError(null);

    try {
      const event = await getActiveEvent();
      await createDeployment({
        event_id: event?.id ?? "",
        hub_id: hubId,
        need_id: point.id,
        date: new Date().toISOString().split("T")[0],
        notes: notes || undefined,
      });
      onClaimed();
      setIsOpen(false);
    } catch {
      setError(t("ClaimForm.error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <AdminOnly>
        <button
          onClick={handleOpen}
          disabled={!isOnline}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-neutral-50 hover:bg-primary/80 disabled:opacity-40"
        >
          {t("ClaimForm.respondButton")}
        </button>
      </AdminOnly>
    );
  }

  return (
    <AdminOnly>
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <h4 className="text-sm font-semibold text-neutral-50">
        {t("ClaimForm.title")}
      </h4>

      {/* Hub */}
      <div>
        <label className="mb-1 block text-xs text-neutral-400">
          {t("ClaimForm.hub")}
        </label>
        <select
          aria-label={t("ClaimForm.hub")}
          value={hubId}
          onChange={(e) => setHubId(e.target.value)}
          required
          className="w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-sm text-neutral-50"
        >
          <option value="">{t("ClaimForm.hubPlaceholder")}</option>
          {hubs.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="mb-1 block text-xs text-neutral-400">
          {t("ClaimForm.notes")}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("ClaimForm.notesPlaceholder")}
          rows={2}
          className="w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-400/40"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!hubId || !isOnline || submitting}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-neutral-50 hover:bg-primary/80 disabled:opacity-40"
      >
        {submitting ? t("ClaimForm.submitting") : t("ClaimForm.submit")}
      </button>

      {error && (
        <p className="text-center text-xs text-error">{error}</p>
      )}
    </form>
    </AdminOnly>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getActiveEvent, insertHazard } from "@/lib/queries";

const HAZARD_TYPES = [
  "flood",
  "landslide",
  "road_blocked",
  "bridge_out",
  "electrical_hazard",
  "other",
] as const;

interface HazardFormProps {
  coords: { lat: number; lng: number } | null;
}

export default function HazardForm({ coords }: HazardFormProps) {
  const { t } = useTranslation();
  const [hazardType, setHazardType] = useState<string>(HAZARD_TYPES[0]);
  const [description, setDescription] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!coords) return;
    setSubmitting(true);
    setError(null);

    try {
      const event = await getActiveEvent();
      await insertHazard({
        event_id: event?.id ?? null,
        hazard_type: hazardType,
        description: description || null,
        latitude: coords.lat,
        longitude: coords.lng,
        reported_by: reportedBy || null,
      });
      setSubmitted(true);
    } catch {
      setError(t("HazardForm.error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-neutral-400/20 bg-secondary p-6 text-center">
        <p className="mb-4 text-lg font-semibold text-success">
          {t("HazardForm.success")}
        </p>
        <button
          onClick={() => {
            setSubmitted(false);
            setDescription("");
            setReportedBy("");
            setHazardType(HAZARD_TYPES[0]);
          }}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-neutral-50 hover:bg-primary/80"
        >
          {t("SubmitForm.submitAnother")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Hazard type */}
      <div>
        <label htmlFor="hazard-type" className="block text-sm text-neutral-400">
          {t("HazardForm.hazardType")}
        </label>
        <select
          id="hazard-type"
          value={hazardType}
          onChange={(e) => setHazardType(e.target.value)}
          className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-secondary px-4 py-3 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {HAZARD_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`HazardForm.${type}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="hazard-description" className="block text-sm text-neutral-400">
          {t("HazardForm.description")}
        </label>
        <textarea
          id="hazard-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("HazardForm.descriptionPlaceholder")}
          rows={3}
          className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-secondary px-4 py-3 text-neutral-50 placeholder-neutral-400/60 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Reported by */}
      <div>
        <label htmlFor="hazard-reported-by" className="block text-sm text-neutral-400">
          {t("HazardForm.reportedBy")}
        </label>
        <input
          id="hazard-reported-by"
          type="text"
          value={reportedBy}
          onChange={(e) => setReportedBy(e.target.value)}
          placeholder={t("HazardForm.reportedByPlaceholder")}
          className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-secondary px-4 py-3 text-neutral-50 placeholder-neutral-400/60 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !coords}
        className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-neutral-50 hover:bg-primary/80 disabled:opacity-50"
      >
        {submitting ? t("HazardForm.submitting") : t("HazardForm.submit")}
      </button>
    </form>
  );
}

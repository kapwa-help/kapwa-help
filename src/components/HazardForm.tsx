import { useRef, useState } from "react";
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
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  function removePhoto() {
    setPhoto(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

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
            removePhoto();
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

      {/* Photo */}
      <div>
        <label htmlFor="hazard-photo" className="block text-sm text-neutral-400">
          {t("HazardForm.photo")}
        </label>
        {photoPreview ? (
          <div className="relative mt-1">
            <img
              src={photoPreview}
              alt=""
              className="h-40 w-full rounded-xl border border-neutral-400/20 object-cover"
            />
            <button
              type="button"
              onClick={removePhoto}
              className="absolute right-2 top-2 rounded-full bg-base/80 p-1 text-neutral-50 hover:bg-base"
              aria-label="Remove photo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-400/40 bg-secondary px-4 py-6 text-sm text-neutral-400 hover:border-primary hover:text-neutral-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            {t("HazardForm.photo")}
          </button>
        )}
        <input
          ref={fileInputRef}
          id="hazard-photo"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="hidden"
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

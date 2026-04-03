import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  getBarangays,
  insertSubmission,
  type SubmissionInsert,
} from "@/lib/queries";
import {
  getCachedOptions,
  setCachedOptions,
  addToOutbox,
  getOutboxEntries,
  removeFromOutbox,
} from "@/lib/form-cache";
import { useOutbox } from "@/lib/outbox-context";

interface Barangay {
  id: string;
  name: string;
  municipality: string;
}

export default function SubmitForm() {
  const { t } = useTranslation();
  const { refreshCount } = useOutbox();
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"acquiring" | "captured" | "denied" | "idle">("idle");

  useEffect(() => {
    let hadCache = false;
    let cancelled = false;

    // Step 1: Try loading from IndexedDB cache first
    getCachedOptions<Barangay>("barangays").then((cachedB) => {
      if (cancelled) return;
      if (cachedB?.data.length) {
        hadCache = true;
        setBarangays(cachedB.data);
        setLoading(false);
      }

      // Step 2: Fetch fresh data from Supabase
      getBarangays()
        .then((freshB) => {
          if (cancelled) return;
          setBarangays(freshB);
          setLoading(false);
          setCachedOptions("barangays", freshB);
        })
        .catch(() => {
          if (cancelled) return;
          if (!hadCache) {
            setError(t("SubmitForm.loadError"));
            setLoading(false);
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    setLocationStatus("acquiring");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus("captured");
      },
      () => {
        setLocationStatus("denied");
      }
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const flushingRef = useRef(false);

  const flushOutbox = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const entries = await getOutboxEntries();
      for (const entry of entries) {
        try {
          await insertSubmission(entry.payload);
          await removeFromOutbox(entry.key);
        } catch (err: unknown) {
          const isUniqueViolation =
            err &&
            typeof err === "object" &&
            "code" in err &&
            (err as { code: string }).code === "23505";
          if (isUniqueViolation) {
            await removeFromOutbox(entry.key);
          }
        }
      }
      refreshCount();
    } finally {
      flushingRef.current = false;
    }
  }, [refreshCount]);

  useEffect(() => {
    const handleOnline = () => {
      flushOutbox();
    };
    window.addEventListener("online", handleOnline);

    if (navigator.onLine) {
      flushOutbox();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [flushOutbox]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();

    const payload: SubmissionInsert = {
      id,
      type: "need",
      contact_name: formData.get("contact_name") as string,
      contact_phone: (formData.get("contact_phone") as string) || null,
      barangay_id: formData.get("barangay_id") as string,
      gap_category: formData.get("gap_category") as string,
      access_status: formData.get("access_status") as string,
      urgency: formData.get("urgency") as string,
      quantity_needed: formData.get("quantity_needed")
        ? Number(formData.get("quantity_needed"))
        : null,
      notes: (formData.get("notes") as string) || null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
    };

    try {
      await insertSubmission(payload);
      setSubmitted(true);
    } catch {
      try {
        await addToOutbox(payload);
        refreshCount();
        setSavedOffline(true);
        setSubmitted(true);
      } catch {
        setError(t("SubmitForm.errorMessage"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <h2
          className={`text-xl font-bold ${savedOffline ? "text-warning" : "text-success"}`}
        >
          {t(savedOffline ? "SubmitForm.savedTitle" : "SubmitForm.successTitle")}
        </h2>
        <p className="mt-2 text-neutral-400">
          {t(
            savedOffline
              ? "SubmitForm.savedMessage"
              : "SubmitForm.successMessage"
          )}
        </p>
        <button
          onClick={() => {
            setSubmitted(false);
            setSavedOffline(false);
            setFormKey((k) => k + 1);
            setCoords(null);
            setLocationStatus("idle");
          }}
          className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-neutral-50 hover:bg-primary/80"
        >
          {t("SubmitForm.submitAnother")}
        </button>
      </div>
    );
  }

  return (
    <form key={formKey} onSubmit={handleSubmit} className="space-y-5">
      {/* Contact name */}
      <div>
        <label htmlFor="contact_name" className="block text-sm text-neutral-400">
          {t("SubmitForm.contactName")}
        </label>
        <input
          id="contact_name"
          name="contact_name"
          type="text"
          required
          className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={t("SubmitForm.contactNamePlaceholder")}
        />
      </div>

      {/* Contact phone */}
      <div>
        <label htmlFor="contact_phone" className="block text-sm text-neutral-400">
          {t("SubmitForm.contactPhone")}
        </label>
        <input
          id="contact_phone"
          name="contact_phone"
          type="tel"
          className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={t("SubmitForm.contactPhonePlaceholder")}
        />
      </div>

      {/* Barangay */}
      <div>
        <label htmlFor="barangay_id" className="block text-sm text-neutral-400">
          {t("SubmitForm.barangay")}
        </label>
        <select
          id="barangay_id"
          name="barangay_id"
          required
          disabled={loading}
          className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        >
          <option value="">
            {loading ? t("SubmitForm.loadingOptions") : t("SubmitForm.barangayPlaceholder")}
          </option>
          {barangays.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} — {b.municipality}
            </option>
          ))}
        </select>
      </div>

      {/* Gap category */}
      <fieldset>
        <legend className="text-sm text-neutral-400">
          {t("SubmitForm.gapCategory")}
        </legend>
        <div className="mt-2 flex gap-2">
          {(["lunas", "sustenance", "shelter"] as const).map((gap) => (
            <label key={gap} className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="gap_category"
                value={gap}
                required
                className="peer sr-only"
              />
              <span className="block rounded-xl border border-neutral-400/20 bg-base px-2 py-3 text-center text-xs peer-checked:border-primary peer-checked:bg-primary/20 peer-checked:text-primary sm:text-sm">
                {t(`SubmitForm.gap_${gap}`)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Access status */}
      <div>
        <label htmlFor="access_status" className="block text-sm text-neutral-400">
          {t("SubmitForm.accessStatus")}
        </label>
        <select
          id="access_status"
          name="access_status"
          required
          className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">{t("SubmitForm.accessPlaceholder")}</option>
          <option value="truck">{t("SubmitForm.accessTruck")}</option>
          <option value="4x4">{t("SubmitForm.access4x4")}</option>
          <option value="boat">{t("SubmitForm.accessBoat")}</option>
          <option value="foot_only">{t("SubmitForm.accessFootOnly")}</option>
          <option value="cut_off">{t("SubmitForm.accessCutOff")}</option>
        </select>
      </div>

      {/* Urgency */}
      <fieldset>
        <legend className="text-sm text-neutral-400">
          {t("SubmitForm.urgencyLabel")}
        </legend>
        <div className="mt-2 flex gap-2">
          {(["low", "medium", "high", "critical"] as const).map((level) => (
            <label key={level} className="flex-1 cursor-pointer">
              <input
                type="radio"
                name="urgency"
                value={level}
                required
                className="peer sr-only"
              />
              <span className="block rounded-xl border border-neutral-400/20 bg-base px-2 py-3 text-center text-xs peer-checked:border-primary peer-checked:bg-primary/20 peer-checked:text-primary sm:text-sm">
                {t(`SubmitForm.urgency${level.charAt(0).toUpperCase() + level.slice(1)}`)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Quantity */}
      <div>
        <label htmlFor="quantity_needed" className="block text-sm text-neutral-400">
          {t("SubmitForm.quantityNeeded")}
        </label>
        <input
          id="quantity_needed"
          name="quantity_needed"
          type="number"
          min="1"
          className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={t("SubmitForm.quantityPlaceholder")}
        />
      </div>

      {/* Location */}
      <div>
        {locationStatus === "acquiring" && (
          <p className="text-sm text-neutral-400">
            {t("SubmitForm.locationAcquiring")}
          </p>
        )}
        {locationStatus === "captured" && coords && (
          <p className="text-sm text-success">
            {t("SubmitForm.locationCaptured", {
              lat: coords.lat.toFixed(2),
              lng: coords.lng.toFixed(2),
            })}
          </p>
        )}
        {locationStatus === "denied" && (
          <div className="space-y-2">
            <p className="text-sm text-warning">
              {t("SubmitForm.locationDenied")}
            </p>
            <button
              type="button"
              onClick={requestLocation}
              className="rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-sm text-neutral-400 hover:border-primary hover:text-neutral-50 transition-colors"
            >
              {t("SubmitForm.locationRetry")}
            </button>
          </div>
        )}
        {locationStatus === "idle" && (
          <button
            type="button"
            onClick={requestLocation}
            className="rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-sm text-neutral-400 hover:border-primary hover:text-neutral-50 transition-colors"
          >
            {t("SubmitForm.shareLocation")}
          </button>
        )}
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm text-neutral-400">
          {t("SubmitForm.notes")}
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={t("SubmitForm.notesPlaceholder")}
        />
      </div>

      {/* Error message */}
      {error && <p className="text-sm text-error">{error}</p>}

      {/* Submit button */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-neutral-50 shadow-[0_0_12px_rgba(14,154,167,0.3)] hover:bg-primary/80 hover:shadow-[0_0_16px_rgba(14,154,167,0.4)] transition-all duration-200 disabled:opacity-50"
      >
        {submitting ? t("SubmitForm.submitting") : t("SubmitForm.submit")}
      </button>
    </form>
  );
}

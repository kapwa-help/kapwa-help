import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  getBarangays,
  getAidCategories,
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

type SubmissionType = "need" | "request" | "feedback";

interface Barangay {
  id: string;
  name: string;
  municipality: string;
}

interface AidCategory {
  id: string;
  name: string;
}

export default function SubmitForm() {
  const { t } = useTranslation();
  const { refreshCount } = useOutbox();
  const [type, setType] = useState<SubmissionType>("request");
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [categories, setCategories] = useState<AidCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  useEffect(() => {
    let hadCache = false;
    let cancelled = false;

    // Step 1: Try loading from IndexedDB cache first
    Promise.all([
      getCachedOptions<Barangay>("barangays"),
      getCachedOptions<AidCategory>("aid_categories"),
    ]).then(([cachedB, cachedC]) => {
      if (cancelled) return;
      if (cachedB?.data.length && cachedC?.data.length) {
        hadCache = true;
        setBarangays(cachedB.data);
        setCategories(cachedC.data);
        setLoading(false);
      }

      // Step 2: Fetch fresh data from Supabase in parallel
      Promise.all([getBarangays(), getAidCategories()])
        .then(([freshB, freshC]) => {
          if (cancelled) return;
          setBarangays(freshB);
          setCategories(freshC);
          setLoading(false);
          // Update cache for next offline visit
          setCachedOptions("barangays", freshB);
          setCachedOptions("aid_categories", freshC);
        })
        .catch(() => {
          if (cancelled) return;
          if (!hadCache) {
            setError(t("SubmitForm.loadError"));
            setLoading(false);
          }
          // If cache was showing, silently ignore the fetch failure
        });
    });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const requestLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        () => {} // silently ignore denial
      );
    }
  };

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
          // Check for Postgres unique violation (duplicate key = already synced)
          const isUniqueViolation =
            err &&
            typeof err === "object" &&
            "code" in err &&
            (err as { code: string }).code === "23505";
          if (isUniqueViolation) {
            await removeFromOutbox(entry.key);
          }
          // Other errors: leave in outbox for next attempt
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
      type,
      contact_name: formData.get("contact_name") as string,
      contact_phone: (formData.get("contact_phone") as string) || null,
      barangay_id: formData.get("barangay_id") as string,
      aid_category_id: formData.get("aid_category_id") as string,
      gap_category:
        type === "need"
          ? (formData.get("gap_category") as string) || null
          : null,
      access_status:
        type === "need"
          ? (formData.get("access_status") as string) || null
          : null,
      notes: (formData.get("notes") as string) || null,
      quantity_needed:
        (type === "need" || type === "request") && formData.get("quantity_needed")
          ? Number(formData.get("quantity_needed"))
          : null,
      urgency:
        type === "need" || type === "request"
          ? (formData.get("urgency") as string) || null
          : null,
      rating:
        type === "feedback" && formData.get("rating")
          ? Number(formData.get("rating"))
          : null,
      issue_type:
        type === "feedback"
          ? (formData.get("issue_type") as string) || null
          : null,
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
      {/* Type toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setType("need")}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            type === "need"
              ? "bg-primary text-neutral-50"
              : "bg-base text-neutral-400"
          }`}
        >
          {t("SubmitForm.typeNeed")}
        </button>
        <button
          type="button"
          onClick={() => setType("request")}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            type === "request"
              ? "bg-primary text-neutral-50"
              : "bg-base text-neutral-400"
          }`}
        >
          {t("SubmitForm.typeRequest")}
        </button>
        <button
          type="button"
          onClick={() => setType("feedback")}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            type === "feedback"
              ? "bg-primary text-neutral-50"
              : "bg-base text-neutral-400"
          }`}
        >
          {t("SubmitForm.typeFeedback")}
        </button>
      </div>

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
          className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
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
          className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
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
          className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
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

      {/* Aid category */}
      <div>
        <label htmlFor="aid_category_id" className="block text-sm text-neutral-400">
          {t("SubmitForm.aidCategory")}
        </label>
        <select
          id="aid_category_id"
          name="aid_category_id"
          required
          disabled={loading}
          className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        >
          <option value="">
            {loading ? t("SubmitForm.loadingOptions") : t("SubmitForm.aidCategoryPlaceholder")}
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Need-specific fields */}
      {type === "need" && (
        <>
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
                    className="peer sr-only"
                  />
                  <span className="block rounded-lg border border-neutral-400/20 bg-base px-2 py-2 text-center text-xs peer-checked:border-primary peer-checked:bg-primary/20 peer-checked:text-primary sm:text-sm">
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
              className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">{t("SubmitForm.accessPlaceholder")}</option>
              <option value="truck">{t("SubmitForm.accessTruck")}</option>
              <option value="4x4">{t("SubmitForm.access4x4")}</option>
              <option value="boat">{t("SubmitForm.accessBoat")}</option>
              <option value="foot_only">{t("SubmitForm.accessFootOnly")}</option>
              <option value="cut_off">{t("SubmitForm.accessCutOff")}</option>
            </select>
          </div>

          {/* Urgency + quantity */}
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
                    className="peer sr-only"
                  />
                  <span className="block rounded-lg border border-neutral-400/20 bg-base px-2 py-2 text-center text-xs peer-checked:border-primary peer-checked:bg-primary/20 peer-checked:text-primary sm:text-sm">
                    {t(`SubmitForm.urgency${level.charAt(0).toUpperCase() + level.slice(1)}`)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="quantity_needed" className="block text-sm text-neutral-400">
              {t("SubmitForm.quantityNeeded")}
            </label>
            <input
              id="quantity_needed"
              name="quantity_needed"
              type="number"
              min="1"
              className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={t("SubmitForm.quantityPlaceholder")}
            />
          </div>
        </>
      )}

      {/* Request-only fields */}
      {type === "request" && (
        <>
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
                    className="peer sr-only"
                  />
                  <span className="block rounded-lg border border-neutral-400/20 bg-base px-2 py-2 text-center text-xs peer-checked:border-primary peer-checked:bg-primary/20 peer-checked:text-primary sm:text-sm">
                    {t(
                      `SubmitForm.urgency${level.charAt(0).toUpperCase() + level.slice(1)}`
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="quantity_needed" className="block text-sm text-neutral-400">
              {t("SubmitForm.quantityNeeded")}
            </label>
            <input
              id="quantity_needed"
              name="quantity_needed"
              type="number"
              min="1"
              className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder={t("SubmitForm.quantityPlaceholder")}
            />
          </div>
        </>
      )}

      {/* Feedback-only fields */}
      {type === "feedback" && (
        <>
          <fieldset>
            <legend className="text-sm text-neutral-400">
              {t("SubmitForm.ratingLabel")}
            </legend>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="rating"
                    value={n}
                    className="peer sr-only"
                  />
                  <span className="block rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-center text-sm peer-checked:border-primary peer-checked:bg-primary/20 peer-checked:text-primary">
                    {n}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="issue_type" className="block text-sm text-neutral-400">
              {t("SubmitForm.issueTypeLabel")}
            </label>
            <select
              id="issue_type"
              name="issue_type"
              className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">{t("SubmitForm.issueNone")}</option>
              <option value="insufficient">{t("SubmitForm.issueInsufficient")}</option>
              <option value="damaged">{t("SubmitForm.issueDamaged")}</option>
              <option value="wrong_items">{t("SubmitForm.issueWrongItems")}</option>
              <option value="delayed">{t("SubmitForm.issueDelayed")}</option>
            </select>
          </div>
        </>
      )}

      {/* Location */}
      <div>
        {coords ? (
          <p className="text-sm text-success">
            {t("SubmitForm.locationCaptured")}
          </p>
        ) : (
          <button
            type="button"
            onClick={requestLocation}
            className="rounded-lg border border-neutral-400/20 bg-base px-4 py-2.5 text-sm text-neutral-400 hover:border-primary hover:text-neutral-50 transition-colors"
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
          className="mt-1 w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={t("SubmitForm.notesPlaceholder")}
        />
      </div>

      {/* Error message */}
      {error && <p className="text-sm text-error">{error}</p>}

      {/* Submit button */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-neutral-50 hover:bg-primary/80 disabled:opacity-50"
      >
        {submitting ? t("SubmitForm.submitting") : t("SubmitForm.submit")}
      </button>
    </form>
  );
}

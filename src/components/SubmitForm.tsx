import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  getAidCategories,
  getActiveEvent,
  insertNeed,
  type NeedInsert,
} from "@/lib/queries";
import {
  getCachedOptions,
  setCachedOptions,
  addToOutbox,
  getOutboxEntries,
  removeFromOutbox,
} from "@/lib/form-cache";
import { useOutbox } from "@/lib/outbox-context";

interface AidCategory {
  id: string;
  name: string;
  icon: string | null;
}

interface SubmitFormProps {
  coords: { lat: number; lng: number } | null;
}

export default function SubmitForm({ coords }: SubmitFormProps) {
  const { t } = useTranslation();
  const { refreshCount } = useOutbox();
  const [categories, setCategories] = useState<AidCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Load aid categories (cache-first)
    getCachedOptions<AidCategory>("aidCategories").then((cachedC) => {
      if (cancelled) return;
      if (cachedC?.data.length) {
        setCategories(cachedC.data);
        setLoading(false);
      }

      getAidCategories()
        .then((freshC) => {
          if (cancelled) return;
          setCategories(freshC);
          setLoading(false);
          setCachedOptions("aidCategories", freshC);
        })
        .catch(() => {
          if (cancelled) return;
          if (!cachedC?.data.length) {
            setError(t("SubmitForm.loadError"));
            setLoading(false);
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const flushingRef = useRef(false);

  const flushOutbox = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const entries = await getOutboxEntries();
      for (const entry of entries) {
        try {
          await insertNeed(entry.payload);
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

  function toggleCategory(id: string) {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedCategories.size === 0) return;
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const id = crypto.randomUUID();

    try {
      const event = await getActiveEvent();
      const payload: NeedInsert = {
        id,
        event_id: event?.id ?? "",
        contact_name: formData.get("contact_name") as string,
        contact_phone: (formData.get("contact_phone") as string) || undefined,
        access_status: formData.get("access_status") as string,
        urgency: formData.get("urgency") as string,
        num_people: Number(formData.get("num_people")) || 1,
        notes: (formData.get("notes") as string) || undefined,
        lat: coords?.lat ?? 0,
        lng: coords?.lng ?? 0,
        category_ids: Array.from(selectedCategories),
      };

      try {
        await insertNeed(payload);
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
      }
    } catch {
      setError(t("SubmitForm.errorMessage"));
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
            setSelectedCategories(new Set());
            setFormKey((k) => k + 1);
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

      {/* Aid categories — multi-select checkboxes */}
      <fieldset>
        <legend className="text-sm text-neutral-400">
          {t("SubmitForm.selectCategories")}
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {loading ? (
            <p className="col-span-full text-sm text-neutral-400">{t("SubmitForm.loadingOptions")}</p>
          ) : (
            categories.map((c) => (
              <label
                key={c.id}
                className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                  selectedCategories.has(c.id)
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-neutral-400/20 bg-base text-neutral-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.has(c.id)}
                  onChange={() => toggleCategory(c.id)}
                  className="sr-only"
                />
                {c.icon && <span>{c.icon}</span>}
                <span>{c.name}</span>
              </label>
            ))
          )}
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

      {/* Number of people */}
      <div>
        <label htmlFor="num_people" className="block text-sm text-neutral-400">
          {t("SubmitForm.numPeople")}
        </label>
        <input
          id="num_people"
          name="num_people"
          type="number"
          min="1"
          required
          className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={t("SubmitForm.numPeoplePlaceholder")}
        />
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
        disabled={submitting || selectedCategories.size === 0}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-neutral-50 shadow-[0_0_12px_rgba(14,154,167,0.3)] hover:bg-primary/80 hover:shadow-[0_0_16px_rgba(14,154,167,0.4)] transition-all duration-200 disabled:opacity-50"
      >
        {submitting ? t("SubmitForm.submitting") : t("SubmitForm.submit")}
      </button>
    </form>
  );
}

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  getOrganizations,
  getAidCategories,
  getActiveEvent,
  insertPurchase,
  type PurchaseInsert,
} from "@/lib/queries";
import { getCachedOptions, setCachedOptions, addToOutbox } from "@/lib/form-cache";
import { useOutbox } from "@/lib/outbox-context";

interface Organization {
  id: string;
  name: string;
}

interface AidCategory {
  id: string;
  name: string;
  icon: string | null;
}

export default function PurchaseForm() {
  const { t } = useTranslation();
  const { refreshCount } = useOutbox();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [categories, setCategories] = useState<AidCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Load active event (cache-first)
    getCachedOptions<{ id: string; name: string }>("activeEvent").then((cachedE) => {
      if (cancelled) return;
      if (cachedE?.data.length) setEventId(cachedE.data[0].id);

      getActiveEvent().then((event) => {
        if (cancelled || !event) return;
        setEventId(event.id);

        // Refresh orgs from network
        getOrganizations(event.id)
          .then((freshO) => { if (!cancelled) { setOrgs(freshO); setCachedOptions("organizations", freshO); } })
          .catch(() => {});
      }).catch(() => {});
    });

    // Load orgs (cache-first, independent of network)
    getCachedOptions<Organization>("organizations").then((cachedO) => {
      if (cancelled) return;
      if (cachedO?.data.length) setOrgs(cachedO.data);
    });

    // Load categories (cache-first)
    getCachedOptions<AidCategory>("aidCategories").then((cachedC) => {
      if (cancelled) return;
      if (cachedC?.data.length) setCategories(cachedC.data);
      getAidCategories()
        .then((freshC) => { if (!cancelled) { setCategories(freshC); setCachedOptions("aidCategories", freshC); } })
        .catch(() => {});
    });

    return () => { cancelled = true; };
  }, []);

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

    try {
      if (!eventId) {
        setError(t("PurchaseForm.error"));
        setSubmitting(false);
        return;
      }
      const id = crypto.randomUUID();
      const payload: PurchaseInsert = {
        id,
        event_id: eventId,
        organization_id: formData.get("organization_id") as string,
        cost: Number(formData.get("cost")),
        date: (formData.get("date") as string) || new Date().toISOString().split("T")[0],
        notes: (formData.get("notes") as string) || undefined,
        category_ids: Array.from(selectedCategories),
      };

      try {
        await insertPurchase(payload);
        setSubmitted(true);
      } catch {
        try {
          await addToOutbox({ type: "purchase", payload });
          refreshCount();
          setSavedOffline(true);
          setSubmitted(true);
        } catch {
          setError(t("PurchaseForm.error"));
        }
      }
    } catch {
      setError(t("PurchaseForm.error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <h2 className={`text-xl font-bold ${savedOffline ? "text-warning" : "text-success"}`}>
          {t(savedOffline ? "PurchaseForm.savedTitle" : "PurchaseForm.success")}
        </h2>
        <p className="mt-2 text-neutral-400">
          {t(savedOffline ? "PurchaseForm.savedMessage" : "PurchaseForm.successMessage")}
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
          {t("ReportForm.reportPurchase")}
        </button>
      </div>
    );
  }

  return (
    <form key={formKey} onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="organization_id" className="block text-sm text-neutral-400">
          {t("PurchaseForm.organization")}
        </label>
        <select
          id="organization_id"
          name="organization_id"
          required
          className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">{t("ClaimForm.organizationPlaceholder")}</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      {/* Aid categories — multi-select checkboxes */}
      <fieldset>
        <legend className="text-sm text-neutral-400">
          {t("PurchaseForm.category")}
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categories.map((c) => (
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
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="cost" className="block text-sm text-neutral-400">
          {t("PurchaseForm.cost")}
        </label>
        <input
          id="cost"
          name="cost"
          type="number"
          min="0"
          step="0.01"
          required
          className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="0.00"
        />
      </div>

      <div>
        <label htmlFor="date" className="block text-sm text-neutral-400">
          {t("PurchaseForm.date")}
        </label>
        <input
          id="date"
          name="date"
          type="date"
          defaultValue={new Date().toISOString().split("T")[0]}
          className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm text-neutral-400">
          {t("PurchaseForm.notes")}
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={submitting || selectedCategories.size === 0}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-neutral-50 shadow-[0_0_12px_rgba(14,154,167,0.3)] hover:bg-primary/80 hover:shadow-[0_0_16px_rgba(14,154,167,0.4)] transition-all duration-200 disabled:opacity-50"
      >
        {submitting ? t("SubmitForm.submitting") : t("PurchaseForm.submit")}
      </button>
    </form>
  );
}

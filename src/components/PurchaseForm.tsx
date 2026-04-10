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
import {
  FormLabel,
  FormLegend,
  FormInput,
  FormSelect,
  FormTextarea,
  FormSubmitButton,
  FormError,
  FormSuccess,
  FormSuccessButton,
} from "@/components/forms/form-fields";

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
      <FormSuccess>
        <h2 className={`text-xl font-bold ${savedOffline ? "text-warning" : "text-success"}`}>
          {t(savedOffline ? "PurchaseForm.savedTitle" : "PurchaseForm.success")}
        </h2>
        <p className="mt-2 text-neutral-400">
          {t(savedOffline ? "PurchaseForm.savedMessage" : "PurchaseForm.successMessage")}
        </p>
        <FormSuccessButton
          onClick={() => {
            setSubmitted(false);
            setSavedOffline(false);
            setSelectedCategories(new Set());
            setFormKey((k) => k + 1);
          }}
        >
          {t("ReportForm.reportPurchase")}
        </FormSuccessButton>
      </FormSuccess>
    );
  }

  return (
    <form key={formKey} onSubmit={handleSubmit} className="space-y-5">
      <div>
        <FormLabel htmlFor="organization_id" required>
          {t("PurchaseForm.organization")}
        </FormLabel>
        <FormSelect id="organization_id" name="organization_id" required>
          <option value="">{t("ClaimForm.organizationPlaceholder")}</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </FormSelect>
      </div>

      {/* Aid categories — multi-select checkboxes */}
      <fieldset>
        <FormLegend required>{t("PurchaseForm.category")}</FormLegend>
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
              <span className="opacity-60">{selectedCategories.has(c.id) ? "✓" : "+"}</span>
              {c.icon && <span>{c.icon}</span>}
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <FormLabel htmlFor="cost" required>{t("PurchaseForm.cost")}</FormLabel>
        <FormInput
          id="cost"
          name="cost"
          type="number"
          min="0"
          step="0.01"
          required
          placeholder="0.00"
        />
      </div>

      <div>
        <FormLabel htmlFor="date" required>{t("PurchaseForm.date")}</FormLabel>
        <FormInput
          id="date"
          name="date"
          type="date"
          defaultValue={new Date().toISOString().split("T")[0]}
        />
      </div>

      <div>
        <FormLabel htmlFor="notes">{t("PurchaseForm.notes")}</FormLabel>
        <FormTextarea id="notes" name="notes" rows={3} />
      </div>

      <FormError message={error} />

      <FormSubmitButton disabled={submitting || selectedCategories.size === 0}>
        {submitting ? t("SubmitForm.submitting") : t("PurchaseForm.submit")}
      </FormSubmitButton>
    </form>
  );
}

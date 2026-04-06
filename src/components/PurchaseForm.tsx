import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  getOrganizations,
  getAidCategories,
  getActiveEvent,
  insertPurchase,
} from "@/lib/queries";

interface Organization {
  id: string;
  name: string;
  municipality: string;
}

interface AidCategory {
  id: string;
  name: string;
  icon: string | null;
}

export default function PurchaseForm() {
  const { t } = useTranslation();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [categories, setCategories] = useState<AidCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    getOrganizations().then(setOrgs).catch(() => {});
    getAidCategories().then(setCategories).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      const event = await getActiveEvent();
      await insertPurchase({
        event_id: event?.id ?? null,
        organization_id: formData.get("organization_id") as string,
        aid_category_id: formData.get("aid_category_id") as string,
        quantity: Number(formData.get("quantity")),
        unit: (formData.get("unit") as string) || null,
        cost: formData.get("cost") ? Number(formData.get("cost")) : null,
        date: (formData.get("date") as string) || new Date().toISOString().split("T")[0],
        notes: (formData.get("notes") as string) || null,
      });
      setSubmitted(true);
    } catch {
      setError(t("PurchaseForm.error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-bold text-success">{t("PurchaseForm.success")}</h2>
        <button
          onClick={() => {
            setSubmitted(false);
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
              {o.name} — {o.municipality}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="aid_category_id" className="block text-sm text-neutral-400">
          {t("PurchaseForm.category")}
        </label>
        <select
          id="aid_category_id"
          name="aid_category_id"
          required
          className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">{t("ClaimForm.aidCategoryPlaceholder")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon ? `${c.icon} ` : ""}{c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="quantity" className="block text-sm text-neutral-400">
            {t("PurchaseForm.quantity")}
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min="1"
            required
            className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="unit" className="block text-sm text-neutral-400">
            {t("PurchaseForm.unit")}
          </label>
          <input
            id="unit"
            name="unit"
            type="text"
            className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder={t("ClaimForm.unitPlaceholder")}
          />
        </div>
      </div>

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
        disabled={submitting}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-neutral-50 shadow-[0_0_12px_rgba(14,154,167,0.3)] hover:bg-primary/80 hover:shadow-[0_0_16px_rgba(14,154,167,0.4)] transition-all duration-200 disabled:opacity-50"
      >
        {submitting ? t("SubmitForm.submitting") : t("PurchaseForm.submit")}
      </button>
    </form>
  );
}

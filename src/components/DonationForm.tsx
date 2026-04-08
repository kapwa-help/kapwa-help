import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  getOrganizations,
  getAidCategories,
  getActiveEvent,
  insertDonation,
} from "@/lib/queries";

interface Organization {
  id: string;
  name: string;
}

interface AidCategory {
  id: string;
  name: string;
  icon: string | null;
}

export default function DonationForm() {
  const { t } = useTranslation();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [categories, setCategories] = useState<AidCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [donationType, setDonationType] = useState<"cash" | "in_kind">("cash");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [eventId, setEventId] = useState<string | null>(null);

  useEffect(() => {
    getActiveEvent().then((event) => {
      if (event) {
        setEventId(event.id);
        getOrganizations(event.id).then(setOrgs).catch(() => {});
      }
    });
    getAidCategories()
      .then(setCategories)
      .catch(() => {});
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
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      if (!eventId) {
        setError(t("DonationForm.error"));
        setSubmitting(false);
        return;
      }
      await insertDonation({
        event_id: eventId,
        organization_id: formData.get("organization_id") as string,
        donor_name: (formData.get("donor_name") as string) || undefined,
        donor_type: (formData.get("donor_type") as "individual" | "organization") || undefined,
        type: donationType,
        amount: donationType === "cash" ? Number(formData.get("amount")) : undefined,
        date: (formData.get("date") as string) || new Date().toISOString().split("T")[0],
        notes: (formData.get("notes") as string) || undefined,
        category_ids: donationType === "in_kind" ? Array.from(selectedCategories) : undefined,
      });
      setSubmitted(true);
    } catch {
      setError(t("DonationForm.error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-bold text-success">{t("DonationForm.success")}</h2>
        <button
          onClick={() => {
            setSubmitted(false);
            setDonationType("cash");
            setSelectedCategories(new Set());
            setFormKey((k) => k + 1);
          }}
          className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-neutral-50 hover:bg-primary/80"
        >
          {t("ReportForm.reportDonation")}
        </button>
      </div>
    );
  }

  return (
    <form key={formKey} onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="donation_type" className="block text-sm text-neutral-400">
          {t("DonationForm.type")}
        </label>
        <select
          id="donation_type"
          value={donationType}
          onChange={(e) => setDonationType(e.target.value as "cash" | "in_kind")}
          className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="cash">{t("DonationForm.typeCash")}</option>
          <option value="in_kind">{t("DonationForm.typeInKind")}</option>
        </select>
      </div>

      <div>
        <label htmlFor="organization_id" className="block text-sm text-neutral-400">
          {t("DonationForm.organization")}
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

      {/* Donor name */}
      <div>
        <label htmlFor="donor_name" className="block text-sm text-neutral-400">
          {t("DonationForm.donorName")}
        </label>
        <input
          id="donor_name"
          name="donor_name"
          type="text"
          className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={t("DonationForm.donorNamePlaceholder")}
        />
      </div>

      {/* Donor type */}
      <div>
        <label htmlFor="donor_type" className="block text-sm text-neutral-400">
          {t("DonationForm.donorType")}
        </label>
        <select
          id="donor_type"
          name="donor_type"
          className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">{t("DonationForm.donorTypePlaceholder")}</option>
          <option value="individual">{t("DonationForm.individual")}</option>
          <option value="organization">{t("DonationForm.donorOrganization")}</option>
        </select>
      </div>

      {donationType === "cash" ? (
        <div>
          <label htmlFor="amount" className="block text-sm text-neutral-400">
            {t("DonationForm.amount")}
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            min="1"
            step="0.01"
            required
            className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-base px-4 py-3 text-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="0.00"
          />
        </div>
      ) : (
        <fieldset>
          <legend className="text-sm text-neutral-400">
            {t("DonationForm.category")}
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
      )}

      <div>
        <label htmlFor="date" className="block text-sm text-neutral-400">
          {t("DonationForm.date")}
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
          {t("DonationForm.notes")}
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
        {submitting ? t("SubmitForm.submitting") : t("DonationForm.submit")}
      </button>
    </form>
  );
}

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  getOrganizations,
  getAidCategories,
  getActiveEvent,
  insertDonation,
  type DonationInsert,
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

export default function DonationForm() {
  const { t } = useTranslation();
  const { refreshCount } = useOutbox();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [categories, setCategories] = useState<AidCategory[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [donationType, setDonationType] = useState<"cash" | "in_kind">("cash");
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
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      if (!eventId) {
        setError(t("DonationForm.error"));
        setSubmitting(false);
        return;
      }
      const id = crypto.randomUUID();
      const payload: DonationInsert = {
        id,
        event_id: eventId,
        organization_id: formData.get("organization_id") as string,
        donor_name: (formData.get("donor_name") as string) || undefined,
        donor_type: (formData.get("donor_type") as "individual" | "organization") || undefined,
        type: donationType,
        amount: donationType === "cash" ? Number(formData.get("amount")) : undefined,
        date: (formData.get("date") as string) || new Date().toISOString().split("T")[0],
        notes: (formData.get("notes") as string) || undefined,
        category_ids: donationType === "in_kind" ? Array.from(selectedCategories) : undefined,
      };

      try {
        await insertDonation(payload);
        setSubmitted(true);
      } catch {
        try {
          await addToOutbox({ type: "donation", payload });
          refreshCount();
          setSavedOffline(true);
          setSubmitted(true);
        } catch {
          setError(t("DonationForm.error"));
        }
      }
    } catch {
      setError(t("DonationForm.error"));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <FormSuccess>
        <h2 className={`text-xl font-bold ${savedOffline ? "text-warning" : "text-success"}`}>
          {t(savedOffline ? "DonationForm.savedTitle" : "DonationForm.success")}
        </h2>
        <p className="mt-2 text-neutral-400">
          {t(savedOffline ? "DonationForm.savedMessage" : "DonationForm.successMessage")}
        </p>
        <FormSuccessButton
          onClick={() => {
            setSubmitted(false);
            setSavedOffline(false);
            setDonationType("cash");
            setSelectedCategories(new Set());
            setFormKey((k) => k + 1);
          }}
        >
          {t("ReportForm.reportDonation")}
        </FormSuccessButton>
      </FormSuccess>
    );
  }

  return (
    <form key={formKey} onSubmit={handleSubmit} className="space-y-5">
      <div>
        <FormLabel htmlFor="donation_type" required>
          {t("DonationForm.type")}
        </FormLabel>
        <FormSelect
          id="donation_type"
          value={donationType}
          onChange={(e) => setDonationType(e.target.value as "cash" | "in_kind")}
        >
          <option value="cash">{t("DonationForm.typeCash")}</option>
          <option value="in_kind">{t("DonationForm.typeInKind")}</option>
        </FormSelect>
      </div>

      <div>
        <FormLabel htmlFor="organization_id" required>
          {t("DonationForm.organization")}
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

      {/* Donor name */}
      <div>
        <FormLabel htmlFor="donor_name">{t("DonationForm.donorName")}</FormLabel>
        <FormInput
          id="donor_name"
          name="donor_name"
          type="text"
          placeholder={t("DonationForm.donorNamePlaceholder")}
        />
      </div>

      {/* Donor type */}
      <div>
        <FormLabel htmlFor="donor_type">{t("DonationForm.donorType")}</FormLabel>
        <FormSelect id="donor_type" name="donor_type">
          <option value="">{t("DonationForm.donorTypePlaceholder")}</option>
          <option value="individual">{t("DonationForm.individual")}</option>
          <option value="organization">{t("DonationForm.donorOrganization")}</option>
        </FormSelect>
      </div>

      {donationType === "cash" ? (
        <div>
          <FormLabel htmlFor="amount" required>
            {t("DonationForm.amount")}
          </FormLabel>
          <FormInput
            id="amount"
            name="amount"
            type="number"
            min="1"
            step="0.01"
            required
            placeholder="0.00"
          />
        </div>
      ) : (
        <fieldset>
          <FormLegend required>{t("DonationForm.category")}</FormLegend>
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
      )}

      <div>
        <FormLabel htmlFor="date" required>{t("DonationForm.date")}</FormLabel>
        <FormInput
          id="date"
          name="date"
          type="date"
          defaultValue={new Date().toISOString().split("T")[0]}
        />
      </div>

      <div>
        <FormLabel htmlFor="notes">{t("DonationForm.notes")}</FormLabel>
        <FormTextarea id="notes" name="notes" rows={3} />
      </div>

      <FormError message={error} />

      <FormSubmitButton disabled={submitting}>
        {submitting ? t("SubmitForm.submitting") : t("DonationForm.submit")}
      </FormSubmitButton>
    </form>
  );
}

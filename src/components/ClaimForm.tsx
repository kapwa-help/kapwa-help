import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  getOrganizations,
  getAidCategories,
  createDeploymentForNeed,
  getActiveEvent,
} from "@/lib/queries";
import type { NeedPoint } from "@/lib/queries";

type Props = {
  point: NeedPoint;
  onClaimed: () => void;
};

export default function ClaimForm({ point, onClaimed }: Props) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dropdown data
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Form state
  const [orgId, setOrgId] = useState("");
  const [catId, setCatId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  async function handleOpen() {
    setIsOpen(true);
    try {
      const [orgData, catData] = await Promise.all([
        getOrganizations(),
        getAidCategories(),
      ]);
      setOrgs(orgData);
      setCategories(catData);
    } catch {
      setError(t("ClaimForm.error"));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !catId || !isOnline) return;

    setSubmitting(true);
    setError(null);

    try {
      const event = await getActiveEvent();
      await createDeploymentForNeed({
        event_id: event?.id ?? null,
        organization_id: orgId,
        aid_category_id: catId,
        submission_id: point.id,
        barangay_id: null,
        quantity: quantity ? parseInt(quantity, 10) : null,
        unit: unit || null,
        lat: point.lat,
        lng: point.lng,
        notes: notes || null,
      });
      onClaimed();
    } catch {
      setError(t("ClaimForm.error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        disabled={!isOnline}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-neutral-50 hover:bg-primary/80 disabled:opacity-40"
      >
        {t("ClaimForm.respondButton")}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h4 className="text-sm font-semibold text-neutral-50">
        {t("ClaimForm.title")}
      </h4>

      {/* Organization */}
      <div>
        <label className="mb-1 block text-xs text-neutral-400">
          {t("ClaimForm.organization")}
        </label>
        <select
          aria-label={t("ClaimForm.organization")}
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          required
          className="w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-sm text-neutral-50"
        >
          <option value="">{t("ClaimForm.organizationPlaceholder")}</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      {/* Aid Category */}
      <div>
        <label className="mb-1 block text-xs text-neutral-400">
          {t("ClaimForm.aidCategory")}
        </label>
        <select
          aria-label={t("ClaimForm.aidCategory")}
          value={catId}
          onChange={(e) => setCatId(e.target.value)}
          required
          className="w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-sm text-neutral-50"
        >
          <option value="">{t("ClaimForm.aidCategoryPlaceholder")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Quantity + Unit row */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-neutral-400">
            {t("ClaimForm.quantity")}
          </label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={t("ClaimForm.quantityPlaceholder")}
            className="w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-400/40"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-neutral-400">
            {t("ClaimForm.unit")}
          </label>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder={t("ClaimForm.unitPlaceholder")}
            className="w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-400/40"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="mb-1 block text-xs text-neutral-400">
          {t("ClaimForm.notes")}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("ClaimForm.notesPlaceholder")}
          rows={2}
          className="w-full rounded-lg border border-neutral-400/20 bg-base px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-400/40"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!orgId || !catId || !isOnline || submitting}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-neutral-50 hover:bg-primary/80 disabled:opacity-40"
      >
        {submitting ? t("ClaimForm.submitting") : t("ClaimForm.submit")}
      </button>

      {error && (
        <p className="text-center text-xs text-error">{error}</p>
      )}
    </form>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import SubmitForm from "@/components/SubmitForm";
import DonationForm from "@/components/DonationForm";
import PurchaseForm from "@/components/PurchaseForm";
import HazardForm from "@/components/HazardForm";

export function ReportPage() {
  const { t } = useTranslation();
  const [formType, setFormType] = useState<"need" | "donation" | "purchase" | "hazard">("need");

  return (
    <div className="min-h-dvh bg-base">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-neutral-50">{t("ReportForm.title")}</h1>

        {/* Form type selector */}
        <div className="mb-6">
          <label htmlFor="form-type" className="block text-sm text-neutral-400">
            {t("ReportForm.selectorLabel")}
          </label>
          <select
            id="form-type"
            value={formType}
            onChange={(e) => setFormType(e.target.value as typeof formType)}
            className="mt-1 w-full rounded-xl border border-neutral-400/20 bg-secondary px-4 py-3 text-neutral-50 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="need">{t("ReportForm.submitNeed")}</option>
            <option value="donation">{t("ReportForm.reportDonation")}</option>
            <option value="purchase">{t("ReportForm.reportPurchase")}</option>
            <option value="hazard">{t("ReportForm.reportHazard")}</option>
          </select>
        </div>

        {/* Form content */}
        {formType === "need" && <SubmitForm />}
        {formType === "donation" && <DonationForm />}
        {formType === "purchase" && <PurchaseForm />}
        {formType === "hazard" && <HazardForm />}
      </main>
    </div>
  );
}

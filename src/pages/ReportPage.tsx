import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import SubmitForm from "@/components/SubmitForm";
import DonationForm from "@/components/DonationForm";
import PurchaseForm from "@/components/PurchaseForm";
import HazardForm from "@/components/HazardForm";

export function ReportPage() {
  const { t } = useTranslation();
  const [formType, setFormType] = useState<"need" | "donation" | "purchase" | "hazard">("need");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"acquiring" | "captured" | "denied" | "idle">("idle");

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

  return (
    <div className="min-h-dvh bg-base">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-8">
        {/* Location — shared across all form types */}
        <div className="mb-4">
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
                className="text-sm text-primary hover:underline"
              >
                {t("SubmitForm.locationRetry")}
              </button>
            </div>
          )}
          {locationStatus === "idle" && (
            <button
              type="button"
              onClick={requestLocation}
              className="text-sm text-primary hover:underline"
            >
              {t("SubmitForm.shareLocation")}
            </button>
          )}
        </div>

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
        {formType === "need" && <SubmitForm coords={coords} />}
        {formType === "donation" && <DonationForm />}
        {formType === "purchase" && <PurchaseForm />}
        {formType === "hazard" && <HazardForm coords={coords} />}
      </main>
    </div>
  );
}

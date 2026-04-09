import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import SubmitForm from "@/components/SubmitForm";
import DonationForm from "@/components/DonationForm";
import PurchaseForm from "@/components/PurchaseForm";
import HazardForm from "@/components/HazardForm";

type FormType = "need" | "donation" | "purchase" | "hazard";

const formOptions: { value: FormType; labelKey: string }[] = [
  { value: "need", labelKey: "ReportForm.optionNeed" },
  { value: "donation", labelKey: "ReportForm.optionDonation" },
  { value: "purchase", labelKey: "ReportForm.optionPurchase" },
  { value: "hazard", labelKey: "ReportForm.optionHazard" },
];

export function ReportPage() {
  const { t } = useTranslation();
  const [formType, setFormType] = useState<FormType | null>(null);
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

        {/* Type selector or selected indicator */}
        {formType === null ? (
          <>
            <h1 className="mb-6 text-2xl font-bold text-neutral-50">
              {t("ReportForm.selectorLabel")}
            </h1>
            <div className="grid grid-cols-2 gap-3">
              {formOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormType(opt.value)}
                  className="rounded-xl border border-neutral-400/20 bg-secondary px-4 py-4 text-left text-sm font-medium text-neutral-50 transition-colors hover:border-primary hover:bg-primary/10"
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-3">
              <span className="rounded-lg bg-primary/20 px-3 py-1.5 text-sm font-medium text-primary">
                {t(formOptions.find((o) => o.value === formType)!.labelKey)}
              </span>
              <button
                type="button"
                onClick={() => setFormType(null)}
                className="text-sm text-neutral-400 hover:text-neutral-50 transition-colors"
              >
                {t("ReportForm.change")}
              </button>
            </div>

            {/* Form content */}
            {formType === "need" && <SubmitForm coords={coords} />}
            {formType === "donation" && <DonationForm />}
            {formType === "purchase" && <PurchaseForm />}
            {formType === "hazard" && <HazardForm coords={coords} />}
          </>
        )}
      </main>
    </div>
  );
}

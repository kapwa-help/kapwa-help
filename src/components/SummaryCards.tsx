import { useTranslation } from "react-i18next";

type Props = {
  totalDonations: number;
  totalBeneficiaries: number;
  volunteerCount: number;
  orgCount: number;
  locationCount: number;
  deploymentCount: number;
};

function TrendIcon() {
  return (
    <svg
      className="h-5 w-5 text-success"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

export default function SummaryCards({
  totalDonations,
  totalBeneficiaries,
  volunteerCount,
  orgCount,
  locationCount,
  deploymentCount,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div className="animate-fade-slide-up rounded-2xl border-l-[3px] border-success bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_6px_rgba(0,0,0,0.4),0_8px_20px_rgba(0,0,0,0.2)]" style={{ "--delay": "0ms" } as React.CSSProperties}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            {t("Dashboard.totalDonations")}
          </p>
          <TrendIcon />
        </div>
        <p className="mt-2 text-3xl font-extrabold text-success">
          ₱{totalDonations.toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {t("Dashboard.organizationCount", { count: orgCount })}
        </p>
      </div>

      <div className="animate-fade-slide-up rounded-2xl border-l-[3px] border-primary bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_6px_rgba(0,0,0,0.4),0_8px_20px_rgba(0,0,0,0.2)]" style={{ "--delay": "60ms" } as React.CSSProperties}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            {t("Dashboard.totalBeneficiaries")}
          </p>
          <TrendIcon />
        </div>
        <p className="mt-2 text-3xl font-extrabold text-neutral-50">
          {totalBeneficiaries.toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {t("Dashboard.locationsServed", { count: locationCount })}
        </p>
      </div>

      <div className="animate-fade-slide-up rounded-2xl border-l-[3px] border-primary bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_6px_rgba(0,0,0,0.4),0_8px_20px_rgba(0,0,0,0.2)]" style={{ "--delay": "120ms" } as React.CSSProperties}>
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          {t("Dashboard.volunteerCount")}
        </p>
        <p className="mt-2 text-3xl font-extrabold text-neutral-50">
          {volunteerCount.toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {t("Dashboard.acrossDeployments", { count: deploymentCount })}
        </p>
      </div>
    </div>
  );
}

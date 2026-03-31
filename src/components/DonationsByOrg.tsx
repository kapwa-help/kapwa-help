import { useTranslation } from "react-i18next";

type Props = {
  donations: { name: string; amount: number }[];
};

const BAR_COLORS = [
  "bg-primary",     // #1976D2 Blue
  "bg-accent",      // #FFC107 Amber
  "bg-success",     // #388E3C Green
  "bg-error",       // #D32F2F Red
  "bg-warning",     // #FFA000 Orange
  "bg-primary/70",  // Blue variant
  "bg-accent/70",   // Amber variant
  "bg-success/70",  // Green variant
];

export default function DonationsByOrg({ donations }: Props) {
  const { t } = useTranslation();
  const total = donations.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="rounded-2xl border-l-[3px] border-primary bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]">
      <h3 className="mb-4 text-lg font-semibold text-neutral-50">
        {t("Dashboard.donationsByOrg")}
      </h3>
      <div className="space-y-4">
        {donations.map((org, i) => {
          const pct = total > 0 ? (org.amount / total) * 100 : 0;
          return (
            <div key={org.name}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-400">{org.name}</span>
                <span className="text-neutral-400/60">{pct.toFixed(0)}%</span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-base">
                <div
                  className={`h-2 rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-right text-sm text-success">
                ₱{org.amount.toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

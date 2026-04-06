import { useTranslation } from "react-i18next";

type Deployment = {
  id: string;
  quantity: number | null;
  unit: string | null;
  date: string | null;
  orgName: string;
  categoryName: string;
  categoryIcon: string | null;
  barangayName: string;
  municipality: string;
};

type Props = {
  deployments: Deployment[];
};

export default function RecentDeployments({ deployments }: Props) {
  const { t } = useTranslation();

  if (!deployments.length) {
    return <p className="text-neutral-400">{t("Deployments.noData")}</p>;
  }

  return (
    <div className="rounded-2xl border border-neutral-400/20 bg-secondary shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]">
      <h3 className="border-b border-neutral-400/20 px-6 py-4 text-sm font-semibold text-neutral-50">
        {t("Deployments.recentDeployments")}
      </h3>
      <div className="divide-y divide-neutral-400/10">
        {deployments.map((d) => (
          <div key={d.id} className="flex items-center justify-between px-6 py-3">
            <div>
              <p className="text-sm text-neutral-50">
                {d.categoryIcon && `${d.categoryIcon} `}{d.categoryName}
              </p>
              <p className="text-xs text-neutral-400">
                {d.orgName} → {d.barangayName}, {d.municipality}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-neutral-50">
                {d.quantity?.toLocaleString() ?? "—"} {d.unit ?? ""}
              </p>
              <p className="text-xs text-neutral-400">{d.date ?? ""}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

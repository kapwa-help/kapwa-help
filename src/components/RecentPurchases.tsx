import { useTranslation } from "react-i18next";

type Purchase = {
  id: string;
  cost: number | null;
  date: string | null;
  orgName: string;
  categories: { name: string; icon: string }[];
};

type Props = {
  purchases: Purchase[];
};

export default function RecentPurchases({ purchases }: Props) {
  const { t } = useTranslation();

  if (!purchases.length) {
    return <p className="text-neutral-400">{t("ReliefOps.noPurchases")}</p>;
  }

  return (
    <div className="rounded-2xl border border-neutral-400/20 bg-secondary shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]">
      <h3 className="border-b border-neutral-400/20 px-6 py-4 text-sm font-semibold text-neutral-50">
        {t("ReliefOps.recentPurchases")}
      </h3>
      <div className="divide-y divide-neutral-400/10">
        {purchases.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-6 py-3">
            <div>
              <p className="text-sm text-neutral-50">
                {p.categories.map((c) => `${c.icon} ${c.name}`).join(", ")}
              </p>
              <p className="text-xs text-neutral-400">{p.orgName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-success">
                {p.cost != null ? `₱${Number(p.cost).toLocaleString()}` : ""}
              </p>
              <p className="text-xs text-neutral-400">{p.date ?? ""}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

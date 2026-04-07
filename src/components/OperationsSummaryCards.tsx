import { useTranslation } from "react-i18next";

type Props = {
  totalDonations: number;
  totalSpent: number;
  goodsAvailable: number;
};

export default function OperationsSummaryCards({ totalDonations, totalSpent, goodsAvailable }: Props) {
  const { t } = useTranslation();

  const cards = [
    { label: t("ReliefOps.totalDonations"), value: `₱${totalDonations.toLocaleString()}` },
    { label: t("ReliefOps.totalSpent"), value: `₱${totalSpent.toLocaleString()}` },
    { label: t("ReliefOps.goodsAvailable"), value: goodsAvailable.toLocaleString() },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-neutral-400/20 bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]"
        >
          <p className="text-sm text-neutral-400">{card.label}</p>
          <p className="mt-1 text-2xl font-bold text-success">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

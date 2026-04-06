import { useTranslation } from "react-i18next";

type Props = {
  totalDeliveries: number;
  peopleServed: { adults: number; children: number; seniorsPwd: number };
  barangaysReached: number;
};

export default function DeploymentSummaryCards({ totalDeliveries, peopleServed, barangaysReached }: Props) {
  const { t } = useTranslation();
  const totalPeople = peopleServed.adults + peopleServed.children + peopleServed.seniorsPwd;

  const cards = [
    { label: t("Deployments.totalDeliveries"), value: totalDeliveries },
    { label: t("Deployments.peopleServed"), value: totalPeople },
    { label: t("Deployments.barangaysReached"), value: barangaysReached },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-neutral-400/20 bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]"
        >
          <p className="text-sm text-neutral-400">{card.label}</p>
          <p className="mt-1 text-2xl font-bold text-neutral-50">
            {card.value.toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}

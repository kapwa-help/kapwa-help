import { useTranslation } from "react-i18next";

type InventoryItem = {
  name: string;
  icon: string | null;
  received: number;
  deployed: number;
  available: number;
};

type Props = {
  inventory: InventoryItem[];
};

export default function AvailableInventory({ inventory }: Props) {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-neutral-400/20 bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]">
      <h3 className="mb-4 text-sm font-semibold text-neutral-50">
        {t("ReliefOps.availableInventory")}
      </h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {inventory.map((item) => (
          <div
            key={item.name}
            className={`rounded-xl border border-neutral-400/20 bg-base p-4 text-center ${item.available <= 0 ? "opacity-40" : ""}`}
          >
            <span className="text-2xl">{item.icon ?? ""}</span>
            <p className="mt-1 text-sm font-medium text-neutral-50">{item.name}</p>
            <p className="text-xl font-bold text-neutral-50">{item.available}</p>
            <p className="text-xs text-neutral-400">
              {item.received} {t("ReliefOps.received")} · {item.deployed} {t("ReliefOps.deployed")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

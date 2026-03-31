import { useTranslation } from "react-i18next";

type Props = {
  categories: { name: string; icon: string | null; total: number }[];
};

const CATEGORY_ICONS: Record<string, string> = {
  "Water Filtration": "💧",
  "Meals": "🍽️",
  "Relief Goods": "📦",
  "Construction Materials": "🔨",
  "Cleaning Supplies": "✨",
  "Drinking Water": "🚰",
  "Kiddie Packs": "🎒",
  "Food Supplies": "🍚",
  "Medical Supplies": "💊",
  "Shelter Materials": "🏠",
  "Water & Sanitation": "🚿",
  "Emergency Kits": "🚨",
};

export default function GoodsByCategory({ categories }: Props) {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-neutral-400/20 bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]">
      <h3 className="mb-4 text-lg font-semibold text-neutral-50">
        {t("Dashboard.goodsPurchased")}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {categories.map((cat) => (
          <div
            key={cat.name}
            className="rounded-lg bg-base/50 p-4 text-center"
          >
            <p className="text-3xl">
              {CATEGORY_ICONS[cat.name] || "📋"}
            </p>
            <p className="mt-1 text-sm text-neutral-400">{cat.name}</p>
            <p className="mt-1 text-lg font-bold text-primary">
              {cat.total.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

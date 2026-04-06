import { useTranslation } from "react-i18next";

export type LayerVisibility = {
  needs: boolean;
  hubs: boolean;
  hazards: boolean;
};

type Props = {
  layers: LayerVisibility;
  onToggle: (layer: keyof LayerVisibility) => void;
};

const NEED_STATUSES = [
  { key: "pending", color: "bg-neutral-400" },
  { key: "verified", color: "bg-error" },
  { key: "inTransit", color: "bg-warning" },
  { key: "completed", color: "bg-success" },
] as const;

export default function MapLegend({ layers, onToggle }: Props) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-neutral-400/20 bg-secondary/90 p-3 backdrop-blur-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        {t("ReliefMap.legend")}
      </p>

      {/* Needs toggle + sub-legend */}
      <label className="flex cursor-pointer items-center gap-2 py-1">
        <input
          type="checkbox"
          checked={layers.needs}
          onChange={() => onToggle("needs")}
          aria-label={t("ReliefMap.layerNeeds")}
          className="accent-primary"
        />
        <span className="text-sm text-neutral-50">{t("ReliefMap.layerNeeds")}</span>
      </label>
      {layers.needs && (
        <div className="ml-6 space-y-0.5">
          {NEED_STATUSES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${s.color}`} />
              <span className="text-xs text-neutral-400">
                {t(`ReliefMap.status${s.key.charAt(0).toUpperCase()}${s.key.slice(1)}`)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Hubs toggle */}
      <label className="flex cursor-pointer items-center gap-2 py-1">
        <input
          type="checkbox"
          checked={layers.hubs}
          onChange={() => onToggle("hubs")}
          aria-label={t("ReliefMap.layerHubs")}
          className="accent-primary"
        />
        <span className="text-sm text-neutral-50">{t("ReliefMap.layerHubs")}</span>
      </label>

      {/* Hazards toggle */}
      <label className="flex cursor-pointer items-center gap-2 py-1">
        <input
          type="checkbox"
          checked={layers.hazards}
          onChange={() => onToggle("hazards")}
          aria-label={t("ReliefMap.layerHazards")}
          className="accent-primary"
        />
        <span className="text-sm text-neutral-50">{t("ReliefMap.layerHazards")}</span>
      </label>
    </div>
  );
}

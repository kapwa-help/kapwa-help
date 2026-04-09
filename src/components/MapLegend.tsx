import { useState } from "react";
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
] as const;

export default function MapLegend({ layers, onToggle }: Props) {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const legendContent = (
    <>
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
          <div className="flex items-center gap-1.5">
            <span className="pulse-critical h-2 w-2 rounded-full bg-neutral-50" />
            <span className="text-xs text-neutral-400">
              {t("ReliefMap.urgencyCritical")}
            </span>
          </div>
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
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" className="shrink-0">
          <path d="M12 3L2 12h3v8h14v-8h3L12 3z" fill="var(--color-primary)" stroke="var(--color-neutral-50)" strokeWidth="1.5"/>
        </svg>
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
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="13" viewBox="0 0 24 22" className="shrink-0">
          <path d="M12 2L1 21h22L12 2z" fill="var(--color-warning)" stroke="var(--color-neutral-50)" strokeWidth="1"/>
          <text x="12" y="18" textAnchor="middle" fontSize="14" fontWeight="bold" fill="var(--color-base)">!</text>
        </svg>
        <span className="text-sm text-neutral-50">{t("ReliefMap.layerHazards")}</span>
      </label>
    </>
  );

  return (
    <>
      {/* Desktop: always-visible polished legend */}
      <div className="hidden rounded-xl border border-neutral-400/20 bg-secondary/90 p-3 shadow-[0_2px_8px_rgba(0,0,0,0.3)] backdrop-blur-sm lg:block">
        {legendContent}
      </div>

      {/* Mobile: collapsible with toggle button */}
      <div className="lg:hidden">
        {mobileOpen && (
          <div className="mb-2 rounded-xl border border-neutral-400/20 bg-secondary/90 p-3 shadow-[0_2px_8px_rgba(0,0,0,0.3)] backdrop-blur-sm">
            {legendContent}
          </div>
        )}
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={t("ReliefMap.legend")}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-400/20 bg-secondary/90 shadow-[0_2px_8px_rgba(0,0,0,0.3)] backdrop-blur-sm"
        >
          {/* Layers stack icon */}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-50)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </button>
      </div>
    </>
  );
}

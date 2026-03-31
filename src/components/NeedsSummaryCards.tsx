import { useTranslation } from "react-i18next";

type NeedsSummary = {
  total: number;
  byStatus: { pending: number; verified: number; in_transit: number; completed: number };
  byGap: { lunas: number; sustenance: number; shelter: number };
  byAccess: { truck: number; "4x4": number; boat: number; foot_only: number; cut_off: number };
  critical: number;
};

type Props = {
  summary: NeedsSummary;
};

export default function NeedsSummaryCards({ summary }: Props) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {/* Active Needs */}
      <div className="animate-fade-slide-up rounded-2xl border-l-[3px] border-error bg-secondary p-5 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_6px_rgba(0,0,0,0.4),0_8px_20px_rgba(0,0,0,0.2)]" style={{ "--delay": "0ms" } as React.CSSProperties}>
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          {t("Dashboard.activeNeeds")}
        </p>
        <p className="mt-2 text-3xl font-extrabold text-error">
          {summary.byStatus.verified}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {t("Dashboard.awaitingResponse")}
        </p>
      </div>

      {/* In Transit */}
      <div className="animate-fade-slide-up rounded-2xl border-l-[3px] border-warning bg-secondary p-5 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_6px_rgba(0,0,0,0.4),0_8px_20px_rgba(0,0,0,0.2)]" style={{ "--delay": "60ms" } as React.CSSProperties}>
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          {t("Dashboard.inTransit")}
        </p>
        <p className="mt-2 text-3xl font-extrabold text-warning">
          {summary.byStatus.in_transit}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {t("Dashboard.helpOnTheWay")}
        </p>
      </div>

      {/* Fulfilled */}
      <div className="animate-fade-slide-up rounded-2xl border-l-[3px] border-success bg-secondary p-5 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_6px_rgba(0,0,0,0.4),0_8px_20px_rgba(0,0,0,0.2)]" style={{ "--delay": "120ms" } as React.CSSProperties}>
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          {t("Dashboard.fulfilled")}
        </p>
        <p className="mt-2 text-3xl font-extrabold text-success">
          {summary.byStatus.completed}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {t("Dashboard.needsMet")}
        </p>
      </div>

      {/* Critical */}
      <div className="animate-fade-slide-up rounded-2xl border-l-[3px] border-error bg-secondary p-5 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_6px_rgba(0,0,0,0.4),0_8px_20px_rgba(0,0,0,0.2)]" style={{ "--delay": "180ms" } as React.CSSProperties}>
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          {t("Dashboard.criticalNeeds")}
        </p>
        <p className="mt-2 text-3xl font-extrabold text-error">
          {summary.critical}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {t("Dashboard.immediateAttention")}
        </p>
      </div>
    </div>
  );
}

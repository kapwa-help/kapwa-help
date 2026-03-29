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
      <div className="rounded-xl border border-neutral-400/20 bg-secondary p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          {t("Dashboard.activeNeeds")}
        </p>
        <p className="mt-2 text-3xl font-bold text-error">
          {summary.byStatus.verified}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {t("Dashboard.awaitingResponse")}
        </p>
      </div>

      {/* In Transit */}
      <div className="rounded-xl border border-neutral-400/20 bg-secondary p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          {t("Dashboard.inTransit")}
        </p>
        <p className="mt-2 text-3xl font-bold text-warning">
          {summary.byStatus.in_transit}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {t("Dashboard.helpOnTheWay")}
        </p>
      </div>

      {/* Fulfilled */}
      <div className="rounded-xl border border-neutral-400/20 bg-secondary p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          {t("Dashboard.fulfilled")}
        </p>
        <p className="mt-2 text-3xl font-bold text-success">
          {summary.byStatus.completed}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {t("Dashboard.needsMet")}
        </p>
      </div>

      {/* Critical */}
      <div className="rounded-xl border border-neutral-400/20 bg-secondary p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
          {t("Dashboard.criticalNeeds")}
        </p>
        <p className="mt-2 text-3xl font-bold text-error">
          {summary.critical}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {t("Dashboard.immediateAttention")}
        </p>
      </div>
    </div>
  );
}

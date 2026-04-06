import { useTranslation } from "react-i18next";
import type { BarangayDistributionEntry } from "@/lib/cache";

type Props = {
  distribution: BarangayDistributionEntry[];
};

export default function BarangayEquity({ distribution }: Props) {
  const { t } = useTranslation();

  if (distribution.length === 0) return null;

  return (
    <div className="rounded-2xl border border-neutral-400/20 bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]">
      <h2 className="mb-4 text-lg font-semibold text-neutral-50">
        {t("Transparency.barangayEquity")}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-400/20 text-left text-neutral-400">
              <th className="pb-2 font-medium">{t("Transparency.barangay")}</th>
              <th className="pb-2 font-medium">{t("Transparency.categories")}</th>
              <th className="pb-2 text-right font-medium">
                {t("Transparency.totalReceived")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-400/10">
            {distribution.map((b) => (
              <tr key={b.id}>
                <td className="py-2 text-neutral-50">
                  {b.name}
                  <span className="ml-1 text-xs text-neutral-400">
                    {b.municipality}
                  </span>
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1">
                    {b.categories.map((c) => (
                      <span
                        key={c.name}
                        className="rounded bg-base/30 px-1.5 py-0.5 text-xs text-neutral-100"
                        title={c.name}
                      >
                        {c.icon ?? ""} {c.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-2 text-right font-medium text-neutral-50">
                  {b.totalQuantity}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

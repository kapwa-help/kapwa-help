import { useTranslation } from "react-i18next";
import Header from "@/components/Header";

export function DeploymentsPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-dvh bg-base">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-2xl font-bold text-neutral-50">{t("Deployments.title")}</h1>
      </main>
    </div>
  );
}

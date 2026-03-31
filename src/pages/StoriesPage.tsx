import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import StatusFooter from "@/components/StatusFooter";

export function StoriesPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-base">
      <Header />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-50">
            {t("Navigation.stories")}
          </h1>
          <p className="mt-4 text-neutral-400">
            {t("Stories.comingSoon")}
          </p>
        </div>
      </main>
      <StatusFooter />
    </div>
  );
}

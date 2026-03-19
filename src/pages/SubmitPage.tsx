import { useTranslation } from "react-i18next";
import Header from "@/components/Header";
import SubmitForm from "@/components/SubmitForm";

export function SubmitPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-base">
      <Header />
      <main className="mx-auto max-w-lg px-6 py-8">
        <h1 className="mb-6 text-center text-2xl font-bold text-neutral-50">
          {t("SubmitForm.title")}
        </h1>
        <div className="rounded-xl border border-neutral-400/20 bg-secondary p-6">
          <SubmitForm />
        </div>
      </main>
    </div>
  );
}

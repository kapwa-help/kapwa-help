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
        <div className="rounded-2xl border-l-[3px] border-accent bg-secondary p-6 shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_12px_rgba(0,0,0,0.15)]">
          <SubmitForm />
        </div>
      </main>
    </div>
  );
}

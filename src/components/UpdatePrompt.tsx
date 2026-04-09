import { useRegisterSW } from "virtual:pwa-register/react";

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-0 left-0 right-0 z-[10000] flex items-center justify-between bg-primary px-4 py-3 text-sm text-neutral-50 shadow-[0_-2px_8px_rgba(0,0,0,0.3)]"
    >
      <span>New version available</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="rounded-lg bg-neutral-50 px-4 py-1.5 font-semibold text-primary"
      >
        Update
      </button>
    </div>
  );
}

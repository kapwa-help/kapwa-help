import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getOutboxCount,
  getOutboxEntries,
  removeFromOutbox,
} from "@/lib/form-cache";
import { insertNeed } from "@/lib/queries";

type OutboxContextValue = {
  pendingCount: number;
  refreshCount: () => void;
};

const OutboxContext = createContext<OutboxContextValue | null>(null);

export function OutboxProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const flushingRef = useRef(false);

  const refreshCount = useCallback(() => {
    getOutboxCount().then(setPendingCount).catch(() => {});
  }, []);

  const flushOutbox = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const entries = await getOutboxEntries();
      for (const entry of entries) {
        try {
          await insertNeed(entry.payload);
          await removeFromOutbox(entry.key);
        } catch (err: unknown) {
          const isUniqueViolation =
            err &&
            typeof err === "object" &&
            "code" in err &&
            (err as { code: string }).code === "23505";
          if (isUniqueViolation) {
            await removeFromOutbox(entry.key);
          }
        }
      }
      refreshCount();
    } finally {
      flushingRef.current = false;
    }
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    const handleOnline = () => {
      flushOutbox();
    };
    window.addEventListener("online", handleOnline);

    if (navigator.onLine) {
      flushOutbox();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [flushOutbox]);

  return (
    <OutboxContext.Provider value={{ pendingCount, refreshCount }}>
      {children}
    </OutboxContext.Provider>
  );
}

export function useOutbox(): OutboxContextValue {
  const context = useContext(OutboxContext);
  if (!context) {
    throw new Error("useOutbox must be used within an OutboxProvider");
  }
  return context;
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getOutboxCount } from "@/lib/form-cache";

type OutboxContextValue = {
  pendingCount: number;
  refreshCount: () => void;
};

const OutboxContext = createContext<OutboxContextValue | null>(null);

export function OutboxProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);

  const refreshCount = useCallback(() => {
    getOutboxCount().then(setPendingCount).catch(() => {});
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

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

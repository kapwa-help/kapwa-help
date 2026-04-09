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
import { insertNeed, insertDonation, insertPurchase, insertHazard } from "@/lib/queries";
import { uploadPhoto } from "@/lib/photo";

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
      for (const { key, entry } of entries) {
        try {
          switch (entry.type) {
            case "need":
              await insertNeed(entry.payload);
              break;
            case "donation":
              await insertDonation(entry.payload);
              break;
            case "purchase":
              await insertPurchase(entry.payload);
              break;
            case "hazard":
              if (entry.photo) {
                const hazardId = entry.payload.id ?? crypto.randomUUID();
                const url = await uploadPhoto("photos", `hazards/${hazardId}.jpg`, entry.photo);
                if (url) entry.payload.photo_url = url;
              }
              await insertHazard(entry.payload);
              break;
          }
          await removeFromOutbox(key);
        } catch (err: unknown) {
          const isUniqueViolation =
            err &&
            typeof err === "object" &&
            "code" in err &&
            (err as { code: string }).code === "23505";
          if (isUniqueViolation) {
            await removeFromOutbox(key);
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

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

import { useEntitlement } from "@/features/entitlement";
import { PaywallModal } from "./PaywallModal";

interface PaywallContextValue {
  /** Open the paywall. `source` is passed through to analytics. */
  openPaywall: (source?: string) => void;
  closePaywall: () => void;
  isOpen: boolean;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

export function PaywallProvider({ children }: { children: React.ReactNode }) {
  const { isPro } = useEntitlement();
  const [isOpen, setIsOpen] = useState(false);
  const [source, setSource] = useState<string | undefined>(undefined);

  const openPaywall = useCallback(
    (src?: string) => {
      // Never show the paywall to someone who already has Pro.
      if (isPro) return;
      setSource(src);
      setIsOpen(true);
    },
    [isPro]
  );

  const closePaywall = useCallback(() => setIsOpen(false), []);

  return (
    <PaywallContext.Provider value={{ openPaywall, closePaywall, isOpen }}>
      {children}
      {isOpen && <PaywallModal source={source} onClose={closePaywall} />}
    </PaywallContext.Provider>
  );
}

export function usePaywall(): PaywallContextValue {
  const ctx = useContext(PaywallContext);
  if (!ctx) {
    throw new Error("usePaywall must be used within a PaywallProvider");
  }
  return ctx;
}

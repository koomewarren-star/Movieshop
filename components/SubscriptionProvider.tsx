'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'movieshop:subscription';

/**
 * Reads the stored flag synchronously.
 *
 * `useSubscription().isSubscribed` is false until the effect above runs, so a
 * subscribed viewer who clicks during that first paint would be shown the
 * paywall. Gates call this directly to close that window.
 */
export function hasStoredSubscription(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return Boolean(raw && (JSON.parse(raw) as Subscription)?.isSubscribed);
  } catch {
    return false;
  }
}

export interface Subscription {
  isSubscribed: true;
  phone: string;
  since: string;
  checkoutRequestId: string;
  planName: string;
  priceBob: number;
}

interface SubscriptionContextValue {
  isSubscribed: boolean;
  /** True once localStorage has been read, to avoid badge flicker. */
  ready: boolean;
  subscription: Subscription | null;
  subscribe: (details: { phone: string; checkoutRequestId: string }) => void;
  cancel: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Subscription;
        if (parsed?.isSubscribed) setSubscription(parsed);
      }
    } catch {
      // Private mode or corrupted payload — stay unsubscribed.
    } finally {
      setReady(true);
    }
  }, []);

  const subscribe = useCallback(
    ({ phone, checkoutRequestId }: { phone: string; checkoutRequestId: string }) => {
      const next: Subscription = {
        isSubscribed: true,
        phone,
        since: new Date().toISOString(),
        checkoutRequestId,
        planName: 'MovieShop Access Pass',
        priceBob: 50,
      };
      setSubscription(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Non-fatal: access still granted for this session.
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    setSubscription(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // no-op
    }
  }, []);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      isSubscribed: Boolean(subscription?.isSubscribed),
      ready,
      subscription,
      subscribe,
      cancel,
    }),
    [subscription, ready, subscribe, cancel],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used inside <SubscriptionProvider>');
  return ctx;
}

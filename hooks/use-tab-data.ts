import { useCallback, useEffect, useRef, useState } from "react";
import { getTabData } from "@/app/yonetim/adisyon/actions";
import type { TabData } from "@/lib/tab/types";

/**
 * Polls the tab data every few seconds while the page is visible, so lines
 * added by the other station show up without a reload. A fetch that started
 * before the latest local mutation is discarded so it cannot undo an
 * optimistic update.
 */
export function useTabData(initial: TabData, intervalMs = 5000) {
  const [data, setData] = useState(initial);
  const [offline, setOffline] = useState(false);
  const mutatedAt = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    const started = Date.now();
    const request = (async () => {
      try {
        const next = await getTabData();
        if (started >= mutatedAt.current) setData(next);
        setOffline(false);
      } catch {
        setOffline(true);
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = request;
    return request;
  }, []);

  /** Apply a local change immediately; polling will confirm it shortly. */
  const mutate = useCallback((update: (current: TabData) => TabData) => {
    mutatedAt.current = Date.now();
    setData(update);
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", tick);
    };
  }, [refresh, intervalMs]);

  return { data, mutate, refresh, offline };
}

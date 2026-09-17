"use client";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { logoutAdmin } from "@/app/yonetim/actions";
import { useTabData } from "@/hooks/use-tab-data";
import { formatTime, stationForRole } from "@/lib/tab/calc";
import {
  staffRoles,
  stations,
  type StaffUser,
  type Station,
  type TabData,
} from "@/lib/tab/types";
import { TabGuestDetail } from "@/components/tab-guest-detail";
import { TabGuestList } from "@/components/tab-guest-list";
import { TabSettings } from "@/components/tab-settings";
import { TabSummary } from "@/components/tab-summary";

type View = "list" | "summary" | "settings";
export type ToastAction = { label: string; run: () => void };
export type Notify = (
  text: string,
  kind?: "ok" | "error",
  action?: ToastAction,
) => void;

// The organiser's chosen station lives in localStorage; bar and pizza
// accounts are fixed to their own station.
const STATION_KEY = "soul.tab.station";
const stationListeners = new Set<() => void>();
const readStation = (): Station | null => {
  try {
    const saved = localStorage.getItem(STATION_KEY);
    return saved === "bar" || saved === "pizza" ? saved : null;
  } catch {
    return null;
  }
};
const subscribeStation = (listener: () => void) => {
  stationListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    stationListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
};
const writeStation = (next: Station) => {
  try {
    localStorage.setItem(STATION_KEY, next);
  } catch {}
  stationListeners.forEach((listener) => listener());
};

export function TabModule({
  user,
  initial,
}: {
  user: StaffUser;
  initial: TabData;
}) {
  const { data, mutate, refresh, offline } = useTabData(initial);
  const isAdmin = user.role === "admin";
  const [view, setView] = useState<View>("list");
  const [current, setCurrent] = useState<string | null>(null);
  const savedStation = useSyncExternalStore(
    subscribeStation,
    readStation,
    () => null,
  );
  const station: Station = isAdmin
    ? (savedStation ?? "bar")
    : stationForRole(user.role);
  const [toast, setToast] = useState<{
    id: number;
    text: string;
    kind: "ok" | "error";
    action?: ToastAction;
  } | null>(null);

  const notify = useCallback<Notify>(
    (text, kind = "ok", action) =>
      setToast({ id: Date.now(), text, kind, action }),
    [],
  );
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(
      () => setToast(null),
      toast.kind === "error" ? 4500 : toast.action ? 4000 : 1800,
    );
    return () => clearTimeout(timer);
  }, [toast]);

  // The detail screen gets a history entry so the phone's back gesture
  // returns to the list instead of leaving the console.
  const openGuest = useCallback((id: string) => {
    setView("list");
    setCurrent(id);
    // Only one detail entry sits on top of the list entry, so "back" always
    // returns to the list even when a detail was left through the tab bar.
    if (window.history.state?.tabGuest)
      window.history.replaceState({ tabGuest: id }, "");
    else window.history.pushState({ tabGuest: id }, "");
    window.scrollTo(0, 0);
  }, []);
  const closeGuest = useCallback(() => {
    if (window.history.state?.tabGuest) window.history.back();
    else setCurrent(null);
  }, []);
  useEffect(() => {
    const onPop = (e: PopStateEvent) =>
      setCurrent(
        typeof e.state?.tabGuest === "string" ? e.state.tabGuest : null,
      );
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // A guest deleted from another device simply falls back to the list.
  const guest =
    (current && data.guests.find((g) => g.id === current)) || null;

  const showView = (next: View) => {
    setView(next);
    setCurrent(null);
    if (window.history.state?.tabGuest) window.history.replaceState({}, "");
    window.scrollTo(0, 0);
  };

  return (
    <div className="ad tab">
      <header className="ad-header tab-header">
        <Link href="/" className="ad-brand">
          <Image src="/assets/brand-mark.png" alt="" width={32} height={40} />
          Açık Hesap
        </Link>
        <div>
          <span className="tab-user">
            {user.name} · {staffRoles[user.role]}
          </span>
          {isAdmin && <Link href="/yonetim">Yönetim →</Link>}
          <form action={logoutAdmin}>
            <button>Çıkış yap</button>
          </form>
        </div>
      </header>
      <nav className="tab-nav" aria-label="Açık Hesap bölümleri">
        <button
          aria-current={view === "list" ? "page" : undefined}
          onClick={() => showView("list")}
        >
          Hesaplar
        </button>
        <button
          aria-current={view === "summary" ? "page" : undefined}
          onClick={() => showView("summary")}
        >
          Özet
        </button>
        {isAdmin && (
          <button
            aria-current={view === "settings" ? "page" : undefined}
            onClick={() => showView("settings")}
          >
            Ayarlar
          </button>
        )}
      </nav>
      <main className="ad-wrap tab-wrap">
        {offline && (
          <p className="ad-error" role="alert">
            Bağlantı kesildi. Son alınan bilgiler gösteriliyor; ekleme ve
            ödemeler bağlantı gelince tekrar dene.
          </p>
        )}
        {isAdmin && view === "list" && (
          <div className="tab-station" role="group" aria-label="İstasyon">
            <span>İstasyon</span>
            {(Object.keys(stations) as Station[]).map((id) => (
              <button
                key={id}
                className="tab-chip"
                aria-pressed={station === id}
                onClick={() => writeStation(id)}
              >
                {stations[id]}
              </button>
            ))}
          </div>
        )}
        {view === "list" && guest && (
          <TabGuestDetail
            key={guest.id}
            user={user}
            station={station}
            guest={guest}
            data={data}
            mutate={mutate}
            refresh={refresh}
            notify={notify}
            onBack={closeGuest}
          />
        )}
        {view === "list" && !guest && (
          <TabGuestList
            data={data}
            onOpen={openGuest}
            refresh={refresh}
            notify={notify}
          />
        )}
        {view === "summary" && <TabSummary data={data} />}
        {view === "settings" && isAdmin && (
          <TabSettings
            data={data}
            refresh={refresh}
            notify={notify}
          />
        )}
        <p className="ad-note tab-sync" aria-live="polite">
          Her 5 saniyede yenilenir · Son: {formatTime(data.fetchedAt)}
        </p>
      </main>
      <div
        className={`tab-toast ${toast ? "show" : ""} ${toast?.kind ?? ""}`}
        role="status"
        aria-live="polite"
      >
        <span>{toast?.text}</span>
        {toast?.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.run();
              setToast(null);
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  );
}

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { liveQuery } from "dexie";
import { db, accountKey, storageError } from "../data/db";
import { engine } from "../data/engine";
import type { Snapshot } from "../data/types";
export type Tab = "map" | "chat" | "camera" | "stories" | "spotlight";
export type Route = {
  name:
    | "profile"
    | "settings"
    | "friends"
    | "friend"
    | "conversation"
    | "memories"
    | "media"
    | "capture"
    | "send"
    | "story"
    | "notifications"
    | "avatar"
    | "call"
    | "dev";
  id?: string;
  index?: number;
  incoming?: boolean;
};
type Context = {
  data: Snapshot;
  tab: Tab;
  setTab: (tab: Tab) => void;
  routes: Route[];
  open: (r: Route) => void;
  back: () => void;
  home: (tab?: Tab) => void;
  active: string | null;
  switchAccount: (id: string) => void;
  newAccount: () => void;
  toast: (text: string) => void;
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  vaultKey: CryptoKey | null;
  setVaultKey: (key: CryptoKey | null) => void;
};
const AppContext = createContext<Context>(null!);
export const useApp = () => useContext(AppContext);
const empty: Snapshot = {
  accounts: [],
  users: [],
  friends: [],
  messages: [],
  media: [],
  stories: [],
  activities: [],
  events: [],
};
export function AppProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<string | null>(() =>
    localStorage.getItem(accountKey),
  );
  const [data, setData] = useState(empty);
  const [tab, setTabState] = useState<Tab>("camera");
  const [routes, setRoutes] = useState<Route[]>([]);
  const [notice, setNotice] = useState("");
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sub = liveQuery(() => db.snapshot(active)).subscribe({
      next: (value) => {
        setData(value);
        setReady(true);
      },
      error: () => {
        setNotice(
          "Local storage could not be opened. Please check Safari’s storage settings.",
        );
        setReady(true);
      },
    });
    return () => sub.unsubscribe();
  }, [active]);
  useEffect(() => {
    if (!active) return;
    let running = false;
    const tick = () => {
      if (running || document.hidden) return;
      running = true;
      engine
        .tick(active)
        .catch(() => {})
        .finally(() => {
          running = false;
        });
    };
    tick();
    const timer = setInterval(tick, 1000);
    const visible = () => {
      if (!document.hidden) tick();
      else setVaultKey(null);
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [active]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const resize = () =>
      document.documentElement.style.setProperty(
        "--app-height",
        `${visualViewport?.height || innerHeight}px`,
      );
    resize();
    visualViewport?.addEventListener("resize", resize);
    return () => visualViewport?.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    const p = data.account?.preferences;
    document.documentElement.dataset.theme = p?.theme || "system";
    document.documentElement.style.fontSize = `${16 * (p?.textSize || 1)}px`;
    document.documentElement.dataset.motion = p?.reducedMotion
      ? "reduce"
      : "system";
    const media = matchMedia("(prefers-color-scheme: dark)");
    const update = () =>
      document
        .querySelector("meta[name=theme-color]")
        ?.setAttribute(
          "content",
          tab === "camera"
            ? "#080808"
            : p?.theme === "dark" || (p?.theme !== "light" && media.matches)
              ? "#151515"
              : "#ffffff",
        );
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [data.account?.preferences, tab]);
  const switchAccount = (next: string) => {
    localStorage.setItem(accountKey, next);
    setActive(next);
    setRoutes([]);
    setTabState("camera");
    setVaultKey(null);
  };
  const setTab = (next: Tab) => {
    setTabState(next);
    setRoutes([]);
    history.replaceState(null, "", `#${next}`);
  };
  async function run<T>(fn: () => Promise<T>) {
    try {
      return await fn();
    } catch (e) {
      setNotice(
        e instanceof Error && !/quota/i.test(e.name)
          ? e.message
          : storageError(e),
      );
      return undefined;
    }
  }
  return (
    <AppContext.Provider
      value={{
        data,
        tab,
        setTab,
        routes,
        open: (r) => setRoutes((v) => [...v, r]),
        back: () => setRoutes((v) => v.slice(0, -1)),
        home: (t = "camera") => {
          setRoutes([]);
          setTabState(t);
        },
        active,
        switchAccount,
        newAccount: () => {
          setActive(null);
          setRoutes([]);
          setVaultKey(null);
        },
        toast: setNotice,
        run,
        vaultKey,
        setVaultKey,
      }}
    >
      {ready ? (
        children
      ) : (
        <div className="launch">
          <span className="spinner" />
          Opening Snapchat
        </div>
      )}
      {notice && (
        <div className="toast" role="status" onClick={() => setNotice("")}>
          {notice}
        </div>
      )}
    </AppContext.Provider>
  );
}

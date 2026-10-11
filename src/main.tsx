import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppProvider } from "./hooks/app";
import "./styles.css";
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="error-screen">
        <h1>Let’s reopen this moment.</h1>
        <p>
          The interface hit an unexpected error. Your saved records have not
          been reset.
        </p>
        <button className="primary" onClick={() => location.reload()}>
          Reload app
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function UpdateNotice() {
  const [worker, setWorker] = useState<ServiceWorker | null>(null);
  const requested = useRef(false);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
    let registration: ServiceWorkerRegistration | undefined;
    let disposed = false;
    const changed = () => {
      if (requested.current) location.reload();
    };
    const refresh = () => {
      if (!document.hidden) registration?.update().catch(() => {});
    };
    navigator.serviceWorker.addEventListener("controllerchange", changed);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        if (disposed) return;
        registration = reg;
        if (reg.waiting && navigator.serviceWorker.controller)
          setWorker(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          installing?.addEventListener("statechange", () => {
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller &&
              !disposed
            )
              setWorker(installing);
          });
        });
      })
      .catch(() => {});
    const timer = setInterval(refresh, 60000);
    return () => {
      disposed = true;
      clearInterval(timer);
      navigator.serviceWorker.removeEventListener("controllerchange", changed);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return worker ? (
    <div className="update-notice" role="status">
      An update is ready.
      <button
        onClick={() => {
          requested.current = true;
          worker.postMessage({ type: "SKIP_WAITING" });
        }}
      >
        Reload
      </button>
    </div>
  ) : null;
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <AppProvider>
      <App />
      <UpdateNotice />
    </AppProvider>
  </ErrorBoundary>,
);

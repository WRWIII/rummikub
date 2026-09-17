"use client";

import { useEffect } from "react";
import { createStore } from "@/lib/store/create-store";
import { useStore } from "@/lib/store/use-store";

interface UpdateState {
  ready: boolean;
  apply: (() => void) | null;
}

const IDLE: UpdateState = Object.freeze({ ready: false, apply: null });

/** Exposed so the settings screen can offer the reload, rather than
 *  interrupting a running timer with a banner over the tap surface. */
export const updateStore = createStore<UpdateState>(IDLE);

export function useUpdateAvailable(): UpdateState {
  return useStore(updateStore, (state) => state, IDLE);
}

export function ServiceWorkerManager() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const version = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
    let reloading = false;

    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let registration: ServiceWorkerRegistration | null = null;

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        // A phone left installed for weeks still picks up new builds.
        void registration?.update().catch(() => {});
      }
    };

    // The ?v= stamp makes every deploy a byte-different script URL, so the
    // browser always sees an update without a build plugin generating hashes.
    navigator.serviceWorker
      .register(`/sw.js?v=${version}`, { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        registration = reg;
        document.addEventListener("visibilitychange", onVisible);

        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              // Deliberately NOT skipWaiting() on its own: swapping the bundle
              // under a page with a running timer is user-hostile. Offer it.
              updateStore.set({
                ready: true,
                apply: () => worker.postMessage({ type: "SKIP_WAITING" }),
              });
            }
          });
        });
      })
      .catch(() => {
        /* registration refused; the app still works, just not offline */
      });

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}

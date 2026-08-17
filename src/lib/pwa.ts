import { useCallback, useEffect, useState } from "react";

/**
 * The `beforeinstallprompt` event, captured before the browser shows its own
 * install UI so we can trigger it from a custom button instead.
 */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Registers the service worker. Only runs in production — in dev, Vite's
 * hot-reload does not mix well with service worker caching.
 */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => console.error("[PWA] Service worker registration failed:", error));
  });
}

/**
 * Tracks installability so the UI can show a custom "Install app" button.
 * iOS Safari never fires `beforeinstallprompt` — those users install via
 * Share → "Add to Home Screen" — so `canInstall` stays false there.
 */
export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Already running as an installed app (standalone window on Android/desktop
    // Chrome, or iOS Safari fullscreen).
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) setIsInstalled(true);

    const handleBeforeInstallPrompt = (event: Event) => {
      // Prevent the browser's automatic mini-infobar so our button stays the
      // single install entry point.
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return { canInstall: !isInstalled && installPrompt !== null, promptInstall };
}

/**
 * Watches for a newly deployed service worker and exposes it so the UI can
 * prompt the user to refresh. New SWs are held in "waiting" state (see sw.js)
 * until the user confirms, at which point we tell it to take over and reload
 * the page onto the fresh assets.
 */
export function usePwaUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let mounted = true;

    const trackInstalling = (sw: ServiceWorker | null) => {
      if (!sw) return;
      sw.addEventListener("statechange", () => {
        // "installed" = the new SW is ready but waiting. Only treat it as an
        // update worth prompting for when an old SW controls this page.
        if (sw.state === "installed" && navigator.serviceWorker.controller && mounted) {
          setUpdateAvailable(true);
        }
      });
    };

    const detect = async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!mounted || !reg) return;
      setRegistration(reg);

      // An update may have arrived before we attached listeners.
      if (reg.waiting && navigator.serviceWorker.controller) {
        setUpdateAvailable(true);
        return;
      }
      trackInstalling(reg.installing);
      reg.addEventListener("updatefound", () => trackInstalling(reg.installing));
    };

    detect();

    // Long-lived tabs never navigate, so the browser's update check doesn't
    // run — poll periodically so new deploys still get surfaced.
    const interval = window.setInterval(() => {
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => reg?.update())
        .catch(() => {});
    }, 60 * 60 * 1000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!registration?.waiting) return;
    // Reload once the new SW takes control of this page (controllerchange
    // fires right after skipWaiting + clients.claim).
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  }, [registration]);

  return { updateAvailable, applyUpdate };
}

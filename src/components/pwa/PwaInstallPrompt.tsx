"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_STORAGE_KEY = "pwa_install_dismissed_at";
const INSTALLED_STORAGE_KEY = "pwa_app_installed";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PROMPT_DELAY_MS = 2 * 60 * 1000; // 2 minutes (120,000 ms)

function isStandaloneApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.includes("android-app://")
  );
}

export function PwaInstallPrompt({ brandName = "IPcore" }: { brandName?: string }) {
  const [isStandalone, setIsStandalone] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Register lightweight Service Worker so Android Chrome treats the app as installable
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service worker registration failed silently
    });
  }, []);

  // Capture beforeinstallprompt, check standalone state, and manage 2-minute delayed prompt
  useEffect(() => {
    if (isStandaloneApp()) {
      setIsStandalone(true);
      return;
    }

    setIsStandalone(false);

    try {
      if (window.localStorage.getItem(INSTALLED_STORAGE_KEY) === "true") {
        setDismissed(true);
        return;
      }

      const rawDismissedAt = window.localStorage.getItem(DISMISS_STORAGE_KEY);
      if (rawDismissedAt) {
        const elapsedSinceDismiss = Date.now() - Number(rawDismissedAt);
        if (!Number.isNaN(elapsedSinceDismiss) && elapsedSinceDismiss < DISMISS_COOLDOWN_MS) {
          setDismissed(true);
          return;
        }
      }
    } catch {
      // Ignore storage access errors in restricted browsing contexts
    }

    let timerId: number | undefined;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setDismissed(true);
      if (timerId !== undefined) window.clearTimeout(timerId);
      try {
        window.localStorage.setItem(INSTALLED_STORAGE_KEY, "true");
      } catch {
        // Ignore storage write errors
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    timerId = window.setTimeout(() => {
      setTimerElapsed(true);
    }, PROMPT_DELAY_MS);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (timerId !== undefined) window.clearTimeout(timerId);
    };
  }, []);

  if (isStandalone || dismissed || !timerElapsed || !deferredPrompt) {
    return null;
  }

  async function handleInstall() {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        try {
          window.localStorage.setItem(INSTALLED_STORAGE_KEY, "true");
        } catch {
          // Ignore storage write errors
        }
      } else {
        try {
          window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
        } catch {
          // Ignore storage write errors
        }
      }
    } finally {
      setDeferredPrompt(null);
      setDismissed(true);
    }
  }

  function handleDismiss() {
    try {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch {
      // Ignore storage write errors
    }
    setDismissed(true);
  }

  return (
    <aside
      role="dialog"
      aria-label={`Install ${brandName} App`}
      className="fixed bottom-4 left-4 right-4 z-50 sm:bottom-6 sm:left-auto sm:right-6 sm:w-96"
    >
      <div className="rounded-2xl border border-blue-500/30 bg-[#0D1326]/95 p-4 shadow-2xl shadow-blue-950/50 backdrop-blur-xl">
        <div className="flex items-start gap-3">
          <BrandLogo brandName={brandName} showWordmark={false} size="md" />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-white">Install {brandName}</p>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Dismiss install notification"
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">
              Add {brandName} to your home screen for faster access to your wallet, orders, and
              service credentials.
            </p>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleInstall}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:brightness-110"
              >
                <Download className="h-3.5 w-3.5" />
                Install
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-xl border border-slate-700 bg-[#070B19] px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

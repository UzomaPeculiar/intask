import { Smartphone } from "lucide-react";

import { usePwaInstall } from "@/lib/pwa";
import { cn } from "@/lib/utils";

/**
 * Floating "Install app" button, shown only while the browser reports the app
 * is installable (i.e. the manifest + service worker criteria are met and the
 * user hasn't installed it yet). Hidden automatically once installed.
 */
export function InstallPwaButton() {
  const { canInstall, promptInstall } = usePwaInstall();

  if (!canInstall) return null;

  return (
    <button
      type="button"
      onClick={promptInstall}
      aria-label="Install the InTask app"
      className={cn(
        "fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full",
        "bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg",
        "shadow-[hsl(var(--primary))]/30 transition-all duration-200",
        "hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-0",
      )}
    >
      <Smartphone className="size-4" />
      Install App
    </button>
  );
}

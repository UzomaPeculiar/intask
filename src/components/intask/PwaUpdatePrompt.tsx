import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { usePwaUpdate } from "@/lib/pwa";

/**
 * Watches for a newly deployed version of the app and shows an update toast
 * with an "Update now" action. Renders nothing — it only fires the sonner
 * notification. "Update now" tells the waiting service worker to take over,
 * which reloads the page onto the fresh assets.
 */
export function PwaUpdatePrompt() {
  const { updateAvailable, applyUpdate } = usePwaUpdate();
  const notified = useRef(false);

  useEffect(() => {
    if (!updateAvailable || notified.current) return;
    notified.current = true;

    toast("A new version of InTask is available", {
      description: "Refresh to get the latest update.",
      duration: Infinity,
      action: {
        label: "Update now",
        onClick: () => applyUpdate(),
      },
    });
  }, [updateAvailable, applyUpdate]);

  return null;
}

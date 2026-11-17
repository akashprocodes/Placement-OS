"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function LogoutPage() {
  useEffect(() => {
    async function performLogout() {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch (err) {
        console.error("Logout error:", err);
      } finally {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/";
      }
    }
    performLogout();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-app text-text-primary gap-16">
      <Loader2 className="w-24 h-24 text-brand-primary animate-spin" />
      <p className="text-body-small text-text-muted">Signing you out...</p>
    </div>
  );
}


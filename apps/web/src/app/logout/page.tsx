"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    async function performLogout() {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch (err) {
        console.error("Logout error:", err);
      } finally {
        router.push("/login");
        router.refresh();
      }
    }
    performLogout();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-app text-text-primary gap-16">
      <Loader2 className="w-24 h-24 text-brand-primary animate-spin" />
      <p className="text-body-small text-text-muted">Signing you out...</p>
    </div>
  );
}


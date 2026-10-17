import React, { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <AuthShell 
      title="Welcome back"
      description="Sign in to continue your placement preparation."
    >
      <Suspense fallback={<div className="h-48 flex items-center justify-center text-text-muted text-caption">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}

import React, { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <AuthShell 
      title="Create Account"
      description="Create your student account to track your learning journey."
    >
      <Suspense fallback={<div className="h-48 flex items-center justify-center text-text-muted text-caption">Loading...</div>}>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}

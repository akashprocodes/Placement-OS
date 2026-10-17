"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Minimal frontend validation state
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;

    if (!email) {
      setEmailError("Email is required");
      hasError = true;
    } else {
      setEmailError("");
    }

    if (!password) {
      setPasswordError("Password is required");
      hasError = true;
    } else {
      setPasswordError("");
    }

    if (hasError) return;

    setIsLoading(true);
    setGeneralError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGeneralError(data.detail || "Invalid email or password");
        setIsLoading(false);
        return;
      }
      const rawCallback = searchParams.get("callbackUrl");
      const isSafeRelativeUrl =
        rawCallback &&
        rawCallback.startsWith("/") &&
        !rawCallback.startsWith("//") &&
        !rawCallback.includes("\\") &&
        !rawCallback.includes(":");
      const safeCallbackUrl = isSafeRelativeUrl ? rawCallback : "/";

      router.push(safeCallbackUrl);
      router.refresh();
    } catch {
      setGeneralError("Could not reach authentication server. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-24">
      {generalError && (
        <div className="p-12 bg-status-error/10 border border-status-error/20 text-status-error text-caption rounded-md">
          {generalError}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-20" noValidate>
        
        {/* Email */}
        <div className="flex flex-col gap-8">
          <label htmlFor="email" className="text-label font-medium text-text-primary">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            placeholder="Enter your email"
            autoComplete="email"
            aria-invalid={!!emailError}
            aria-describedby={emailError ? "email-error" : undefined}
            className={`w-full px-12 py-8 bg-bg-app border ${emailError ? 'border-status-error' : 'border-border-default'} rounded-md text-body-small text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          />
          {emailError && <span id="email-error" className="text-caption text-status-error">{emailError}</span>}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-8">
          <label htmlFor="password" className="text-label font-medium text-text-primary">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              placeholder="Enter your password"
              autoComplete="current-password"
              aria-invalid={!!passwordError}
              aria-describedby={passwordError ? "password-error" : undefined}
              className={`w-full pl-12 pr-40 py-8 bg-bg-app border ${passwordError ? 'border-status-error' : 'border-border-default'} rounded-md text-body-small text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              className="absolute right-12 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-16 h-16" /> : <Eye className="w-16 h-16" />}
            </button>
          </div>
          {passwordError && <span id="password-error" className="text-caption text-status-error">{passwordError}</span>}
        </div>

        {/* Remember me & Forgot Password */}
        <div className="flex items-center justify-between mt-4">
          <label className="flex items-center gap-8 cursor-pointer">
            <input 
              type="checkbox"
              disabled={isLoading}
              className="w-16 h-16 rounded border-border-default accent-brand-primary focus:ring-2 focus:ring-brand-primary/20 bg-bg-app cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-body-small text-text-secondary">Remember me</span>
          </label>
          <button type="button" disabled={isLoading} className="text-body-small font-medium text-brand-primary hover:text-brand-hover transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed">
            Forgot password?
          </button>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center py-12 mt-4 bg-brand-primary hover:bg-brand-hover text-text-inverse text-body-small font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-bg-surface disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? <Loader2 className="w-16 h-16 animate-spin" /> : "Sign In"}
        </button>
      </form>

      {/* Divider */}
      <div className="relative flex items-center py-8">
        <div className="flex-grow border-t border-border-subtle"></div>
        <span className="flex-shrink-0 px-12 text-caption text-text-muted bg-bg-surface">
          or
        </span>
        <div className="flex-grow border-t border-border-subtle"></div>
      </div>

      {/* Google Auth Placeholder */}
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label="Continue with Google (Coming soon)"
        title="Google sign-in is coming soon"
        className="w-full flex items-center justify-center gap-8 py-12 bg-bg-app/50 border border-border-subtle text-text-muted text-body-small font-medium rounded-md cursor-not-allowed opacity-60 transition-opacity"
      >
        <svg className="w-16 h-16 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <span>Continue with Google</span>
        <span className="ml-4 px-6 py-1 text-[10px] uppercase font-semibold tracking-wider bg-bg-muted text-text-secondary border border-border-default rounded">
          Coming Soon
        </span>
      </button>

      {/* Registration Prompt */}
      {(() => {
        const rawCallback = searchParams.get("callbackUrl");
        const isSafe = rawCallback && rawCallback.startsWith("/") && !rawCallback.startsWith("//") && !rawCallback.includes("\\") && !rawCallback.includes(":");
        const registerHref = isSafe ? `/register?callbackUrl=${encodeURIComponent(rawCallback)}` : "/register";
        return (
          <p className="text-center text-body-small text-text-secondary mt-8">
            Don&apos;t have an account?{" "}
            <Link href={registerHref} className={`font-semibold text-brand-primary hover:text-brand-hover transition-colors focus:outline-none focus:underline ${isLoading ? 'pointer-events-none opacity-50' : ''}`}>
              Create account
            </Link>
          </p>
        );
      })()}
    </div>
  );
}

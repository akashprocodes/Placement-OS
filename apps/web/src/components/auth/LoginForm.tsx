"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react";
import { StarBorder } from "@/components/ui/StarBorder";

export function LoginForm() {
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

      // Full navigation ensures newly set HttpOnly session cookies are transmitted on initial document load
      // and purges any unauthenticated RSC client router caches.
      window.location.href = safeCallbackUrl;
    } catch {
      setGeneralError("Could not reach authentication server. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {generalError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl">
          {generalError}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" noValidate>
        
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-semibold text-zinc-700 text-left">
            Email Address
          </label>
          <div className="relative flex items-center">
            <Mail size={16} style={{ width: 16, height: 16 }} className="absolute left-3.5 text-zinc-400 pointer-events-none" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              placeholder="name@example.com"
              autoComplete="email"
              aria-invalid={!!emailError}
              aria-describedby={emailError ? "email-error" : undefined}
              className={`w-full pl-10 pr-3.5 py-2.5 bg-[#FAFBFD] hover:bg-white focus:bg-white border ${
                emailError ? "border-red-500 focus:border-red-500" : "border-zinc-200/90 focus:border-black"
              } rounded-xl text-sm text-[#0A0B0D] placeholder:text-zinc-400 focus:outline-none focus:ring-4 focus:ring-black/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(0,0,0,0.01)] transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
            />
          </div>
          {emailError && <span id="email-error" className="text-xs text-red-500 text-left mt-0.5">{emailError}</span>}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-semibold text-zinc-700 text-left">
            Password
          </label>
          <div className="relative flex items-center">
            <Lock size={16} style={{ width: 16, height: 16 }} className="absolute left-3.5 text-zinc-400 pointer-events-none" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              placeholder="••••••••••••"
              autoComplete="current-password"
              aria-invalid={!!passwordError}
              aria-describedby={passwordError ? "password-error" : undefined}
              className={`w-full pl-10 pr-10 py-2.5 bg-[#FAFBFD] hover:bg-white focus:bg-white border ${
                passwordError ? "border-red-500 focus:border-red-500" : "border-zinc-200/90 focus:border-black"
              } rounded-xl text-sm text-[#0A0B0D] placeholder:text-zinc-400 focus:outline-none focus:ring-4 focus:ring-black/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_1px_rgba(0,0,0,0.01)] transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              className="absolute right-3.5 text-zinc-400 hover:text-zinc-800 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} style={{ width: 16, height: 16 }} /> : <Eye size={16} style={{ width: 16, height: 16 }} />}
            </button>
          </div>
          {passwordError && <span id="password-error" className="text-xs text-red-500 text-left mt-0.5">{passwordError}</span>}
        </div>

        {/* Remember me & Forgot Password */}
        <div className="flex items-center justify-between pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input 
              type="checkbox"
              disabled={isLoading}
              className="w-4 h-4 rounded border-zinc-300 bg-white text-black accent-black focus:ring-2 focus:ring-black/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-xs text-zinc-600 font-medium">Remember me</span>
          </label>
          <button type="button" disabled={isLoading} className="text-xs font-semibold text-zinc-700 hover:text-[#0A0B0D] hover:underline transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed">
            Forgot password?
          </button>
        </div>

        {/* Submit Button */}
        <StarBorder
          as="button"
          type="submit"
          disabled={isLoading}
          color="#6366F1"
          trailColor="#818CF8"
          backgroundColor="#0A0B0D"
          textColor="#FFFFFF"
          sparkle
          className="w-full flex items-center justify-center py-2.5 mt-2 text-sm font-semibold rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.18)] hover:brightness-110 active:scale-[0.99]"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
        </StarBorder>
      </form>

      {/* Divider */}
      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-black/[0.08]"></div>
        <span className="flex-shrink-0 px-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400 bg-transparent select-none">
          or continue with
        </span>
        <div className="flex-grow border-t border-black/[0.08]"></div>
      </div>

      {/* Google Auth Placeholder */}
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label="Continue with Google (Coming soon)"
        title="Google sign-in is coming soon"
        className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white hover:bg-zinc-50 border border-zinc-200/90 text-zinc-800 text-sm font-semibold rounded-xl cursor-not-allowed opacity-90 transition-all select-none shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <span className="font-semibold text-[13px] text-zinc-700">Continue with Google</span>
        <span className="ml-1 px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider bg-zinc-100 text-zinc-500 border border-zinc-200/80 rounded">
          Soon
        </span>
      </button>

      {/* Registration Prompt */}
      {(() => {
        const rawCallback = searchParams.get("callbackUrl");
        const isSafe = rawCallback && rawCallback.startsWith("/") && !rawCallback.startsWith("//") && !rawCallback.includes("\\") && !rawCallback.includes(":");
        const registerHref = isSafe ? `/register?callbackUrl=${encodeURIComponent(rawCallback)}` : "/register";
        return (
          <p className="text-center text-xs text-zinc-500 mt-1">
            Don&apos;t have an account?{" "}
            <Link href={registerHref} className={`font-bold text-[#0A0B0D] hover:underline transition-colors focus:outline-none ${isLoading ? 'pointer-events-none opacity-50' : ''}`}>
              Create account
            </Link>
          </p>
        );
      })()}
    </div>
  );
}

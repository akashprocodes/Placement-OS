"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, Sparkles } from "lucide-react";
import { Meteors } from "@/components/ui/meteors";

interface AuthShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function AuthShell({ title, description, children }: AuthShellProps) {
  const pathname = usePathname();
  const isLogin = pathname.includes("/login");
  const isRegister = pathname.includes("/register");

  return (
    <div className="relative min-h-screen w-full flex flex-col lg:flex-row bg-[#E3E5EA] p-[10px] gap-[10px] overflow-hidden select-none">
      {/* Magic UI Meteors Background Shower */}
      <Meteors number={32} />

      {/* Clean Ambient Radial Light Highlight */}
      <div 
        aria-hidden="true"
        className="absolute top-0 left-0 w-[850px] h-[450px] pointer-events-none opacity-60 bg-[radial-gradient(ellipse_60%_50%_at_20%_0%,rgba(255,255,255,0.7),transparent_70%)]" 
      />

      {/* Precision Dot Matrix for Left Canvas */}
      <div 
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(rgba(0,0,0,0.08) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse at 35% 50%, black 40%, transparent 80%)'
        }}
      />

      {/* LEFT SIDE (50% on Desktop) - Ultra-Clean Magic UI Meteors Canvas */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-8 z-10 min-h-[calc(100vh-20px)]">
        {/* Top Brand Pill */}
        <div className="absolute top-6 left-8 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/75 backdrop-blur-xl border border-white/95 shadow-[0_2px_8px_rgba(0,0,0,0.03)] text-xs text-zinc-700 font-medium">
          <Sparkles size={13} style={{ width: 13, height: 13 }} className="text-zinc-900 shrink-0" />
          <span className="text-[#0A0B0D] font-bold tracking-tight">Placement OS</span>
          <span className="text-zinc-300">•</span>
          <span className="text-zinc-500 text-[11px] font-medium">Candidate Portal</span>
        </div>

        {/* Center Display Text - Authentic Magic UI Meteors Typographic Scale */}
        <span className={`pointer-events-none select-none whitespace-pre-wrap bg-gradient-to-b from-black via-zinc-800 to-zinc-400 bg-clip-text text-center font-bold tracking-tight text-transparent px-4 ${
          isLogin ? "text-7xl xl:text-8xl leading-none" : "text-5xl sm:text-6xl xl:text-7xl leading-tight"
        }`}>
          {isLogin ? "Sign In" : "Create Account"}
        </span>

        {/* Bottom Minimal Status */}
        <div className="absolute bottom-6 left-8 flex items-center gap-2 text-xs text-zinc-500 select-none">
          <ShieldCheck size={14} style={{ width: 14, height: 14 }} className="text-zinc-600 shrink-0" />
          <span>End-to-End Encrypted</span>
          <span className="text-zinc-300">•</span>
          <span>Placement OS v2.4</span>
        </div>
      </div>

      {/* RIGHT SIDE (50% Full-Height Panel) - Auth Form with 10px padding & 12px border radius */}
      <div className="relative w-full lg:w-1/2 min-h-[calc(100vh-20px)] flex flex-col justify-center items-center rounded-[12px] bg-white border border-black/[0.06] shadow-[0_20px_50px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.03)] p-[10px] sm:p-8 lg:p-10 z-10 overflow-y-auto">
        <div className="w-full max-w-[390px] flex flex-col my-auto py-2">
          
          {/* Mobile-only Brand Pill */}
          <div className="lg:hidden flex items-center justify-center mb-6">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FAFBFD] border border-black/[0.06] text-xs text-zinc-700 font-medium">
              <Sparkles size={14} style={{ width: 14, height: 14 }} className="text-indigo-600 shrink-0" />
              <span className="text-[#0A0B0D] font-bold tracking-tight">Placement OS</span>
              <span className="text-zinc-300">•</span>
              <span className="text-zinc-500 text-[11px] font-medium">Candidate Portal</span>
            </div>
          </div>

          {/* Segmented Mode Switcher: Sign In / Create Account with 12px border radius */}
          <div className="grid grid-cols-2 p-1 bg-[#EEF0F4] rounded-[12px] mb-5 border border-black/[0.04] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
            <Link
              href="/login"
              className={`py-2 text-center text-xs font-semibold rounded-[10px] transition-all duration-150 ${
                isLogin
                  ? "bg-white text-[#0A0B0D] shadow-[0_2px_6px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-black/[0.04]"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className={`py-2 text-center text-xs font-semibold rounded-[10px] transition-all duration-150 ${
                isRegister
                  ? "bg-white text-[#0A0B0D] shadow-[0_2px_6px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)] border border-black/[0.04]"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              Create Account
            </Link>
          </div>

          {/* Form Header */}
          <div className="mb-4 text-left">
            <h1 className="text-2xl font-bold tracking-tight text-[#0A0B0D]">
              {title}
            </h1>
            {description && (
              <p className="text-xs text-zinc-500 font-medium mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {/* Form Body */}
          <div className="w-full">
            {children}
          </div>

          {/* Security & SSL Footer */}
          <div className="flex items-center justify-center gap-2 mt-6 text-[11px] text-zinc-500 font-medium select-none">
            <ShieldCheck size={14} style={{ width: 14, height: 14 }} className="text-emerald-600 shrink-0" />
            <span>End-to-End Encrypted</span>
            <span className="text-zinc-300">•</span>
            <span>Placement OS v2.4</span>
          </div>

        </div>
      </div>
    </div>
  );
}

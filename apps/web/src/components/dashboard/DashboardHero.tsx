import React from "react";
import { Quote } from "lucide-react";

interface DashboardHeroProps {
  isAuthenticated?: boolean;
  userEmail?: string | null;
}

export function DashboardHero({ isAuthenticated = false, userEmail }: DashboardHeroProps) {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";
  
  let displayName = "";
  if (userEmail) {
    const rawName = userEmail.split("@")[0];
    displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  }

  const title = isAuthenticated && displayName ? `${timeOfDay}, ${displayName}` : "Welcome to Placement OS";

  return (
    <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-24 py-8">
      {/* Left: Greeting */}
      <div className="flex flex-col gap-8">
        <h1 className="text-h2 font-bold text-text-primary tracking-tight">
          {title} <span className="inline-block animate-wave">👋</span>
        </h1>
        <p className="text-body text-text-secondary">
          Keep building the skills that move you closer to your placement.
        </p>
      </div>

      {/* Right: Quote Card */}
      <div className="flex shrink-0 lg:w-96">
        <div className="relative w-full bg-bg-surface border border-border-default rounded-xl p-16 shadow-subtle flex gap-12 items-start">
          <div className="text-brand-primary opacity-20 shrink-0 mt-4">
            <Quote className="w-24 h-24 rotate-180" />
          </div>
          <div className="flex flex-col gap-4">
            <p className="text-body-small italic text-text-secondary font-medium">
              &quot;Discipline today, dream job tomorrow.&quot;
            </p>
            <span className="text-caption font-semibold text-text-muted uppercase tracking-wider">
              – Placement OS
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

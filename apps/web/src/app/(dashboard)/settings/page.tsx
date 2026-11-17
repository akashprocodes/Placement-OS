"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Moon,
  Sun,
  Laptop,
  User,
  GraduationCap,
  Target,
  Bell,
  Check,
  LogOut,
  Loader2,
  ShieldCheck,
  Save,
} from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { StarBorder } from "@/components/ui/StarBorder";

interface UserProfile {
  name: string;
  email: string;
  degree: string;
  graduationYear: string;
  targetRole: string;
  avatarUrl?: string;
}

interface UserPreferences {
  dailyTargetMinutes: number;
  streakReminders: boolean;
  debtAlerts: boolean;
  interviewPrompts: boolean;
}

const DEFAULT_PROFILE: UserProfile = {
  name: "Akash",
  email: "akash@example.com",
  degree: "B.Tech Computer Science & Engineering",
  graduationYear: "2026",
  targetRole: "Full Stack Developer",
  avatarUrl: "",
};

const DEFAULT_PREFERENCES: UserPreferences = {
  dailyTargetMinutes: 60,
  streakReminders: true,
  debtAlerts: true,
  interviewPrompts: true,
};

const TARGET_ROLE_OPTIONS = [
  "Software Development Engineer (SDE-1)",
  "Full Stack Developer",
  "Frontend Engineer",
  "Backend Engineer",
  "Data Engineer",
  "DevOps / Cloud Engineer",
];

const DAILY_TARGET_OPTIONS = [30, 45, 60, 90, 120];

export default function SettingsPage() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const storedProfile = localStorage.getItem("placement_os_user_profile");
        if (storedProfile) {
          setProfile((prev) => ({ ...prev, ...JSON.parse(storedProfile) }));
        }
        const storedPrefs = localStorage.getItem("placement_os_user_settings");
        if (storedPrefs) {
          setPreferences((prev) => ({ ...prev, ...JSON.parse(storedPrefs) }));
        }
      } catch (e) {
        console.warn("Failed to read settings from localStorage:", e);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      localStorage.setItem("placement_os_user_profile", JSON.stringify(profile));
      localStorage.setItem("placement_os_user_settings", JSON.stringify(preferences));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("profile-updated"));
      }
      setTimeout(() => {
        setIsSaving(false);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }, 400);
    } catch (err) {
      console.error("Save error:", err);
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    }
  };

  return (
    <div className="w-full min-h-full bg-bg-app pb-40">
      <div className="mx-auto max-w-4xl px-layout-px py-10 flex flex-col gap-28">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border-default">
          <div className="flex items-center gap-12">
            <div className="w-11 h-11 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-h3 font-bold text-text-primary tracking-tight">User Settings</h1>
              <p className="text-body-small text-text-muted">
                Customize your appearance, learning goals, and student account details
              </p>
            </div>
          </div>

          <div className="flex items-center gap-8 self-start sm:self-auto">
            <span className="inline-flex items-center gap-6 px-10 py-4 rounded-full bg-status-success/10 border border-status-success/20 text-status-success text-caption font-medium">
              <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
              Active Session
            </span>
          </div>
        </div>

        {/* Section 1: Appearance & Theme */}
        <section aria-labelledby="theme-section-heading" className="flex flex-col gap-12">
          <div>
            <h2 id="theme-section-heading" className="text-body font-bold text-text-primary">
              Appearance & Theme
            </h2>
            <p className="text-body-small text-text-muted">
              Choose your preferred interface theme. Automatically syncs across all pages.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12">
            {/* Dark Mode */}
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={`group relative p-16 rounded-xl border text-left transition-all duration-150 flex flex-col gap-12 ${
                theme === "dark"
                  ? "bg-bg-surface border-brand-primary ring-2 ring-brand-primary/20 shadow-subtle"
                  : "bg-bg-surface/50 border-border-default hover:border-border-strong hover:bg-bg-surface"
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    theme === "dark"
                      ? "bg-brand-primary/15 text-brand-primary"
                      : "bg-bg-muted text-text-muted group-hover:text-text-primary"
                  }`}
                >
                  <Moon className="w-5 h-5" />
                </div>
                {theme === "dark" && (
                  <span className="inline-flex items-center gap-4 text-[11px] font-semibold text-brand-primary bg-brand-primary/10 px-8 py-2 rounded-md">
                    <Check className="w-3 h-3" />
                    Active
                  </span>
                )}
              </div>
              <div>
                <span className="text-body-small font-semibold text-text-primary block">Dark Mode</span>
                <span className="text-caption text-text-muted mt-2 block">
                  High-contrast obsidian theme for late-night study sessions
                </span>
              </div>
            </button>

            {/* Light Mode */}
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={`group relative p-16 rounded-xl border text-left transition-all duration-150 flex flex-col gap-12 ${
                theme === "light"
                  ? "bg-bg-surface border-brand-primary ring-2 ring-brand-primary/20 shadow-subtle"
                  : "bg-bg-surface/50 border-border-default hover:border-border-strong hover:bg-bg-surface"
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    theme === "light"
                      ? "bg-brand-primary/15 text-brand-primary"
                      : "bg-bg-muted text-text-muted group-hover:text-text-primary"
                  }`}
                >
                  <Sun className="w-5 h-5" />
                </div>
                {theme === "light" && (
                  <span className="inline-flex items-center gap-4 text-[11px] font-semibold text-brand-primary bg-brand-primary/10 px-8 py-2 rounded-md">
                    <Check className="w-3 h-3" />
                    Active
                  </span>
                )}
              </div>
              <div>
                <span className="text-body-small font-semibold text-text-primary block">Light Mode</span>
                <span className="text-caption text-text-muted mt-2 block">
                  Crisp, high-legibility daylight palette with soft contrast
                </span>
              </div>
            </button>

            {/* System Mode */}
            <button
              type="button"
              onClick={() => setTheme("system")}
              className={`group relative p-16 rounded-xl border text-left transition-all duration-150 flex flex-col gap-12 ${
                theme === "system"
                  ? "bg-bg-surface border-brand-primary ring-2 ring-brand-primary/20 shadow-subtle"
                  : "bg-bg-surface/50 border-border-default hover:border-border-strong hover:bg-bg-surface"
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    theme === "system"
                      ? "bg-brand-primary/15 text-brand-primary"
                      : "bg-bg-muted text-text-muted group-hover:text-text-primary"
                  }`}
                >
                  <Laptop className="w-5 h-5" />
                </div>
                {theme === "system" && (
                  <span className="inline-flex items-center gap-4 text-[11px] font-semibold text-brand-primary bg-brand-primary/10 px-8 py-2 rounded-md">
                    <Check className="w-3 h-3" />
                    Active ({resolvedTheme})
                  </span>
                )}
              </div>
              <div>
                <span className="text-body-small font-semibold text-text-primary block">System Preference</span>
                <span className="text-caption text-text-muted mt-2 block">
                  Automatically aligns with your device&apos;s OS theme
                </span>
              </div>
            </button>
          </div>
        </section>

        {/* Section 2: Student Profile & Academic Details */}
        <section aria-labelledby="profile-section-heading" className="flex flex-col gap-16">
          <div>
            <h2 id="profile-section-heading" className="text-body font-bold text-text-primary">
              Student Profile & Academics
            </h2>
            <p className="text-body-small text-text-muted">
              Personalize your academic profile to help optimize AI interview questions and study paths.
            </p>
          </div>

          <form
            onSubmit={handleProfileSave}
            className="p-20 sm:p-24 bg-bg-surface border border-border-default rounded-2xl flex flex-col gap-20 shadow-subtle"
          >
            {/* Avatar Pill Preview */}
            <div className="flex items-center gap-16 pb-16 border-b border-border-subtle">
              <div className="w-14 h-14 rounded-[10px] bg-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-h4 border border-brand-primary/30 shrink-0 overflow-hidden">
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                    onError={() => setProfile((prev) => ({ ...prev, avatarUrl: "" }))}
                  />
                ) : (
                  profile.name ? profile.name.charAt(0).toUpperCase() : "U"
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-body font-bold text-text-primary">{profile.name || "Student"}</span>
                <span className="text-caption text-text-muted">{profile.degree || "Degree Candidate"}</span>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-16">
              {/* Full Name */}
              <div className="flex flex-col gap-6">
                <label htmlFor="student-name" className="text-body-small font-medium text-text-primary flex items-center gap-6">
                  <User className="w-4 h-4 text-text-muted" />
                  Full Name
                </label>
                <input
                  id="student-name"
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="e.g. Akash"
                  className="w-full px-12 py-9 rounded-lg bg-bg-muted border border-border-default text-body-small text-text-primary focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors placeholder:text-text-muted"
                />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-6">
                <label htmlFor="student-email" className="text-body-small font-medium text-text-primary flex items-center gap-6">
                  Email Address
                </label>
                <input
                  id="student-email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="e.g. akash@example.com"
                  className="w-full px-12 py-9 rounded-lg bg-bg-muted border border-border-default text-body-small text-text-primary focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors placeholder:text-text-muted"
                />
              </div>

              {/* Degree / Branch */}
              <div className="flex flex-col gap-6">
                <label htmlFor="student-degree" className="text-body-small font-medium text-text-primary flex items-center gap-6">
                  <GraduationCap className="w-4 h-4 text-text-muted" />
                  Degree & Branch
                </label>
                <input
                  id="student-degree"
                  type="text"
                  value={profile.degree}
                  onChange={(e) => setProfile({ ...profile, degree: e.target.value })}
                  placeholder="e.g. B.Tech Computer Science & Engineering"
                  className="w-full px-12 py-9 rounded-lg bg-bg-muted border border-border-default text-body-small text-text-primary focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors placeholder:text-text-muted"
                />
              </div>

              {/* Target Graduation Year */}
              <div className="flex flex-col gap-6">
                <label htmlFor="student-grad-year" className="text-body-small font-medium text-text-primary flex items-center gap-6">
                  Graduation Year
                </label>
                <input
                  id="student-grad-year"
                  type="text"
                  value={profile.graduationYear}
                  onChange={(e) => setProfile({ ...profile, graduationYear: e.target.value })}
                  placeholder="e.g. 2026"
                  className="w-full px-12 py-9 rounded-lg bg-bg-muted border border-border-default text-body-small text-text-primary focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors placeholder:text-text-muted"
                />
              </div>

              {/* Target Role */}
              <div className="sm:col-span-2 flex flex-col gap-6">
                <label htmlFor="student-role" className="text-body-small font-medium text-text-primary flex items-center gap-6">
                  <Target className="w-4 h-4 text-text-muted" />
                  Target Placement Role
                </label>
                <select
                  id="student-role"
                  value={profile.targetRole}
                  onChange={(e) => setProfile({ ...profile, targetRole: e.target.value })}
                  className="w-full px-12 py-9 rounded-lg bg-bg-muted border border-border-default text-body-small text-text-primary focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors cursor-pointer"
                >
                  {TARGET_ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role} className="bg-bg-surface text-text-primary">
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Profile Image / Avatar URL */}
              <div className="sm:col-span-2 flex flex-col gap-6">
                <label htmlFor="student-avatar" className="text-body-small font-medium text-text-primary flex items-center gap-6">
                  <User className="w-4 h-4 text-text-muted" />
                  Profile Image / Logo URL (optional)
                </label>
                <input
                  id="student-avatar"
                  type="url"
                  value={profile.avatarUrl || ""}
                  onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })}
                  placeholder="https://example.com/avatar.png (or will sync automatically via Google Sign-in)"
                  className="w-full px-12 py-9 rounded-lg bg-bg-muted border border-border-default text-body-small text-text-primary focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors placeholder:text-text-muted"
                />
              </div>
            </div>

            {/* Save Button & Feedback */}
            <div className="flex items-center justify-between pt-8 border-t border-border-subtle">
              {savedSuccess ? (
                <span className="inline-flex items-center gap-6 text-body-small text-status-success font-medium">
                  <Check className="w-4 h-4" />
                  Changes saved successfully!
                </span>
              ) : (
                <span className="text-caption text-text-muted">
                  Stored securely in your local environment
                </span>
              )}

              <StarBorder
                as="button"
                type="submit"
                disabled={isSaving}
                color="#FF9B51"
                trailColor="#FFAE70"
                sparkle
                className="inline-flex items-center gap-8 px-16 py-8 rounded-lg font-semibold text-body-small cursor-pointer shadow-subtle disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Profile</span>
                  </>
                )}
              </StarBorder>
            </div>
          </form>
        </section>

        {/* Section 3: Study Goals & Alerts */}
        <section aria-labelledby="goals-section-heading" className="flex flex-col gap-16">
          <div>
            <h2 id="goals-section-heading" className="text-body font-bold text-text-primary">
              Study Goals & Notification Preferences
            </h2>
            <p className="text-body-small text-text-muted">
              Configure daily study time benchmarks and proactive learning alerts.
            </p>
          </div>

          <div className="p-20 sm:p-24 bg-bg-surface border border-border-default rounded-2xl flex flex-col gap-20 shadow-subtle">
            {/* Daily Target Minutes Chips */}
            <div className="flex flex-col gap-10">
              <span className="text-body-small font-semibold text-text-primary">
                Daily Study Target (Minutes)
              </span>
              <div className="flex flex-wrap gap-8">
                {DAILY_TARGET_OPTIONS.map((mins) => {
                  const isSelected = preferences.dailyTargetMinutes === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        const updated = { ...preferences, dailyTargetMinutes: mins };
                        setPreferences(updated);
                        localStorage.setItem("placement_os_user_settings", JSON.stringify(updated));
                      }}
                      className={`px-14 py-7 rounded-lg text-body-small font-medium transition-colors cursor-pointer border ${
                        isSelected
                          ? "bg-brand-primary text-text-inverse border-brand-primary shadow-xs"
                          : "bg-bg-muted text-text-secondary border-border-default hover:border-border-strong hover:text-text-primary"
                      }`}
                    >
                      {mins} mins / day
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notification Toggles */}
            <div className="flex flex-col gap-14 pt-12 border-t border-border-subtle">
              {/* Streak Reminders */}
              <div className="flex items-center justify-between gap-12">
                <div className="flex items-start gap-10">
                  <Bell className="w-4 h-4 text-text-muted mt-2 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-body-small font-medium text-text-primary">
                      Daily Streak Reminders
                    </span>
                    <span className="text-caption text-text-muted">
                      Receive evening alerts when you have not yet completed your daily video target
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences.streakReminders}
                  onClick={() => {
                    const updated = { ...preferences, streakReminders: !preferences.streakReminders };
                    setPreferences(updated);
                    localStorage.setItem("placement_os_user_settings", JSON.stringify(updated));
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                    preferences.streakReminders ? "bg-brand-primary" : "bg-bg-muted border-border-default"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      preferences.streakReminders ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Course Debt Alerts */}
              <div className="flex items-center justify-between gap-12">
                <div className="flex items-start gap-10">
                  <Bell className="w-4 h-4 text-text-muted mt-2 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-body-small font-medium text-text-primary">
                      Course Debt Warnings
                    </span>
                    <span className="text-caption text-text-muted">
                      Highlight topics that are slipping behind your original playlist schedule
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences.debtAlerts}
                  onClick={() => {
                    const updated = { ...preferences, debtAlerts: !preferences.debtAlerts };
                    setPreferences(updated);
                    localStorage.setItem("placement_os_user_settings", JSON.stringify(updated));
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                    preferences.debtAlerts ? "bg-brand-primary" : "bg-bg-muted border-border-default"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      preferences.debtAlerts ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Interview Prompts */}
              <div className="flex items-center justify-between gap-12">
                <div className="flex items-start gap-10">
                  <Bell className="w-4 h-4 text-text-muted mt-2 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-body-small font-medium text-text-primary">
                      Mock Interview Recommendations
                    </span>
                    <span className="text-caption text-text-muted">
                      Prompt for role-specific interview practice after finishing key syllabus chapters
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences.interviewPrompts}
                  onClick={() => {
                    const updated = { ...preferences, interviewPrompts: !preferences.interviewPrompts };
                    setPreferences(updated);
                    localStorage.setItem("placement_os_user_settings", JSON.stringify(updated));
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                    preferences.interviewPrompts ? "bg-brand-primary" : "bg-bg-muted border-border-default"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      preferences.interviewPrompts ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Account Session & Logout */}
        <section aria-labelledby="session-section-heading" className="flex flex-col gap-16">
          <div>
            <h2 id="session-section-heading" className="text-body font-bold text-text-primary">
              Session & Account Security
            </h2>
            <p className="text-body-small text-text-muted">
              Manage your active session and sign out of Placement OS.
            </p>
          </div>

          <div className="p-20 sm:p-24 bg-bg-surface border border-border-default rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-16 shadow-subtle">
            <div className="flex items-center gap-12">
              <div className="w-10 h-10 rounded-xl bg-status-success/10 text-status-success flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-body-small font-semibold text-text-primary">
                  Signed in as {profile.name}
                </span>
                <span className="text-caption text-text-muted">
                  {profile.email} • Active browser session
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex items-center justify-center gap-8 px-16 py-9 rounded-lg bg-status-error/10 hover:bg-status-error/15 text-status-error border border-status-error/25 font-semibold text-body-small transition-colors disabled:opacity-50 cursor-pointer self-start sm:self-auto"
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing out...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
                  <span>Log Out of Account</span>
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

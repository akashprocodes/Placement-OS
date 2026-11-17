"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  TrendingUp,
  ChevronRight,
  Folder,
  Layers,
  Clock,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
  subItems?: Array<{ name: string; href: string; icon: React.ElementType }>;
}

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  {
    name: "Learning",
    href: "/learning",
    icon: BookOpen,
    badge: "3",
    subItems: [
      { name: "Guided Courses", href: "/learning", icon: Folder },
      { name: "My Workspace", href: "/learning/analytics", icon: Layers },
      { name: "Study Debt", href: "/learning/analytics#debt", icon: Clock },
    ],
  },
  { name: "Interviews", href: "/interviews", icon: MessageSquare },
  { name: "Progress", href: "/learning/analytics", icon: TrendingUp },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isLearningExpanded, setIsLearningExpanded] = useState(true);
  const [userName, setUserName] = useState("Akash");
  const [userRole, setUserRole] = useState("Student");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = () => {
      try {
        const stored = localStorage.getItem("placement_os_user_profile");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.name) setUserName(parsed.name);
          if (parsed.targetRole || parsed.degree) {
            setUserRole(parsed.targetRole || parsed.degree || "Student");
          } else if (parsed.email) {
            setUserRole(parsed.email);
          }
          if (parsed.avatarUrl || parsed.avatar || parsed.photoURL) {
            setUserAvatar(parsed.avatarUrl || parsed.avatar || parsed.photoURL);
          }
        }
        const customAvatar =
          localStorage.getItem("placement_os_user_avatar") ||
          localStorage.getItem("user_avatar");
        if (customAvatar) {
          setUserAvatar(customAvatar);
        }
      } catch (e) {
        console.warn("Failed to read user profile:", e);
      }
    };

    const timer = setTimeout(loadProfile, 0);

    window.addEventListener("storage", loadProfile);
    window.addEventListener("profile-updated", loadProfile);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("storage", loadProfile);
      window.removeEventListener("profile-updated", loadProfile);
    };
  }, []);

  const isProfileActive =
    pathname.startsWith("/profile") || pathname.startsWith("/settings");

  return (
    <aside
      aria-label="Sidebar Navigation"
      className="my-3.5 ml-3.5 h-[calc(100vh-1.75rem)] w-[252px] shrink-0 z-30 select-none flex flex-col justify-between rounded-[14px] bg-white/75 backdrop-blur-2xl border border-white/90 shadow-[0_20px_50px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.01),inset_0_1px_1px_rgba(255,255,255,1)]"
    >
      {/* Top Header Section */}
      <div className="pt-6 px-4 pb-3 shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2.5 py-1 px-1 rounded-[14px] transition-all duration-200 group w-full"
        >
          {/* Exact 4-point sparkle star from reference UI */}
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5 h-5 text-black shrink-0 transition-transform duration-200 group-hover:scale-110"
          >
            <path d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z" />
          </svg>

          <span className="text-[19px] font-bold text-black tracking-tight leading-none font-sans">
            Menu
          </span>
        </Link>
      </div>

      {/* Main Nav Items Area */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1 scrollbar-none">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isExpanded = isLearningExpanded && isActive;

          return (
            <div key={item.name} className="flex flex-col gap-1">
              {/* Primary Item Row */}
              <div className="relative">
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-[8px] text-[13.5px] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black w-full ${
                    isActive
                      ? "bg-white text-zinc-950 font-semibold shadow-[0_2px_10px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,1)] border border-black/[0.06]"
                      : "text-zinc-600 hover:text-black hover:bg-white/70 font-medium border border-transparent"
                  }`}
                >
                  <item.icon
                    className={`w-[17px] h-[17px] shrink-0 transition-transform duration-200 ${
                      isActive
                        ? "text-zinc-950 scale-105"
                        : "text-zinc-500 group-hover:text-black"
                    }`}
                  />

                  <span className="truncate flex-1 tracking-[-0.01em]">{item.name}</span>

                  {/* Micro Badge or Submenu Indicator */}
                  {item.badge && !isActive && (
                    <span className="w-5 h-5 rounded-full bg-[#1E1F24] text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
                      {item.badge}
                    </span>
                  )}

                  {hasSubItems && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsLearningExpanded((prev) => !prev);
                      }}
                      className={`p-1 transition-opacity ${
                        isActive
                          ? "text-zinc-700 hover:text-black"
                          : "text-zinc-400 hover:text-black"
                      }`}
                      aria-label="Toggle Submenu"
                    >
                      {isExpanded ? (
                        <span className="text-sm font-semibold leading-none select-none px-0.5">
                          —
                        </span>
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </Link>
              </div>

              {/* Nested Sub-Items (Tree View from reference image) */}
              {hasSubItems && isExpanded && (
                <div className="relative ml-5 pl-3.5 border-l border-zinc-200 flex flex-col gap-1 my-1">
                  {item.subItems?.map((sub) => {
                    const isSubActive = pathname === sub.href;
                    return (
                      <Link
                        key={sub.name}
                        href={sub.href}
                        className={`px-3 py-1.5 rounded-[10px] text-[12px] transition-all duration-150 flex items-center gap-2 ${
                          isSubActive
                            ? "bg-white text-zinc-950 font-medium shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-black/[0.04]"
                            : "text-zinc-600 hover:text-black hover:bg-white/70"
                        }`}
                      >
                        <sub.icon className="w-3.5 h-3.5 opacity-60 shrink-0" />
                        <span className="truncate">{sub.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Middle/Bottom Divider */}
      <div className="px-4 my-1">
        <div className="w-full h-px bg-zinc-200/80" />
      </div>

      {/* Bottom Profile Section */}
      <div className="p-2.5 pb-2.5 shrink-0">
        <Link
          href="/profile"
          aria-current={isProfileActive ? "page" : undefined}
          className={`group flex items-center gap-2.5 p-2 rounded-[12px] transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black w-full ${
            isProfileActive
              ? "bg-white text-zinc-950 font-semibold shadow-[0_2px_10px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,1)] border border-black/[0.08]"
              : "bg-white/70 hover:bg-white text-zinc-800 hover:text-black border border-black/[0.06] hover:border-black/[0.1] shadow-[0_1px_4px_rgba(0,0,0,0.03)]"
          }`}
        >
          {/* Square with exact 7px border radius */}
          <div className="w-8 h-8 rounded-[7px] overflow-hidden shrink-0 border border-black/[0.12] shadow-[0_1px_3px_rgba(0,0,0,0.05),inset_0_1px_1px_rgba(255,255,255,1)] bg-[#F1F2F5] relative flex items-center justify-center">
            {userAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={userAvatar}
                alt={userName}
                className="w-full h-full object-cover rounded-[6px]"
                onError={() => setUserAvatar(null)}
              />
            ) : (
              <div className="w-full h-full bg-[#0A0B0D] text-white flex items-center justify-center font-bold text-[13px] tracking-tight relative select-none shadow-inner">
                <span>{(userName.trim().charAt(0) || "U").toUpperCase()}</span>
                <div className="absolute inset-x-0 top-0 h-[1px] bg-white/20" />
              </div>
            )}
          </div>

          {/* User Name & Details */}
          <div className="flex flex-col min-w-0 flex-1 text-left">
            <span className="text-[13px] font-semibold text-zinc-950 truncate tracking-tight leading-tight">
              {userName}
            </span>
            <span className="text-[10.5px] text-zinc-500 font-medium truncate leading-tight mt-0.5">
              {userRole}
            </span>
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-black group-hover:translate-x-0.5 transition-all shrink-0" />
        </Link>
      </div>
    </aside>
  );
}

export default Sidebar;

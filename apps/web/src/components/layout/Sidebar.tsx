"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  TrendingUp,
  User,
  Settings,
  LogOut,
  Zap,
} from "lucide-react";
import React from "react";

const PRIMARY_NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Learning", href: "/learning", icon: BookOpen },
  { name: "Interviews", href: "/interviews", icon: MessageSquare },
  { name: "Progress", href: "/learning/analytics", icon: TrendingUp },
  { name: "Profile", href: "/profile", icon: User },
];

const SECONDARY_NAV_ITEMS = [
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Logout", href: "/logout", icon: LogOut },
];

export function Sidebar() {
  const pathname = usePathname();

  const renderNavItems = (items: typeof PRIMARY_NAV_ITEMS) => {
    return items.map((item) => {
      const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

      return (
        <Link
          key={item.name}
          href={item.href}
          aria-current={isActive ? "page" : undefined}
          className={`flex items-center gap-12 px-12 py-8 rounded-lg transition-colors duration-normal ease-standard text-body-small font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
            isActive
              ? "bg-brand-primary/10 text-brand-primary"
              : "text-text-secondary hover:bg-bg-muted hover:text-text-primary"
          }`}
        >
          <item.icon
            className={`w-16 h-16 ${
              isActive ? "text-brand-primary" : "text-text-muted"
            }`}
          />
          {item.name}
        </Link>
      );
    });
  };

  return (
    <aside className="w-[280px] h-full flex flex-col bg-bg-surface border-r border-border-default shrink-0">
      {/* Brand Header */}
      <div className="h-[72px] flex items-center px-24 border-b border-border-subtle shrink-0">
        <Link
          href="/"
          className="flex items-center gap-8 text-text-primary hover:text-brand-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-lg py-4 -ml-4"
        >
          <div className="w-24 h-24 rounded-lg bg-brand-primary text-text-inverse flex items-center justify-center font-bold text-caption">
            P
          </div>
          <span className="font-semibold text-body tracking-tight">
            Placement OS
          </span>
        </Link>
      </div>

      {/* Navigation Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-16 py-24 flex flex-col justify-between">
        <nav aria-label="Main navigation" className="flex flex-col gap-4">
          {renderNavItems(PRIMARY_NAV_ITEMS)}
        </nav>

        <div className="flex flex-col gap-16 mt-32">
          {/* Upgrade to Pro Card */}
          <div className="bg-brand-primary text-text-inverse p-16 rounded-xl flex flex-col gap-12 shadow-subtle mx-8">
            <div className="w-32 h-32 rounded-full bg-text-inverse/20 flex items-center justify-center shrink-0">
              <Zap className="w-16 h-16 text-text-inverse fill-text-inverse" />
            </div>
            <div className="flex flex-col">
              <span className="text-body-small font-semibold">Upgrade to Pro</span>
              <span className="text-caption text-text-inverse/80 mt-4">
                Unlock all premium features
              </span>
            </div>
            <button className="bg-text-inverse text-brand-primary text-caption font-semibold py-8 rounded-lg w-full transition-opacity hover:opacity-90 mt-4">
              Upgrade Now
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Area */}
      <div className="p-16 border-t border-border-subtle shrink-0">
        <nav aria-label="Secondary navigation" className="flex flex-col gap-4">
          {renderNavItems(SECONDARY_NAV_ITEMS)}
        </nav>
      </div>
    </aside>
  );
}

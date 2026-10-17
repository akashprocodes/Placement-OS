import React from "react";
import Link from "next/link";
import { User, ArrowRight } from "lucide-react";

export default function ProfilePage() {
  return (
    <div className="w-full min-h-full bg-bg-app p-24 sm:p-32">
      <div className="max-w-4xl mx-auto flex flex-col gap-24">
        <div className="flex items-center gap-12">
          <div className="w-40 h-40 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
            <User className="w-20 h-20" />
          </div>
          <div>
            <h1 className="text-h3 font-bold text-text-primary">Student Profile</h1>
            <p className="text-body-small text-text-muted">Account and profile overview</p>
          </div>
        </div>

        <div className="p-24 sm:p-32 bg-bg-surface border border-border-default rounded-2xl flex flex-col gap-16">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-8 py-2 rounded-md w-fit">
            Planned Feature
          </span>
          <h2 className="text-body-large font-bold text-text-primary">
            Profile customization is coming soon
          </h2>
          <p className="text-body-small text-text-muted max-w-xl">
            Custom student profile attributes, target roles, and academic preferences will be configurable in an upcoming milestone. Your learning progress and active plans are fully operational.
          </p>
          <div className="pt-8">
            <Link
              href="/learning"
              className="inline-flex items-center gap-8 text-body-small font-medium text-brand-primary hover:text-brand-hover transition-colors"
            >
              <span>Explore Guided Learning</span>
              <ArrowRight className="w-16 h-16" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

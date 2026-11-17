import React from "react";
import { LearningAnalytics } from "@/features/learning/components/LearningAnalytics";
import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Learning Analytics | Placement OS",
  description: "View your learning history, active days, and plan performance.",
};

export default async function LearningAnalyticsPage() {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.has("access_token");

  return (
    <div className="w-full min-h-full bg-bg-app pb-32">
      <div className="mx-auto max-w-layout-max px-layout-px py-8 flex flex-col gap-8">
        <div className="w-full mb-2">
          <Link
            href="/learning"
            className="inline-flex items-center gap-2 text-text-muted hover:text-brand-primary transition-colors text-xs sm:text-sm font-semibold focus:outline-none"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Learning Hub
          </Link>
        </div>
        
        <LearningAnalytics isAuthenticated={isAuthenticated} />
      </div>
    </div>
  );
}

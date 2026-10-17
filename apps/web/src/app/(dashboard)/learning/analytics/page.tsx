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
    <div className="flex flex-col gap-8 p-8 max-w-[1200px] mx-auto w-full">
      <div className="w-full max-w-5xl mx-auto mb-4">
        <Link
          href="/learning"
          className="inline-flex items-center gap-2 text-[#BFC9D1] hover:text-[#FF9B51] transition-colors text-sm font-medium focus:outline-none"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Learning
        </Link>
      </div>
      
      <LearningAnalytics isAuthenticated={isAuthenticated} />
    </div>
  );
}

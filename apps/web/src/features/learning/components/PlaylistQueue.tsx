"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ListVideo, CheckCircle2, PlayCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { YouTubePlaylist } from "../types";

interface PlaylistQueueProps {
  playlist: YouTubePlaylist;
  currentVideoId: string;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PlaylistQueue({ playlist, currentVideoId }: PlaylistQueueProps) {
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const items = playlist.items || [];
  const totalCount = items.length;
  const currentIndex = items.findIndex((it) => it.video_id === currentVideoId);
  const completedCount = items.filter((it) => it.completed).length;

  if (totalCount === 0) return null;

  return (
    <div className="flex flex-col bg-[#25343F] border border-[#BFC9D1]/15 rounded-2xl overflow-hidden w-full shadow-lg">
      {/* Queue Header */}
      <div className="p-4 border-b border-[#BFC9D1]/10 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FF9B51]/15 text-[#FF9B51] flex items-center justify-center shrink-0">
              <ListVideo className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#EAEFEF] truncate" title={playlist.title}>
                {playlist.title}
              </h3>
              <p className="text-[11px] text-[#BFC9D1]">
                {currentIndex >= 0 ? `Video ${currentIndex + 1} of ${totalCount}` : `${totalCount} videos`}
                {completedCount > 0 ? ` • ${completedCount} completed` : ""}
              </p>
            </div>
          </div>

          {/* Mobile toggle button */}
          <button
            onClick={() => setIsOpenMobile(!isOpenMobile)}
            className="lg:hidden p-1.5 text-[#BFC9D1] hover:text-[#EAEFEF] rounded-lg hover:bg-[#BFC9D1]/10 transition-colors"
            aria-label={isOpenMobile ? "Collapse queue" : "Expand queue"}
          >
            {isOpenMobile ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {/* Progress bar if any item completed */}
        {totalCount > 0 && completedCount > 0 && (
          <div className="w-full bg-[#BFC9D1]/10 h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="bg-[#FF9B51] h-full transition-all duration-300 rounded-full"
              style={{ width: `${Math.round((completedCount / totalCount) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Queue Items List (collapsible on mobile, always visible on desktop) */}
      <div
        className={`flex flex-col overflow-y-auto max-h-[460px] divide-y divide-[#BFC9D1]/8 ${
          isOpenMobile ? "block" : "hidden lg:flex"
        }`}
      >
        {items.map((item, idx) => {
          const isSelected = item.video_id === currentVideoId;
          const isCompleted = item.completed;
          const hasProgress = (item.progress_percent ?? 0) > 0 && !isCompleted;

          return (
            <Link
              key={item.video_id}
              href={`/learning/video/${item.video_id}?playlistId=${playlist.id}`}
              className={`flex items-center gap-3 p-3 transition-colors focus:outline-none ${
                isSelected
                  ? "bg-[#FF9B51]/15 text-[#EAEFEF] border-l-4 border-[#FF9B51]"
                  : "hover:bg-[#BFC9D1]/5 text-[#BFC9D1] hover:text-[#EAEFEF]"
              }`}
            >
              {/* Position / Status icon */}
              <div className="w-6 text-center shrink-0">
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-[#FF9B51] mx-auto" />
                ) : hasProgress ? (
                  <PlayCircle className="w-4 h-4 text-[#FF9B51] mx-auto" />
                ) : (
                  <span className={`text-xs font-mono ${isSelected ? "text-[#FF9B51] font-bold" : "text-[#BFC9D1]/60"}`}>
                    {(idx + 1).toString().padStart(2, "0")}
                  </span>
                )}
              </div>

              {/* Small thumbnail */}
              <div className="relative w-16 aspect-video shrink-0 rounded overflow-hidden bg-[#25343F] border border-[#BFC9D1]/10">
                <Image
                  src={item.thumbnail_url}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>

              {/* Title & metadata */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className={`text-xs font-medium truncate ${isSelected ? "text-[#EAEFEF] font-semibold" : ""}`}>
                    {item.title}
                  </h4>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#BFC9D1]/70">
                  <span className="flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {formatDuration(item.duration_seconds)}
                  </span>
                  {isSelected && (
                    <span className="text-[#FF9B51] font-bold bg-[#FF9B51]/20 px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider">
                      Now Playing
                    </span>
                  )}
                  {hasProgress && !isSelected && (
                    <span className="text-[#FF9B51]">{Math.round(item.progress_percent ?? 0)}%</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}


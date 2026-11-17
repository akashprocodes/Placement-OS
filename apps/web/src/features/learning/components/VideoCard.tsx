import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { YouTubeVideo } from "../types";
import { parseIsoDuration } from "../utils/duration";
import { formatTimestamp } from "../utils/timestamp";

interface VideoCardProps {
  video: YouTubeVideo;
}

export function VideoCard({ video }: VideoCardProps) {
  const publishedDate = new Date(video.publishedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const formattedDuration = video.duration
    ? video.duration.startsWith("PT")
      ? formatTimestamp(parseIsoDuration(video.duration))
      : video.duration
    : null;

  return (
    <Link
      href={`/learning/video/${video.id}`}
      className="group flex flex-col bg-bg-surface border border-border-default rounded-xl overflow-hidden hover:border-brand-primary/60 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/50 h-full"
    >
      {/* Thumbnail Area */}
      <div className="relative w-full aspect-video bg-bg-muted border-b border-border-subtle overflow-hidden">
        <Image
          src={video.thumbnailUrl}
          alt={`Thumbnail for ${video.title}`}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        {/* Play Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-20">
          <div className="w-11 h-11 rounded-full bg-brand-primary text-text-inverse flex items-center justify-center shadow-subtle transform scale-90 group-hover:scale-100 transition-transform duration-200">
            <Play className="w-4 h-4 ml-0.5 fill-current" />
          </div>
        </div>
        {/* Duration Badge */}
        {formattedDuration && (
          <div className="absolute bottom-2.5 right-2.5 z-20 bg-bg-app/90 text-text-primary text-[11px] font-semibold px-2 py-0.5 rounded shadow-subtle backdrop-blur-sm">
            {formattedDuration}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex flex-col p-4 sm:p-5 flex-1 gap-2">
        <h3 className="text-sm sm:text-base font-bold text-text-primary line-clamp-2 leading-snug group-hover:text-brand-primary transition-colors">
          {video.title}
        </h3>
        <p className="text-xs text-text-secondary line-clamp-2 mb-auto leading-relaxed">
          {video.description}
        </p>
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border-subtle">
          <span className="text-xs font-medium text-text-muted truncate max-w-[60%]">
            {video.channelTitle}
          </span>
          <span className="text-[11px] text-text-muted shrink-0 hidden sm:inline">
            {publishedDate}
          </span>
        </div>
      </div>
    </Link>
  );
}

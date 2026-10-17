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
  // Format the date nicely (e.g. "Oct 12, 2023")
  const publishedDate = new Date(video.publishedAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Format duration if available (e.g. "PT15M30S" -> "15:30")
  const formattedDuration = video.duration
    ? video.duration.startsWith("PT")
      ? formatTimestamp(parseIsoDuration(video.duration))
      : video.duration
    : null;

  return (
    <Link 
      href={`/learning/video/${video.id}`}
      className="group flex flex-col bg-bg-surface border border-border-default rounded-xl overflow-hidden hover:border-brand-primary/50 hover:shadow-medium transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-bg-app h-full"
    >
      {/* Thumbnail Area */}
      <div className="relative w-full aspect-video bg-bg-muted border-b border-border-subtle overflow-hidden">
        <Image 
          src={video.thumbnailUrl} 
          alt={`Thumbnail for ${video.title}`}
          fill
          className="object-cover transition-transform duration-slow group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        {/* Play Overlay */}
        <div className="absolute inset-0 bg-bg-app/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-48 h-48 rounded-full bg-brand-primary text-text-inverse flex items-center justify-center shadow-elevated">
            <Play className="w-24 h-24 ml-2" fill="currentColor" />
          </div>
        </div>
        {/* Duration Badge */}
        {formattedDuration && (
          <div className="absolute bottom-8 right-8 bg-bg-app/90 text-text-primary text-caption font-medium px-6 py-2 rounded">
            {formattedDuration}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex flex-col p-16 flex-1 gap-8">
        <h3 className="text-body font-semibold text-text-primary line-clamp-2 leading-snug group-hover:text-brand-primary transition-colors">
          {video.title}
        </h3>
        <p className="text-body-small text-text-secondary line-clamp-2 mb-auto">
          {video.description}
        </p>
        <div className="flex items-center justify-between mt-8 pt-8 border-t border-border-subtle">
          <span className="text-caption font-medium text-text-muted truncate max-w-[60%]">
            {video.channelTitle}
          </span>
          <span className="text-caption text-text-muted shrink-0">
            {publishedDate}
          </span>
        </div>
      </div>
    </Link>
  );
}

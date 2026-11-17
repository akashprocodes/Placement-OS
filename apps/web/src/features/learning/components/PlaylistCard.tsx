import React from "react";
import Image from "next/image";
import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { YouTubePlaylist } from "../types";

interface PlaylistCardProps {
  playlist: YouTubePlaylist;
}

export function PlaylistCard({ playlist }: PlaylistCardProps) {
  return (
    <Link
      href={`/learning/playlist/${playlist.id}`}
      className="group flex flex-col sm:flex-row bg-bg-surface border border-border-default rounded-xl overflow-hidden hover:border-brand-primary/60 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
    >
      {/* Thumbnail Area */}
      <div className="relative w-full sm:w-64 sm:h-auto aspect-video sm:aspect-auto bg-bg-muted border-b sm:border-b-0 sm:border-r border-border-subtle overflow-hidden shrink-0">
        <Image
          src={playlist.thumbnailUrl}
          alt={`Thumbnail for ${playlist.title}`}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, 256px"
        />
        {/* Playlist count overlay */}
        <div className="absolute inset-y-0 right-0 w-1/3 sm:w-auto bg-gradient-to-l from-bg-app/90 to-transparent flex flex-col items-center justify-center gap-1 border-l border-border-subtle/30 z-20 px-3 py-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            <PlayCircle className="w-4 h-4 text-brand-primary" />
            <span>
              {playlist.itemCount !== undefined && playlist.itemCount !== null
                ? playlist.itemCount
                : "-"}
            </span>
            <span className="text-[10px] text-text-muted hidden sm:inline">
              {playlist.itemCount === 1 ? "video" : "videos"}
            </span>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-col p-4 sm:p-5 flex-1 justify-center gap-2">
        <h3 className="text-sm sm:text-base font-bold text-text-primary line-clamp-2 leading-snug group-hover:text-brand-primary transition-colors">
          {playlist.title}
        </h3>
        <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
          {playlist.description}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <div className="w-6 h-6 rounded-md bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-bold flex items-center justify-center shrink-0">
            {playlist.channelTitle.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs font-medium text-text-muted truncate">
            {playlist.channelTitle}
          </span>
        </div>
      </div>
    </Link>
  );
}

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ListVideo } from "lucide-react";
import { YouTubePlaylist } from "../types";

interface PlaylistCardProps {
  playlist: YouTubePlaylist;
}

export function PlaylistCard({ playlist }: PlaylistCardProps) {
  return (
    <Link 
      href={`/learning/playlist/${playlist.id}`}
      className="group flex flex-col sm:flex-row bg-bg-surface border border-border-default rounded-xl overflow-hidden hover:border-brand-primary/50 hover:shadow-medium transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-bg-app"
    >
      {/* Thumbnail Area */}
      <div className="relative w-full sm:w-64 sm:h-auto aspect-video sm:aspect-auto bg-bg-muted border-b sm:border-b-0 sm:border-r border-border-subtle overflow-hidden shrink-0">
        <Image 
          src={playlist.thumbnailUrl} 
          alt={`Thumbnail for ${playlist.title}`}
          fill
          className="object-cover transition-transform duration-slow group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, 256px"
        />
        {/* Playlist Overlay Indicator */}
        <div className="absolute inset-y-0 right-0 w-1/3 bg-bg-app/90 flex flex-col items-center justify-center gap-4 border-l border-border-subtle/30">
          <ListVideo className="w-24 h-24 text-text-primary" />
          {playlist.itemCount !== undefined && playlist.itemCount !== null && (
            <>
              <span className="text-body-small font-medium text-text-primary">
                {playlist.itemCount}
              </span>
              <span className="text-caption text-text-muted">Videos</span>
            </>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-col p-16 flex-1 justify-center gap-8">
        <h3 className="text-body-large font-bold text-text-primary line-clamp-2 leading-snug group-hover:text-brand-primary transition-colors">
          {playlist.title}
        </h3>
        <p className="text-body-small text-text-secondary line-clamp-2">
          {playlist.description}
        </p>
        <div className="flex items-center gap-8 mt-8">
          <div className="w-24 h-24 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-[10px]">
            {playlist.channelTitle.charAt(0)}
          </div>
          <span className="text-caption font-medium text-text-muted">
            {playlist.channelTitle}
          </span>
        </div>
      </div>
    </Link>
  );
}

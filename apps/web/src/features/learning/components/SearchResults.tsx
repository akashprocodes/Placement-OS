"use client";

import React, { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { VideoCard } from "./VideoCard";
import { PlaylistCard } from "./PlaylistCard";
import { LearningSearchResult, YouTubeVideo, YouTubePlaylist } from "../types";
import { searchLearningContent } from "../services/learningService";

interface SearchResultsProps {
  results: LearningSearchResult;
}

export function SearchResults({ results }: SearchResultsProps) {
  const [prevQuery, setPrevQuery] = useState(results.query);
  const [appendedVideos, setAppendedVideos] = useState<YouTubeVideo[]>([]);
  const [appendedPlaylists, setAppendedPlaylists] = useState<YouTubePlaylist[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null | undefined>(results.nextPageToken);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Sync state during render when results query changes (per React docs recommendation)
  if (results.query !== prevQuery) {
    setPrevQuery(results.query);
    setAppendedVideos([]);
    setAppendedPlaylists([]);
    setNextPageToken(results.nextPageToken);
    setLoadError(null);
  }

  const allVideos = [...(results.videos || []), ...appendedVideos];
  const allPlaylists = [...(results.playlists || []), ...appendedPlaylists];

  const handleLoadMore = async () => {
    if (!nextPageToken || isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const nextResults = await searchLearningContent(results.query, nextPageToken);
      setAppendedVideos((prev) => {
        const existingIds = new Set([...(results.videos || []).map((v) => v.id), ...prev.map((v) => v.id)]);
        const newItems = (nextResults.videos || []).filter((v) => !existingIds.has(v.id));
        return [...prev, ...newItems];
      });
      setAppendedPlaylists((prev) => {
        const existingIds = new Set([...(results.playlists || []).map((p) => p.id), ...prev.map((p) => p.id)]);
        const newItems = (nextResults.playlists || []).filter((p) => !existingIds.has(p.id));
        return [...prev, ...newItems];
      });
      setNextPageToken(nextResults.nextPageToken);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load more results";
      setLoadError(msg);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const hasVideos = allVideos.length > 0;
  const hasPlaylists = allPlaylists.length > 0;

  if (!hasVideos && !hasPlaylists) {
    return (
      <div className="flex flex-col items-center justify-center p-32 text-center border border-border-subtle rounded-xl glass-panel mt-16 max-w-4xl mx-auto w-full">
        <h2 className="text-h4 font-bold text-text-primary mb-8">
          No relevant results found
        </h2>
        <p className="text-body text-text-secondary mb-16">
          We couldn&apos;t find anything for &quot;<span className="text-text-primary font-medium">{results.query}</span>&quot;
        </p>
        <p className="text-body-small text-text-muted">
          Try a different search term or check your spelling.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-32 w-full mt-16 animate-in fade-in duration-normal">
      <div className="flex flex-col gap-4">
        <h2 className="text-h4 font-bold text-text-primary">
          Results for &quot;<span className="text-brand-primary">{results.query}</span>&quot;
        </h2>
        <p className="text-body-small text-text-muted">
          Selected high-quality content ready for your learning plan.
        </p>
      </div>

      {hasPlaylists && (
        <div className="flex flex-col gap-16">
          <h3 className="text-label font-semibold text-text-secondary uppercase tracking-wider">
            Playlists
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            {allPlaylists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        </div>
      )}

      {hasVideos && (
        <div className="flex flex-col gap-16">
          <h3 className="text-label font-semibold text-text-secondary uppercase tracking-wider">
            Videos
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-16 md:gap-24">
            {allVideos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </div>
      )}

      {nextPageToken && (
        <div className="flex flex-col items-center justify-center pt-16 pb-24 gap-12 w-full">
          {loadError && (
            <div className="flex items-center gap-8 text-status-error text-body-small">
              <AlertCircle className="w-16 h-16 shrink-0" />
              <span>{loadError}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center justify-center gap-8 px-24 py-12 bg-bg-surface hover:bg-bg-surface-elevated border border-border-default hover:border-brand-primary/50 text-text-primary hover:text-brand-primary font-medium text-body-small rounded-xl transition-all shadow-subtle focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-16 h-16 animate-spin text-brand-primary" />
                <span>Loading more...</span>
              </>
            ) : (
              <span>Load More Results</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

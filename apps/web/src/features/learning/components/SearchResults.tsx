"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Loader2, AlertCircle, BookOpen, PlayCircle, Layers } from "lucide-react";
import { VideoCard } from "./VideoCard";
import { PlaylistCard } from "./PlaylistCard";
import { LearningSearchResult, YouTubeVideo, YouTubePlaylist } from "../types";
import { searchLearningContent } from "../services/learningService";

interface SearchResultsProps {
  results: LearningSearchResult;
}

type FilterTab = "all" | "videos" | "playlists";

export function SearchResults({ results }: SearchResultsProps) {
  const [prevQuery, setPrevQuery] = useState(results.query);
  const [appendedVideos, setAppendedVideos] = useState<YouTubeVideo[]>([]);
  const [appendedPlaylists, setAppendedPlaylists] = useState<YouTubePlaylist[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null | undefined>(results.nextPageToken);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  // Sync state during render when results query changes (per React docs recommendation)
  if (results.query !== prevQuery) {
    setPrevQuery(results.query);
    setAppendedVideos([]);
    setAppendedPlaylists([]);
    setNextPageToken(results.nextPageToken);
    setLoadError(null);
    setActiveTab("all");
  }

  const appendVideos = useCallback((videos: YouTubeVideo[]) => {
    const existingIds = new Set([...(results.videos || []).map((v) => v.id), ...appendedVideos.map((v) => v.id)]);
    return [...appendedVideos, ...videos.filter((v) => !existingIds.has(v.id))];
  }, [appendedVideos, results.videos]);

  const appendPlaylists = useCallback((playlists: YouTubePlaylist[]) => {
    const existingIds = new Set([...(results.playlists || []).map((p) => p.id), ...appendedPlaylists.map((p) => p.id)]);
    return [...appendedPlaylists, ...playlists.filter((p) => !existingIds.has(p.id))];
  }, [appendedPlaylists, results.playlists]);

  const allVideos = useMemo(() => [...(results.videos || []), ...appendedVideos], [appendedVideos, results.videos]);
  const allPlaylists = useMemo(() => [...(results.playlists || []), ...appendedPlaylists], [appendedPlaylists, results.playlists]);

  const filteredResults = useMemo(() => {
    if (activeTab === "all") return { videos: allVideos, playlists: allPlaylists };
    if (activeTab === "videos") return { videos: allVideos, playlists: [] };
    return { videos: [], playlists: allPlaylists };
  }, [activeTab, allVideos, allPlaylists]);

  const handleLoadMore = async () => {
    if (!nextPageToken || isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const nextResults = await searchLearningContent(results.query, nextPageToken);
      setAppendedVideos(appendVideos(nextResults.videos || []));
      setAppendedPlaylists(appendPlaylists(nextResults.playlists || []));
      setNextPageToken(nextResults.nextPageToken);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load more results";
      setLoadError(msg);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const hasPlaylists = filteredResults.playlists.length > 0;
  const hasVideos = filteredResults.videos.length > 0;
  const totalResults = allVideos.length + allPlaylists.length;

  if (!hasVideos && !hasPlaylists) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-white/[0.08] rounded-2xl bg-white/[0.02] mt-6 max-w-2xl mx-auto w-full backdrop-blur-xl">
        <BookOpen className="w-10 h-10 text-text-muted mb-3" />
        <h2 className="text-base font-bold text-text-primary mb-2">
          No relevant results found
        </h2>
        <p className="text-xs text-text-secondary mb-1">
          We couldn&apos;t find anything for &quot;<span className="text-brand-primary font-medium">{results.query}</span>&quot;
        </p>
        <p className="text-xs text-text-muted">
          Try a different search term or check spelling.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 w-full mt-4 animate-in fade-in duration-200">
      {/* Results header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-text-primary">
              Results for &quot;<span className="text-brand-primary">{results.query}</span>&quot;
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {totalResults} {totalResults === 1 ? "course/lecture" : "courses & lectures"} available to add to your plan
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <BookOpen className="w-4 h-4 text-brand-primary" />
            <span className="text-xs text-text-secondary font-medium">Curated from YouTube</span>
          </div>
        </div>

        {/* Tab filter */}
        <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.08] rounded-xl p-1 w-fit backdrop-blur-xl">
          {[
            { id: "all", label: "All", icon: Layers },
            { id: "playlists", label: "Playlists", icon: Layers },
            { id: "videos", label: "Single Videos", icon: PlayCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as FilterTab)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-brand-primary text-text-inverse shadow-[0_0_15px_rgba(255,155,81,0.3)]"
                    : "text-text-secondary hover:text-text-primary hover:bg-white/[0.04]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.id !== "all" && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? "bg-black/20 text-text-inverse" : "bg-white/[0.06] text-text-muted"}`}>
                    {tab.id === "playlists" ? allPlaylists.length : allVideos.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty tab state */}
      {activeTab === "playlists" && allPlaylists.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-white/[0.08] rounded-2xl bg-white/[0.01]">
          <BookOpen className="w-10 h-10 text-text-muted mb-3" />
          <h3 className="text-sm font-semibold text-text-primary mb-1">No playlists in this search</h3>
          <p className="text-xs text-text-muted">Switch to &apos;All&apos; or &apos;Single Videos&apos; to view related content.</p>
        </div>
      )}

      {activeTab === "videos" && allVideos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-white/[0.08] rounded-2xl bg-white/[0.01]">
          <PlayCircle className="w-10 h-10 text-text-muted mb-3" />
          <h3 className="text-sm font-semibold text-text-primary mb-1">No standalone videos in this category</h3>
          <p className="text-xs text-text-muted">Switch to &apos;All&apos; or &apos;Playlists&apos; to view related content.</p>
        </div>
      )}

      {hasPlaylists && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-brand-primary rounded-full" />
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              Playlists & Complete Series ({filteredResults.playlists.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {filteredResults.playlists.map((playlist) => (
              <PlaylistCard key={playlist.id} playlist={playlist} />
            ))}
          </div>
        </div>
      )}

      {hasVideos && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-brand-primary rounded-full" />
            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
              Single Lectures & Guides ({filteredResults.videos.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredResults.videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </div>
      )}

      {nextPageToken && (
        <div className="flex flex-col items-center justify-center pt-4 pb-8 gap-3 w-full">
          {loadError && (
            <div className="flex items-center gap-2 text-status-error text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loadError}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] hover:border-brand-primary/50 text-text-primary hover:text-brand-primary font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
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

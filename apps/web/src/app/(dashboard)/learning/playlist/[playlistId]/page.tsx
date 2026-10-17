import React, { Suspense } from "react";
import { getYouTubePlaylist } from "@/features/learning/services/learningService";
import { ArrowLeft, ListVideo, Clock, ExternalLink, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { LearningPlanCTA } from "@/features/learning/components/LearningPlanCTA";

function formatItemDuration(seconds: number | null | undefined) {
  if (seconds == null || seconds <= 0) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTotalDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

interface PlaylistPageProps {
  params: Promise<{ playlistId: string }>;
}

export default async function PlaylistPage(props: PlaylistPageProps) {
  const params = await props.params;
  const playlistId = params.playlistId;

  if (!playlistId) return notFound();

  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.has("access_token");

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 gap-0">
      <Link
        href="/learning"
        className="inline-flex items-center gap-2 text-[#BFC9D1] hover:text-[#FF9B51] transition-colors font-medium mb-6 w-fit focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/40 rounded text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Learning
      </Link>

      <Suspense fallback={<PlaylistLoadingSkeleton />}>
        <AsyncPlaylistDetails
          playlistId={playlistId}
          isAuthenticated={isAuthenticated}
          cookieHeader={cookieStore.toString()}
        />
      </Suspense>
    </div>
  );
}

async function AsyncPlaylistDetails({
  playlistId,
  isAuthenticated,
  cookieHeader,
}: {
  playlistId: string;
  isAuthenticated: boolean;
  cookieHeader?: string;
}) {
  let playlist;
  try {
    playlist = await getYouTubePlaylist(playlistId, cookieHeader);
  } catch {
    return notFound();
  }

  const totalDuration = formatTotalDuration(playlist.total_duration_seconds);
  const items = playlist.items || [];
  const completedCount = playlist.completed_count ?? 0;
  const totalCount = playlist.total_count ?? items.length;
  const overallPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const nextVideoId = playlist.next_incomplete_video_id || (items.length > 0 ? items[0].video_id : null);
  const isAllCompleted = completedCount > 0 && completedCount === totalCount;

  return (
    <div className="flex flex-col gap-8">
      {/* Hero: Thumbnail + Info */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 items-start p-6 bg-[#BFC9D1]/5 border border-[#BFC9D1]/10 rounded-2xl">
        {/* Thumbnail */}
        <div className="relative w-full aspect-video md:aspect-auto md:h-36 rounded-xl overflow-hidden border border-[#BFC9D1]/10 bg-[#25343F] shrink-0">
          <Image
            src={playlist.thumbnailUrl}
            alt={`Thumbnail for ${playlist.title}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 240px"
            priority
          />
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-[#EAEFEF] leading-tight">
            {playlist.title}
          </h1>

          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#FF9B51]/15 text-[#FF9B51] flex items-center justify-center font-bold text-[10px] shrink-0">
              {playlist.channelTitle.charAt(0)}
            </div>
            <span className="text-sm font-medium text-[#EAEFEF]">{playlist.channelTitle}</span>
          </div>

          <div className="flex flex-wrap gap-3">
            {playlist.itemCount != null && playlist.itemCount > 0 && (
              <div className="inline-flex items-center gap-1.5 text-xs text-[#BFC9D1] bg-[#BFC9D1]/10 px-3 py-1.5 rounded-full">
                <ListVideo className="w-3.5 h-3.5" />
                {playlist.itemCount} videos
              </div>
            )}
            {totalDuration && (
              <div className="inline-flex items-center gap-1.5 text-xs text-[#BFC9D1] bg-[#BFC9D1]/10 px-3 py-1.5 rounded-full">
                <Clock className="w-3.5 h-3.5" />
                {totalDuration} total
              </div>
            )}
          </div>

          {/* Overall playlist progress bar if authenticated */}
          {isAuthenticated && totalCount > 0 && (
            <div className="flex flex-col gap-1.5 p-3 bg-[#25343F] rounded-xl border border-[#BFC9D1]/15 max-w-md">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#BFC9D1] font-medium">Playlist Progress</span>
                <span className="font-semibold text-[#FF9B51]">
                  {completedCount} of {totalCount} completed ({overallPercent}%)
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#BFC9D1]/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#FF9B51] transition-all duration-500 rounded-full"
                  style={{ width: `${overallPercent}%` }}
                />
              </div>
            </div>
          )}

          {playlist.description && (
            <p className="text-sm text-[#BFC9D1] line-clamp-3 leading-relaxed">
              {playlist.description}
            </p>
          )}
        </div>
      </div>

      {/* Two-column: Plan CTA + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">
        {/* Playlist Contents */}
        <section className="flex flex-col gap-4 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#EAEFEF]">
              Playlist Contents
              {items.length ? (
                <span className="ml-2 text-sm font-normal text-[#BFC9D1]">({items.length} videos)</span>
              ) : null}
            </h2>
            {isAuthenticated && completedCount > 0 && (
              <span className="text-xs font-medium text-[#FF9B51]">
                {completedCount}/{totalCount} Completed
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1 bg-[#BFC9D1]/5 border border-[#BFC9D1]/10 rounded-xl overflow-hidden">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <ListVideo className="w-10 h-10 text-[#BFC9D1] mb-3 opacity-50" />
                <p className="text-sm font-semibold text-[#EAEFEF] mb-1">No videos found</p>
                <p className="text-xs text-[#BFC9D1]">This playlist is empty or videos are unavailable.</p>
              </div>
            ) : (
              items.map((item, idx) => {
                const isCompleted = item.completed;
                const hasProgress = (item.progress_percent ?? 0) > 0 && !isCompleted;
                const isUpNext = item.video_id === playlist.next_incomplete_video_id && !isCompleted;

                return (
                  <Link
                    href={`/learning/video/${item.video_id}?playlistId=${playlist.id}`}
                    key={item.video_id}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-[#BFC9D1]/10 transition-colors focus:outline-none focus:bg-[#BFC9D1]/10 ${
                      idx !== 0 ? "border-t border-[#BFC9D1]/8" : ""
                    } ${isCompleted ? "bg-[#FF9B51]/5" : ""}`}
                  >
                    <span className="text-xs font-medium text-[#BFC9D1]/60 w-6 text-right shrink-0">
                      {(item.position + 1).toString().padStart(2, "0")}
                    </span>

                    <div className="relative w-24 aspect-video shrink-0 rounded-md overflow-hidden border border-[#BFC9D1]/15 bg-[#25343F]">
                      <Image
                        src={item.thumbnail_url}
                        alt={item.title}
                        fill
                        className="object-cover"
                        sizes="96px"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-[#EAEFEF] line-clamp-2 leading-snug">
                          {item.title}
                        </h4>
                        {isUpNext && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase bg-[#FF9B51]/20 text-[#FF9B51]">
                            Up Next
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-[#BFC9D1]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span>{formatItemDuration(item.duration_seconds)}</span>
                        </div>

                        {/* Progress status badge */}
                        {isCompleted ? (
                          <div className="inline-flex items-center gap-1 text-[#FF9B51] font-semibold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Completed</span>
                          </div>
                        ) : hasProgress ? (
                          <div className="inline-flex items-center gap-1.5 text-xs text-[#FF9B51]">
                            <span>{Math.round(item.progress_percent ?? 0)}%</span>
                            <div className="w-12 h-1 bg-[#BFC9D1]/20 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#FF9B51] rounded-full"
                                style={{ width: `${Math.round(item.progress_percent ?? 0)}%` }}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        {/* Sidebar: Next Incomplete Action + Learning Plan CTA */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          {/* Action button to continue from next incomplete video */}
          {nextVideoId && !isAllCompleted && (
            <Link
              href={`/learning/video/${nextVideoId}?playlistId=${playlist.id}`}
              className="w-full py-3 px-4 bg-[#FF9B51] hover:bg-[#e88a44] text-[#25343F] font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#FF9B51]/20"
            >
              <span>{completedCount > 0 ? "Continue Learning" : "Start Playlist"}</span>
            </Link>
          )}

          {isAllCompleted && (
            <div className="flex flex-col gap-2">
              <div className="w-full py-2.5 px-4 bg-[#FF9B51]/10 border border-[#FF9B51]/25 text-[#FF9B51] text-xs font-semibold rounded-xl flex items-center justify-center gap-2 text-center">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>All {totalCount} videos completed!</span>
              </div>
              {items.length > 0 && (
                <Link
                  href={`/learning/video/${items[0].video_id}?playlistId=${playlist.id}`}
                  className="w-full py-2.5 px-4 bg-transparent border border-[#FF9B51]/40 text-[#FF9B51] hover:bg-[#FF9B51]/10 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-center"
                >
                  <span>Rewatch Course from Beginning</span>
                </Link>
              )}
            </div>
          )}

          <LearningPlanCTA
            contentId={playlist.id}
            contentType="playlist"
            title={playlist.title}
            thumbnailUrl={playlist.thumbnailUrl}
            durationSeconds={playlist.total_duration_seconds}
            isAuthenticated={isAuthenticated}
          />

          {(!playlist.duration_available || playlist.total_duration_seconds === 0) && (
            <p className="text-xs text-center text-[#BFC9D1] px-2">
              Learning plan unavailable: some video durations in this playlist could not be determined.
            </p>
          )}

          <a
            href={playlist.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 bg-transparent border border-[#BFC9D1]/20 hover:bg-[#BFC9D1]/10 text-[#BFC9D1] hover:text-[#EAEFEF] text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#BFC9D1]/30"
          >
            <ExternalLink className="w-4 h-4" />
            Open in YouTube
          </a>
        </aside>
      </div>
    </div>
  );
}

function PlaylistLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 p-6 bg-[#BFC9D1]/5 border border-[#BFC9D1]/10 rounded-2xl">
        <div className="w-full aspect-video md:aspect-auto md:h-36 bg-[#BFC9D1]/10 rounded-xl animate-pulse" />
        <div className="flex flex-col gap-4">
          <div className="h-8 bg-[#BFC9D1]/10 rounded-lg w-3/4 animate-pulse" />
          <div className="h-4 bg-[#BFC9D1]/10 rounded w-1/3 animate-pulse" />
          <div className="h-16 bg-[#BFC9D1]/5 rounded-xl animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        <div className="h-80 bg-[#BFC9D1]/5 border border-[#BFC9D1]/10 rounded-xl animate-pulse" />
        <div className="h-48 bg-[#BFC9D1]/5 border border-[#BFC9D1]/10 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

import React, { Suspense } from "react";
import { getYouTubeVideo, getYouTubePlaylist, getVideoPlanContext } from "@/features/learning/services/learningService";
import { ArrowLeft, Clock, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VideoProgressTracker } from "@/features/learning/components/VideoProgressTracker";
import { LearningPlanCTA } from "@/features/learning/components/LearningPlanCTA";
import { PlaylistQueue } from "@/features/learning/components/PlaylistQueue";
import { cookies } from "next/headers";
import { parseIsoDuration } from "@/features/learning/utils/duration";
import { YouTubePlaylist } from "@/features/learning/types";
import { VideoPlayerProvider } from "@/features/learning/context/VideoPlayerContext";
import { VideoNotesPanel } from "@/features/learning/components/VideoNotesPanel";

interface VideoPageProps {
  params: Promise<{ videoId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function VideoPage(props: VideoPageProps) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const videoId = params.videoId;
  const playlistId = typeof searchParams?.playlistId === "string" ? searchParams.playlistId : undefined;

  if (!videoId) return notFound();

  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.has("access_token");
  const cookieHeader = cookieStore.toString();
  const rawT = searchParams?.t;
  const parsedT = typeof rawT === "string" ? parseInt(rawT, 10) : undefined;
  const initialTime = typeof parsedT === "number" && !isNaN(parsedT) && parsedT > 0 ? parsedT : undefined;

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 gap-0">
      <Suspense fallback={<VideoLoadingSkeleton />}>
        <AsyncVideoDetails
          videoId={videoId}
          isAuthenticated={isAuthenticated}
          playlistId={playlistId}
          cookieHeader={cookieHeader}
          initialTime={initialTime}
        />
      </Suspense>
    </div>
  );
}

async function AsyncVideoDetails({
  videoId,
  isAuthenticated,
  playlistId,
  cookieHeader,
  initialTime,
}: {
  videoId: string;
  isAuthenticated: boolean;
  playlistId?: string;
  cookieHeader?: string;
  initialTime?: number;
}) {
  const [videoResult, planContext] = await Promise.all([
    getYouTubeVideo(videoId).catch(() => null),
    getVideoPlanContext(videoId, playlistId, cookieHeader).catch(() => null),
  ]);

  if (!videoResult) return notFound();
  const video = videoResult;

  // Resolve playlistId: prefer explicit URL playlistId, fallback to parent_playlist_id from plan context
  const effectivePlaylistId = playlistId || planContext?.parent_playlist_id || undefined;

  let playlist: YouTubePlaylist | null = null;
  let currentIndex = -1;
  if (effectivePlaylistId) {
    try {
      playlist = await getYouTubePlaylist(effectivePlaylistId, cookieHeader);
      currentIndex = playlist.items?.findIndex((it) => it.video_id === videoId) ?? -1;
      if (currentIndex === -1) {
        playlist = null;
      }
    } catch {
      playlist = null;
    }
  }

  const items = playlist?.items || [];
  const prevVideo = playlist && currentIndex > 0 ? items[currentIndex - 1] : null;
  const nextVideo =
    playlist && currentIndex >= 0 && currentIndex < items.length - 1
      ? items[currentIndex + 1]
      : null;

  const publishedDate = new Date(video.publishedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const durationSeconds = parseIsoDuration(video.duration);

  return (
    <VideoPlayerProvider>
      <div className="flex flex-col gap-6">
        {/* Top Navigation / Breadcrumb */}
        {playlist ? (
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <Link
              href={`/learning/playlist/${playlist.id}`}
              className="inline-flex items-center gap-2 text-[#BFC9D1] hover:text-[#FF9B51] transition-colors font-medium w-fit focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/40 rounded text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="truncate max-w-xs sm:max-w-md">Back to {playlist.title}</span>
            </Link>
            <span className="text-[#BFC9D1]/30 text-sm hidden sm:inline">•</span>
            <Link
              href="/learning"
              className="text-xs text-[#BFC9D1]/70 hover:text-[#EAEFEF] transition-colors"
            >
              All Learning
            </Link>
          </div>
        ) : (
          <Link
            href="/learning"
            className="inline-flex items-center gap-2 text-[#BFC9D1] hover:text-[#FF9B51] transition-colors font-medium mb-2 w-fit focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/40 rounded text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Learning
          </Link>
        )}

        {/* Player + inline progress tracker */}
        <VideoProgressTracker videoId={videoId} isAuthenticated={isAuthenticated} initialTime={initialTime} />

        {/* Playlist Navigation Bar */}
        {playlist && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#25343F] border border-[#BFC9D1]/15 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="font-semibold text-[#FF9B51] shrink-0 text-xs px-2.5 py-1 rounded bg-[#FF9B51]/15 border border-[#FF9B51]/20">
                Video {currentIndex + 1} of {items.length}
              </span>
              <span className="text-[#BFC9D1] text-xs sm:text-sm font-medium truncate" title={playlist.title}>
                {playlist.title}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {prevVideo ? (
                <Link
                  href={`/learning/video/${prevVideo.video_id}?playlistId=${playlist.id}`}
                  data-testid="playlist-prev-btn"
                  aria-label="Previous video"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#BFC9D1]/10 hover:bg-[#BFC9D1]/20 text-[#EAEFEF] transition-colors text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/40"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </Link>
              ) : (
                <button
                  disabled
                  data-testid="playlist-prev-btn"
                  aria-label="Previous video"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#BFC9D1]/5 text-[#BFC9D1]/30 cursor-not-allowed text-xs font-medium"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>
              )}

              {nextVideo ? (
                <Link
                  href={`/learning/video/${nextVideo.video_id}?playlistId=${playlist.id}`}
                  data-testid="playlist-next-btn"
                  aria-label="Next video"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF9B51] text-[#25343F] hover:bg-[#FF9B51]/90 transition-colors text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF9B51]/40"
                  title={`Next: ${nextVideo.title}`}
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              ) : (
                <button
                  disabled
                  data-testid="playlist-next-btn"
                  aria-label="Next video"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#BFC9D1]/5 text-[#BFC9D1]/30 cursor-not-allowed text-xs font-medium"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Two-column below: Meta + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          {/* Meta column */}
          <div className="flex flex-col gap-6 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-[#EAEFEF] leading-tight">
              {video.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-[#BFC9D1]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#FF9B51]/15 text-[#FF9B51] flex items-center justify-center font-bold text-[10px] shrink-0">
                  {video.channelTitle.charAt(0)}
                </div>
                <span className="font-medium text-[#EAEFEF]">{video.channelTitle}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                <span>{publishedDate}</span>
              </div>
              {video.duration && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{video.duration}</span>
                </div>
              )}
            </div>

            {video.description && (
              <div className="p-4 bg-[#BFC9D1]/5 border border-[#BFC9D1]/10 rounded-xl">
                <p className="text-sm text-[#BFC9D1] whitespace-pre-wrap leading-relaxed line-clamp-6">
                  {video.description}
                </p>
              </div>
            )}

            {/* Notes & Bookmarks Panel */}
            <VideoNotesPanel
              videoId={videoId}
              isAuthenticated={isAuthenticated}
              durationSeconds={durationSeconds}
            />
          </div>

          {/* Sidebar: Queue (if playlist) + Learning Plan CTA */}
          <div className="w-full shrink-0 flex flex-col gap-6 lg:sticky lg:top-24">
            {playlist && (
              <PlaylistQueue playlist={playlist} currentVideoId={videoId} />
            )}

            <LearningPlanCTA
              contentId={video.id}
              contentType="video"
              title={video.title}
              thumbnailUrl={video.thumbnailUrl}
              durationSeconds={durationSeconds}
              isAuthenticated={isAuthenticated}
              showContinueButton={true}
              planContext={planContext}
            />
          </div>
        </div>
      </div>
    </VideoPlayerProvider>
  );
}

function VideoLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-5 bg-[#BFC9D1]/10 rounded w-36 mb-2 animate-pulse" />
      <div className="w-full aspect-video bg-[#BFC9D1]/5 border border-[#BFC9D1]/10 rounded-2xl animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <div className="flex flex-col gap-4">
          <div className="h-8 bg-[#BFC9D1]/10 rounded-lg w-3/4 animate-pulse" />
          <div className="h-4 bg-[#BFC9D1]/10 rounded w-1/3 animate-pulse" />
          <div className="h-32 bg-[#BFC9D1]/5 border border-[#BFC9D1]/10 rounded-xl animate-pulse" />
        </div>
        <div className="flex flex-col gap-4">
          <div className="h-48 bg-[#BFC9D1]/5 border border-[#BFC9D1]/10 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

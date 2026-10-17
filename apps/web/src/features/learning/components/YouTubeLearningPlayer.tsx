"use client";

import { useEffect, useRef, useCallback } from "react";
import { useVideoPlayer } from "../context/VideoPlayerContext";

interface YouTubeLearningPlayerProps {
  videoId: string;
  initialProgressSeconds?: number;
  onProgress: (progressSeconds: number, durationSeconds: number) => void;
  onReady?: () => void;
  onPlay?: (rate: number, position: number) => void;
  onPause?: (position: number) => void;
  onEnded?: (position: number) => void;
  onRateChange?: (rate: number, position: number) => void;
}

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

// Load the YouTube IFrame API script once per page lifetime
function loadYTScript(onReady: () => void) {
  if (window.YT?.Player) {
    onReady();
    return;
  }
  // Queue the callback in case script is already loading
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    prev?.();
    onReady();
  };
  if (!document.getElementById("yt-iframe-api")) {
    const tag = document.createElement("script");
    tag.id = "yt-iframe-api";
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }
}

export function YouTubeLearningPlayer({
  videoId,
  initialProgressSeconds = 0,
  onProgress,
  onReady,
  onPlay,
  onPause,
  onEnded,
  onRateChange,
}: YouTubeLearningPlayerProps) {
  const { registerPlayer } = useVideoPlayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastReportedRef = useRef<number>(-1);
  // Persist callbacks in refs to avoid stale closures in YT event handlers
  const onProgressRef = useRef(onProgress);
  const onReadyRef = useRef(onReady);
  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);
  const onEndedRef = useRef(onEnded);
  const onRateChangeRef = useRef(onRateChange);
  // Persist initial seek position in a ref — we only use it once on player ready
  const initialSeekRef = useRef(initialProgressSeconds);
  const hasInitialSeekedRef = useRef(false);

  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => { onPlayRef.current = onPlay; }, [onPlay]);
  useEffect(() => { onPauseRef.current = onPause; }, [onPause]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { onRateChangeRef.current = onRateChange; }, [onRateChange]);
  // Update the seek ref if parent fetches a later initial position, and perform initial seek if player ready
  useEffect(() => {
    initialSeekRef.current = initialProgressSeconds;
    if (!hasInitialSeekedRef.current && initialProgressSeconds > 2 && playerRef.current?.seekTo) {
      playerRef.current.seekTo(initialProgressSeconds, true);
      hasInitialSeekedRef.current = true;
    }
  }, [initialProgressSeconds]);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startInterval = useCallback(() => {
    stopInterval();
    intervalRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const current = Math.floor(player.getCurrentTime?.() ?? 0);
      const duration = Math.floor(player.getDuration?.() ?? 0);
      // Only report if position advanced meaningfully
      if (duration > 0 && current !== lastReportedRef.current) {
        lastReportedRef.current = current;
        onProgressRef.current(current, duration);
      }
    }, 12_000); // ~12 second throttle
  }, [stopInterval]);

  // Player lifecycle — only depends on videoId, NOT on initialProgressSeconds
  // This prevents the player from being destroyed/recreated when progress updates
  useEffect(() => {
    let mounted = true;

    function createPlayer() {
      if (!mounted || !containerRef.current) return;
      const divId = `yt-player-${videoId}`;
      // Must set the id on the container before constructing the Player
      containerRef.current.id = divId;

      playerRef.current = new window.YT.Player(divId, {
        videoId,
        playerVars: {
          autoplay: 0,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event: YT.PlayerEvent) => {
            if (!mounted) return;
            // Register player handle for timestamp seeking and time reading
            registerPlayer({
              getCurrentTime: () => Math.floor(playerRef.current?.getCurrentTime?.() ?? 0),
              seekTo: (seconds: number) => {
                playerRef.current?.seekTo?.(seconds, true);
              },
              getDuration: () => Math.floor(playerRef.current?.getDuration?.() ?? 0),
            });

            // Use the ref value so we always get the latest initial position
            if (!hasInitialSeekedRef.current && initialSeekRef.current > 2) {
              event.target.seekTo(initialSeekRef.current, true);
              hasInitialSeekedRef.current = true;
            }
            onReadyRef.current?.();
          },
          onPlaybackRateChange: (event: YT.OnPlaybackRateChangeEvent) => {
            if (!mounted) return;
            const player = playerRef.current;
            if (player) {
              const current = Math.floor(player.getCurrentTime?.() ?? 0);
              onRateChangeRef.current?.(event.data, current);
            }
          },
          onStateChange: (event: YT.OnStateChangeEvent) => {
            if (!mounted) return;
            const { PLAYING, PAUSED, ENDED } = window.YT.PlayerState;
            const player = playerRef.current;
            const current = player ? Math.floor(player.getCurrentTime?.() ?? 0) : 0;
            const rate = player ? (player.getPlaybackRate?.() ?? 1) : 1;

            if (event.data === PLAYING) {
              startInterval();
              onPlayRef.current?.(rate, current);
            } else if (event.data === PAUSED || event.data === ENDED) {
              stopInterval();

              if (event.data === PAUSED) {
                onPauseRef.current?.(current);
              } else {
                onEndedRef.current?.(current);
              }

              // Immediately persist on pause/end
              if (player) {
                const duration = Math.floor(player.getDuration?.() ?? 0);
                if (duration > 0) {
                  lastReportedRef.current = current;
                  onProgressRef.current(current, duration);
                }
              }
            }
          },
        },
      });
    }

    loadYTScript(createPlayer);

    return () => {
      mounted = false;
      stopInterval();
      registerPlayer(null);
      try {
        playerRef.current?.destroy();
      } catch {
        // Player may already be gone on fast unmount
      }
      playerRef.current = null;
    };
    // Player recreates only when videoId changes (intentional: initialProgressSeconds
    // is persisted in a ref and applied via seekTo on onReady instead)
  }, [videoId, startInterval, stopInterval, registerPlayer]);

  return (
    <div className="w-full aspect-video bg-[#25343F] rounded-2xl overflow-hidden shadow-medium border border-[#BFC9D1]/15">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

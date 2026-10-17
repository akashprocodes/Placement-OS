import { useEffect, useRef, useCallback } from "react";
import { sendLearningSessionHeartbeat } from "../services/learningService";

interface SessionTrackerConfig {
  contentId: string;
  contentType: "video" | "playlist";
  isAuthenticated: boolean;
}

export function useLearningSessionTracker({
  contentId,
  contentType,
  isAuthenticated
}: SessionTrackerConfig) {
  
  const sessionIdRef = useRef<string>("");
  const sequenceRef = useRef<number>(0);
  
  // Timing references
  const lastTickTimeRef = useRef<number>(0);
  const currentRateRef = useRef<number>(1.0);
  const isPlayingRef = useRef<boolean>(false);
  const lastPositionRef = useRef<number>(0);

  // Accumulators since last heartbeat
  const accumWallClockRef = useRef<number>(0);
  const accumContentTimeRef = useRef<number>(0);

  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize session ID once if authenticated
  useEffect(() => {
    if (isAuthenticated && !sessionIdRef.current) {
      sessionIdRef.current = crypto.randomUUID();
    }
  }, [isAuthenticated]);

  const flushHeartbeat = useCallback(async (status: "active" | "paused" | "ended") => {
    if (!isAuthenticated || !sessionIdRef.current) return;
    
    // Process any lingering un-accumulated time
    if (isPlayingRef.current && lastTickTimeRef.current > 0) {
      const now = Date.now();
      const elapsedMs = now - lastTickTimeRef.current;
      // Clamp background tab sleep/inactivity to max 30s per interval to prevent sleep-drift
      const boundedElapsedMs = Math.min(Math.max(0, elapsedMs), 30000);
      accumWallClockRef.current += boundedElapsedMs / 1000;
      accumContentTimeRef.current += (boundedElapsedMs / 1000) * currentRateRef.current;
      lastTickTimeRef.current = now;
    }

    // Bound single heartbeat values within backend limit (backend max is 300s)
    const wallClock = Math.min(Math.round(accumWallClockRef.current), 240);
    const playedContent = Math.min(Math.round(accumContentTimeRef.current), Math.round(wallClock * currentRateRef.current));
    
    // Only send if there's actual activity OR if status changed to paused/ended (to close out)
    if (wallClock > 0 || status !== "active") {
      sequenceRef.current += 1;
      const seq = sequenceRef.current;
      const rate = currentRateRef.current;
      const pos = Math.round(lastPositionRef.current);
      
      // Reset accumulators immediately to allow concurrent accumulation
      accumWallClockRef.current = 0;
      accumContentTimeRef.current = 0;
      
      try {
        await sendLearningSessionHeartbeat(
          sessionIdRef.current,
          contentId,
          contentType,
          seq,
          pos,
          rate,
          playedContent,
          wallClock,
          status,
          new Date().toISOString()
        );
        // Notify other components that learning progress was recorded
        window.dispatchEvent(new CustomEvent("learning-progress-updated"));
      } catch (err) {
        // Silently swallow network errors so video playback isn't interrupted
        console.warn("Heartbeat failed, bounding retried time", err);
        // Add back bounded pending time (capped so it never accumulates beyond 60s)
        accumWallClockRef.current = Math.min(accumWallClockRef.current + wallClock, 60);
        accumContentTimeRef.current = Math.min(accumContentTimeRef.current + playedContent, 60 * rate);
      }
    }
  }, [contentId, contentType, isAuthenticated]);

  const handlePlay = useCallback((rate: number, position: number) => {
    if (isPlayingRef.current) {
        // If already playing, maybe rate changed
        if (currentRateRef.current !== rate) {
            flushHeartbeat("active");
            currentRateRef.current = rate;
        }
    } else {
        isPlayingRef.current = true;
        currentRateRef.current = rate;
        lastPositionRef.current = position;
        lastTickTimeRef.current = Date.now();
    }
  }, [flushHeartbeat]);

  const handlePause = useCallback((position: number) => {
    lastPositionRef.current = position;
    if (isPlayingRef.current) {
      flushHeartbeat("paused");
      isPlayingRef.current = false;
      lastTickTimeRef.current = 0;
    }
  }, [flushHeartbeat]);

  const handleEnded = useCallback((position: number) => {
    lastPositionRef.current = position;
    if (isPlayingRef.current) {
      flushHeartbeat("ended");
      isPlayingRef.current = false;
      lastTickTimeRef.current = 0;
    }
  }, [flushHeartbeat]);

  const handleRateChange = useCallback((newRate: number, position: number) => {
    lastPositionRef.current = position;
    if (isPlayingRef.current && currentRateRef.current !== newRate) {
      // Flush before applying new rate
      flushHeartbeat("active");
      currentRateRef.current = newRate;
    }
  }, [flushHeartbeat]);
  
  const handleTick = useCallback((position: number) => {
    // Normal progress tick (player position update)
    // We rely purely on Date.now() elapsed time instead of position deltas
    // so seeking doesn't create artificial credit.
    lastPositionRef.current = position;
  }, []);

  // Set up periodic heartbeat loop while mounted
  useEffect(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      if (isPlayingRef.current) {
        flushHeartbeat("active");
      }
    }, 10000); // 10 seconds

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      // On unmount, try to send a final paused heartbeat if we were playing
      if (isPlayingRef.current) {
          flushHeartbeat("paused");
      }
    };
  }, [flushHeartbeat]);

  return {
    handlePlay,
    handlePause,
    handleEnded,
    handleRateChange,
    handleTick
  };
}

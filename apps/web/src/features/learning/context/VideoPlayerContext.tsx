"use client";

import React, { createContext, useContext, useRef, useState, useCallback, ReactNode } from "react";

export interface YouTubePlayerHandle {
  getCurrentTime: () => number;
  seekTo: (seconds: number) => void;
  getDuration: () => number;
}

interface VideoPlayerContextType {
  registerPlayer: (handle: YouTubePlayerHandle | null) => void;
  getCurrentTime: () => number;
  seekTo: (seconds: number) => void;
  getDuration: () => number;
  isReady: boolean;
}

const VideoPlayerContext = createContext<VideoPlayerContextType | null>(null);

export function VideoPlayerProvider({ children }: { children: ReactNode }) {
  const handleRef = useRef<YouTubePlayerHandle | null>(null);
  const [isReady, setIsReady] = useState(false);

  const registerPlayer = useCallback((handle: YouTubePlayerHandle | null) => {
    handleRef.current = handle;
    setIsReady(handle !== null);
  }, []);

  const getCurrentTime = useCallback(() => {
    return handleRef.current ? handleRef.current.getCurrentTime() : 0;
  }, []);

  const seekTo = useCallback((seconds: number) => {
    if (handleRef.current) {
      handleRef.current.seekTo(seconds);
    }
  }, []);

  const getDuration = useCallback(() => {
    return handleRef.current ? handleRef.current.getDuration() : 0;
  }, []);

  return (
    <VideoPlayerContext.Provider
      value={{
        registerPlayer,
        getCurrentTime,
        seekTo,
        getDuration,
        isReady,
      }}
    >
      {children}
    </VideoPlayerContext.Provider>
  );
}

export function useVideoPlayer(): VideoPlayerContextType {
  const context = useContext(VideoPlayerContext);
  if (!context) {
    return {
      registerPlayer: () => {},
      getCurrentTime: () => 0,
      seekTo: () => {},
      getDuration: () => 0,
      isReady: false,
    };
  }
  return context;
}


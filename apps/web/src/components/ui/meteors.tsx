"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface MeteorsProps {
  number?: number;
  minDelay?: number;
  maxDelay?: number;
  minDuration?: number;
  maxDuration?: number;
  angle?: number;
  className?: string;
}

interface MeteorStyle extends React.CSSProperties {
  "--angle"?: string;
}

interface MeteorItem {
  style: MeteorStyle;
  tailLength: number;
}

// Generate initial deterministic values to prevent hydration flash
const generateInitialMeteors = (count: number, angle: number): Array<MeteorItem> => {
  return Array.from({ length: count }).map((_, i) => {
    const tailLength = 54 + ((i * 11) % 28); // 54px - 81px
    const duration = 3.6 + ((i * 1.3) % 3.2); // 3.6s - 6.8s
    const delay = -(((i * 1.5) % duration)).toFixed(2); // negative delay so meteors are already in-flight
    return {
      style: {
        "--angle": `${angle}deg`,
        top: `${((i * 53) % 950) - 100}px`,
        left: `${((i * 97) % 1550) - 50}px`,
        animationDelay: `${delay}s`,
        animationDuration: `${duration.toFixed(2)}s`,
      },
      tailLength,
    };
  });
};

export const Meteors: React.FC<MeteorsProps> = ({
  number = 32,
  minDelay = 0.2,
  maxDelay = 4.0,
  minDuration = 3.4,
  maxDuration = 6.4,
  angle = 290, // Steep 70° downward rain slope matching reference design
  className,
}) => {
  const [meteors, setMeteors] = useState<Array<MeteorItem>>(() =>
    generateInitialMeteors(number, angle)
  );

  useEffect(() => {
    const width = typeof window !== "undefined" ? window.innerWidth : 1440;
    const height = typeof window !== "undefined" ? window.innerHeight : 900;

    const items: Array<MeteorItem> = Array.from({ length: number }).map(() => {
      const tailLength = Math.floor(Math.random() * 26 + 54); // 54px - 80px (matching ~60-70px in reference)
      const duration = Math.random() * (maxDuration - minDuration) + minDuration;
      // Stagger with negative delays so screen has active meteors immediately
      const delay = -(Math.random() * duration).toFixed(2);

      return {
        style: {
          "--angle": `${angle}deg`,
          top: `${Math.floor(Math.random() * (height + 200) - 120)}px`,
          left: `${Math.floor(Math.random() * (width + 350) - 80)}px`,
          animationDelay: `${delay}s`,
          animationDuration: `${duration.toFixed(2)}s`,
        },
        tailLength,
      };
    });

    const rafId = requestAnimationFrame(() => {
      setMeteors(items);
    });

    return () => cancelAnimationFrame(rafId);
  }, [number, minDelay, maxDelay, minDuration, maxDuration, angle]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0 select-none">
      {meteors.map((m, idx) => (
        <span
          key={idx}
          style={m.style}
          className={cn(
            "pointer-events-none absolute size-[2px] rounded-full bg-zinc-800 dark:bg-zinc-200 shadow-[0_0_0_1px_rgba(0,0,0,0.06)] animate-meteor",
            className
          )}
        >
          {/* Authentic monochrome hairline tail extending back along trajectory */}
          <div
            style={{
              width: `${m.tailLength}px`,
            }}
            className="pointer-events-none absolute top-1/2 -z-10 h-px -translate-y-1/2 bg-gradient-to-r from-zinc-800/85 via-zinc-600/40 to-transparent dark:from-zinc-200/85 dark:via-zinc-400/40"
          />
        </span>
      ))}
    </div>
  );
};

export default Meteors;

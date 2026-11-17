"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface OrbitRingConfig {
  diameter: number;
  duration: number;
  reverse: boolean;
  dashed: boolean;
  borderClass: string;
  dotClass: string;
}

interface OrbitMarkProps {
  /** Outer diameter in pixels. */
  size?: number;
  className?: string;
}

/**
 * Decorative orbit motif: concentric rings rotating around a glowing core.
 * Pure CSS visual built with divs and framer-motion. Respects
 * prefers-reduced-motion by rendering a static composition.
 */
export function OrbitMark({ size = 272, className }: OrbitMarkProps) {
  const reduceMotion = useReducedMotion();

  const rings: OrbitRingConfig[] = [
    {
      diameter: size,
      duration: 26,
      reverse: false,
      dashed: false,
      borderClass: "border-primary/25",
      dotClass: "size-3 bg-primary",
    },
    {
      diameter: Math.round(size * 0.7),
      duration: 18,
      reverse: true,
      dashed: true,
      borderClass: "border-primary/40",
      dotClass: "size-2.5 bg-primary",
    },
    {
      diameter: Math.round(size * 0.42),
      duration: 12,
      reverse: false,
      dashed: false,
      borderClass: "border-primary/60",
      dotClass: "size-2 bg-primary",
    },
  ];

  return (
    <div
      aria-hidden
      className={cn("relative select-none", className)}
      style={{ width: size, height: size }}
    >
      {rings.map((ring) => (
        <motion.div
          key={ring.diameter}
          className={cn(
            "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border",
            ring.dashed && "border-dashed",
            ring.borderClass
          )}
          style={{ width: ring.diameter, height: ring.diameter }}
          animate={reduceMotion ? undefined : { rotate: ring.reverse ? -360 : 360 }}
          transition={{ duration: ring.duration, repeat: Infinity, ease: "linear" }}
        >
          <span
            className={cn(
              "absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full",
              ring.dotClass
            )}
          />
        </motion.div>
      ))}
      <motion.span
        className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_36px_-4px_var(--primary)] ring-4 ring-primary/20"
        animate={reduceMotion ? undefined : { scale: [1, 1.08, 1] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

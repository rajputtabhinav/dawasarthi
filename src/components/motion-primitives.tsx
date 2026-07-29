"use client";

import {
  AnimatePresence,
  MotionConfig,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

const easing = [0.22, 1, 0.36, 1] as const;
const spring = { type: "spring", stiffness: 300, damping: 24 } as const;

type MotionChildrenProps = {
  children: ReactNode;
  className?: string;
};

// ── Provider ────────────────────────────────────────────────────────────────

export function MotionProvider({ children }: { children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <MotionConfig
      reducedMotion={prefersReducedMotion ? "always" : "user"}
      transition={{ duration: prefersReducedMotion ? 0.01 : 0.5, ease: easing }}
    >
      {children}
    </MotionConfig>
  );
}

// ── Fade + slide up on scroll ────────────────────────────────────────────────

export function MotionSection({ children, className = "" }: MotionChildrenProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 32 }}
      whileInView={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, ease: easing }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Stagger container ────────────────────────────────────────────────────────

export function MotionStagger({ children, className = "" }: MotionChildrenProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : "hidden"}
      whileInView={prefersReducedMotion ? undefined : "show"}
      viewport={{ once: true, amount: 0.12 }}
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: prefersReducedMotion ? 0 : 0.07,
            delayChildren: prefersReducedMotion ? 0 : 0.05,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Stagger child ────────────────────────────────────────────────────────────

export function MotionItem({ children, className = "" }: MotionChildrenProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      variants={{
        hidden: prefersReducedMotion ? {} : { opacity: 0, y: 22, scale: 0.97 },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.45, ease: easing },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Hover lift + tap ─────────────────────────────────────────────────────────

export function MotionHover({ children, className = "" }: MotionChildrenProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { y: -4, scale: 1.02 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.2, ease: easing }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Header intro (slide down) ────────────────────────────────────────────────

export function MotionHeaderIntro({ children, className = "" }: MotionChildrenProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: -18 }}
      animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: easing }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Fade swap (for checkout success/form toggle) ─────────────────────────────

export function MotionFadeSwap({
  children,
  className = "",
  motionKey,
}: MotionChildrenProps & { motionKey: string }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={motionKey}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? undefined : { opacity: 0, y: -12 }}
        transition={{ duration: 0.35, ease: easing }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// ── Slide in from left ───────────────────────────────────────────────────────

export function MotionSlideLeft({ children, className = "" }: MotionChildrenProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, x: -40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: easing }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Slide in from right ──────────────────────────────────────────────────────

export function MotionSlideRight({ children, className = "" }: MotionChildrenProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, x: 40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: easing }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Pop in (scale bounce) ────────────────────────────────────────────────────

export function MotionPop({ children, className = "" }: MotionChildrenProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.7 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={prefersReducedMotion ? { duration: 0.01 } : spring}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Animated number counter ──────────────────────────────────────────────────

export function MotionCounter({
  target,
  suffix = "",
  prefix = "",
  className = "",
  duration = 1.8,
}: {
  target: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const prefersReducedMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    duration: prefersReducedMotion ? 0 : duration * 1000,
    bounce: 0,
  });
  const rounded = useTransform(springValue, (v) => Math.round(v));

  useEffect(() => {
    if (isInView) motionValue.set(target);
  }, [isInView, motionValue, target]);

  useEffect(() => {
    return rounded.on("change", (v) => {
      if (ref.current) {
        ref.current.textContent = `${prefix}${v.toLocaleString("en-IN")}${suffix}`;
      }
    });
  }, [rounded, prefix, suffix]);

  return (
    <span ref={ref} className={className}>
      {prefix}0{suffix}
    </span>
  );
}

// ── Animated progress bar ────────────────────────────────────────────────────

export function MotionBar({
  pct,
  className = "",
  delay = 0,
}: {
  pct: number;
  className?: string;
  delay?: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ width: 0 }}
      whileInView={{ width: `${pct}%` }}
      viewport={{ once: true, amount: 0.5 }}
      transition={
        prefersReducedMotion
          ? { duration: 0.01 }
          : { duration: 1, ease: easing, delay }
      }
      className={className}
    />
  );
}

// ── Floating animation (gentle up-down loop) ─────────────────────────────────

export function MotionFloat({ children, className = "" }: MotionChildrenProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      animate={
        prefersReducedMotion
          ? undefined
          : { y: [0, -8, 0], transition: { duration: 3, repeat: Infinity, ease: "easeInOut" } }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Pulse badge ──────────────────────────────────────────────────────────────

export function MotionPulse({ children, className = "" }: MotionChildrenProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      animate={
        prefersReducedMotion
          ? undefined
          : { scale: [1, 1.06, 1], transition: { duration: 2, repeat: Infinity, ease: "easeInOut" } }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Page transition wrapper ──────────────────────────────────────────────────

export function MotionPage({ children, className = "" }: MotionChildrenProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easing }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Card hover glow ──────────────────────────────────────────────────────────

export function MotionCard({ children, className = "" }: MotionChildrenProps) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      whileHover={prefersReducedMotion ? undefined : { y: -6, scale: 1.015, transition: { duration: 0.2 } }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.45, ease: easing }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export { AnimatePresence, motion };

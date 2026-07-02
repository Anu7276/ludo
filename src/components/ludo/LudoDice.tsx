'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LudoDiceProps {
  value: number | null;
  rolling: boolean;
  onRoll: () => void;
  disabled: boolean;
  currentColor: string | null;
}

/* ── colour map ─────────────────────────────────────────────── */
const COLOR_MAP: Record<string, string> = {
  red: '#EF4444',
  green: '#22C55E',
  yellow: '#EAB308',
  blue: '#3B82F6',
};

/* ── dot positions (percentage-based) ───────────────────────── */
const DICE_DOTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[72, 28], [28, 72]],
  3: [[72, 28], [50, 50], [28, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
};

/* ── settle bounce keyframes (per-property arrays) ───────────── */
const SETTLE_ANIMATION = {
  rotateX: [20, -10, 5, 0],
  rotateY: [-15, 8, -3, 0],
  scale: [1.08, 0.97, 1.02, 1],
};

/* ── Shake icon SVG (shown while rolling) ───────────────────── */
function ShakeIcon() {
  return (
    <motion.svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      animate={{
        x: [0, -3, 3, -2, 2, 0],
        rotate: [0, -10, 10, -6, 6, 0],
      }}
      transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
      style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 5 }}
    >
      <path d="M3 12h4l3-9 4 18 3-9h4" />
    </motion.svg>
  );
}

/* ── Single dot ─────────────────────────────────────────────── */
function DiceDot({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <div
      className="absolute rounded-full"
      style={{
        width: '18%',
        height: '18%',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        background: `radial-gradient(circle at 35% 35%, ${color}11, ${color})`,
        boxShadow: `
          inset 0 2px 4px rgba(0,0,0,0.45),
          inset 0 -1px 1px rgba(255,255,255,0.15),
          0 1px 2px rgba(0,0,0,0.2)
        `,
      }}
    />
  );
}

/* ═════════════════════════════════════════════════════════════ */
export default function LudoDice({
  value,
  rolling,
  onRoll,
  disabled,
  currentColor,
}: LudoDiceProps) {
  const [localRolling, setLocalRolling] = useState(false);
  const [settling, setSettling] = useState(false);
  const [displayValue, setDisplayValue] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const borderColor = currentColor ? COLOR_MAP[currentColor] || '#6B7280' : '#6B7280';
  const dotColor = '#1a1a2e';
  const isActive = !disabled && !rolling && !localRolling && !settling;

  /* ── rolling face randomiser ──────────────────────────────── */
  useEffect(() => {
    if (rolling && !localRolling) {
      setLocalRolling(true);
      setSettling(false);
      let tick = 0;
      intervalRef.current = setInterval(() => {
        tick++;
        setDisplayValue(Math.floor(Math.random() * 6) + 1);
        if (tick > 14) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setLocalRolling(false);
          setDisplayValue(value ?? 1);
          setSettling(true);
        }
      }, 70);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    }, [rolling]);

  /* ── clear settle after bounce ────────────────────────────── */
  useEffect(() => {
    if (settling) {
      const t = setTimeout(() => setSettling(false), 500);
      return () => clearTimeout(t);
    }
  }, [settling]);

  /* ── derive shown value ───────────────────────────────────── */
  const shownValue = localRolling ? (displayValue ?? 1) : (value ?? displayValue);
  const dots = shownValue ? DICE_DOTS[shownValue] || [] : [];

  /* ── click handler ────────────────────────────────────────── */
  const handleRoll = useCallback(() => {
    if (disabled || rolling || localRolling || settling) return;
    onRoll();
  }, [disabled, rolling, localRolling, settling, onRoll]);

  /* ── determine animation variant ──────────────────────────── */
  const isRolling = rolling || localRolling;

  return (
    <div className="flex flex-col items-center gap-2.5 select-none">
      {/* ── dice body ───────────────────────────────────────── */}
      <motion.button
        onClick={handleRoll}
        disabled={disabled || isRolling}
        className="relative outline-none"
        style={{ perspective: 600 }}
        aria-label="Roll dice"
      >
        <motion.div
          className="relative w-14 h-14 sm:w-[88px] sm:h-[88px] lg:w-22 lg:h-22 rounded-2xl overflow-hidden"
          style={{
            transformStyle: 'preserve-3d',
            /* cream-white background with top-left lighting gradient */
            background: `
              linear-gradient(
                135deg,
                #fffdf7 0%,
                #f5f0e8 40%,
                #ece5d8 100%
              )
            `,
            /* thick coloured border */
            border: `3px solid ${isActive ? borderColor : '#9CA3AF'}`,
            /* glow when active */
            boxShadow: isActive
              ? `
                0 10px 30px rgba(0,0,0,0.18),
                0 2px 6px rgba(0,0,0,0.10),
                inset 0 1px 0 rgba(255,255,255,0.8),
                0 0 24px ${borderColor}50,
                0 0 48px ${borderColor}20
              `
              : disabled
                ? '0 2px 6px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.4)'
                : `
                  0 6px 18px rgba(0,0,0,0.14),
                  0 1px 4px rgba(0,0,0,0.08),
                  inset 0 1px 0 rgba(255,255,255,0.7)
                `,
            cursor: isActive ? 'pointer' : 'default',
          }}
          /* ── animations ────────────────────────────────────── */
          animate={(() => {
            if (isRolling) {
              return { rotateX: 360, rotateY: 480, scale: 1.05 } as const;
            }
            if (settling) {
              return SETTLE_ANIMATION;
            }
            if (isActive) {
              return {
                boxShadow: [
                  `0 10px 30px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.8), 0 0 24px ${borderColor}50, 0 0 48px ${borderColor}20`,
                  `0 10px 30px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.8), 0 0 36px ${borderColor}70, 0 0 64px ${borderColor}35`,
                  `0 10px 30px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.8), 0 0 24px ${borderColor}50, 0 0 48px ${borderColor}20`,
                ],
              } as const;
            }
            return {};
          })()}
          transition={(() => {
            if (isRolling) {
              return {
                rotateX: { duration: 0.5, repeat: Infinity, ease: 'linear' },
                rotateY: { duration: 0.7, repeat: Infinity, ease: 'linear' },
              };
            }
            if (settling) {
              return { duration: 0.5, ease: 'easeOut' as const };
            }
            if (isActive) {
              return {
                boxShadow: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' as const },
              };
            }
            return {};
          })()}
          whileHover={isActive ? { scale: 1.06 } : undefined}
          whileTap={isActive ? { scale: 0.94 } : undefined}
        >
          {/* ── rolling 3D tumble overlay ──────────────────── */}
          <AnimatePresence>
            {isRolling && (
              <motion.div
                key="tumble-overlay"
                className="absolute inset-0 rounded-2xl"
                style={{
                  transformStyle: 'preserve-3d',
                  background: `linear-gradient(135deg, #fffdf7 0%, #f5f0e8 40%, #ece5d8 100%)`,
                  zIndex: 10,
                }}
                initial={{ opacity: 0 }}
                animate={{
                  opacity: 1,
                  rotateX: [0, 90, 180, 270, 360],
                  rotateY: [0, 120, 240, 360, 480],
                }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
              >
                {/* dots inside tumble overlay */}
                <div className="relative w-full h-full p-[10%]">
                  {dots.map(([x, y], i) => (
                    <DiceDot key={i} x={x} y={y} color={dotColor} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── main face (static / settled) ───────────────── */}
          <div className="relative w-full h-full p-[10%]">
            {dots.map(([x, y], i) => (
              <DiceDot key={i} x={x} y={y} color={dotColor} />
            ))}
          </div>

          {/* ── empty / no-value state ──────────────────────── */}
          {!value && !isRolling && !settling && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-gray-400 font-bold text-2xl">?</span>
            </div>
          )}
        </motion.div>
      </motion.button>

      {/* ── label ───────────────────────────────────────────── */}
      <div
        className="flex items-center text-[11px] sm:text-xs font-bold uppercase tracking-widest"
        style={{ color: disabled ? '#9CA3AF' : borderColor }}
      >
        {isRolling ? (
          <>
            <ShakeIcon />
            Rolling...
          </>
        ) : disabled ? (
          'Waiting...'
        ) : (
          'Roll Dice'
        )}
      </div>
    </div>
  );
}
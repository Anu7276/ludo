'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';

interface LudoDiceProps {
  value: number | null;
  rolling: boolean;
  onRoll: () => void;
  disabled: boolean;
  currentColor: string | null;
}

const DICE_DOTS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
};

const COLOR_MAP: Record<string, string> = {
  red: '#EF4444',
  green: '#22C55E',
  yellow: '#EAB308',
  blue: '#3B82F6',
};

export default function LudoDice({ value, rolling, onRoll, disabled, currentColor }: LudoDiceProps) {
  const [animating, setAnimating] = useState(false);

  const handleRoll = useCallback(() => {
    if (disabled || rolling || animating) return;
    setAnimating(true);
    onRoll();
    setTimeout(() => setAnimating(false), 600);
  }, [disabled, rolling, animating, onRoll]);

  const borderColor = currentColor ? COLOR_MAP[currentColor] || '#6B7280' : '#6B7280';
  const displayValue = rolling || animating ? Math.floor(Math.random() * 6) + 1 : value;
  const dots = displayValue ? DICE_DOTS[displayValue] || [] : [];

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.button
        onClick={handleRoll}
        disabled={disabled || rolling || animating}
        className={`
          relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl shadow-xl
          flex items-center justify-center
          transition-colors duration-200
          ${disabled || rolling || animating
            ? 'bg-gray-200 cursor-not-allowed'
            : 'bg-white cursor-pointer hover:shadow-2xl active:scale-95'
          }
        `}
        style={{
          border: `3px solid ${borderColor}`,
          boxShadow: disabled
            ? '0 4px 6px rgba(0,0,0,0.1)'
            : `0 8px 25px rgba(0,0,0,0.15), 0 0 20px ${borderColor}30`,
        }}
        animate={
          rolling || animating
            ? {
                rotate: [0, 15, -15, 10, -10, 5, -5, 0],
                scale: [1, 1.1, 1.05, 1.1, 1],
              }
            : {}
        }
        transition={{
          duration: 0.6,
          ease: 'easeInOut',
        }}
        whileTap={!disabled && !rolling && !animating ? { scale: 0.92 } : undefined}
      >
        {/* Dice face background */}
        <div className="absolute inset-1.5 rounded-xl bg-white" />

        {/* Dots */}
        <div className="relative w-full h-full p-2 sm:p-3">
          {dots.map(([x, y], i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: '#1F2937',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
              }}
              animate={
                rolling || animating
                  ? { opacity: [1, 0.3, 1] }
                  : { opacity: 1 }
              }
              transition={{
                duration: 0.15,
                repeat: Infinity,
                delay: i * 0.03,
              }}
            />
          ))}
        </div>

        {/* No value state */}
        {!value && !rolling && !animating && (
          <span className="text-gray-400 font-bold text-lg select-none">?</span>
        )}
      </motion.button>

      {/* Label */}
      <span
        className="text-xs font-semibold uppercase tracking-wider select-none"
        style={{ color: borderColor }}
      >
        {disabled ? 'Waiting...' : rolling || animating ? 'Rolling...' : 'Roll Dice'}
      </span>
    </div>
  );
}
'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  PlayerColor,
  PLAYER_COLOR_HEX,
  PLAYER_COLOR_LIGHT,
  PLAYER_COLOR_DARK,
} from '@/lib/ludo/types';
import type { SerializedGameState } from '@/stores/ludo-store';
import {
  MAIN_PATH,
  HOME_COLUMNS,
  PLAYER_START_INDEX,
  getPiecePosition,
} from '@/lib/ludo/board';

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────

interface LudoBoardProps {
  gameState: SerializedGameState | null;
  validMoves: number[];
  onPieceClick: (color: PlayerColor, pieceIndex: number) => void;
  myColor: PlayerColor | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE-LEVEL LOOKUP TABLES (built once, never change)
// ─────────────────────────────────────────────────────────────────────────────

/** Set of "row,col" strings for every main-path cell. */
const MAIN_PATH_SET = new Set(MAIN_PATH.map(([r, c]) => `${r},${c}`));

/** Map from "row,col" → { color, index } for home-column cells. */
const HOME_COL_MAP = new Map<string, { color: PlayerColor; index: number }>();
for (const color of ['red', 'green', 'yellow', 'blue'] as PlayerColor[]) {
  HOME_COLUMNS[color].forEach(([r, c], index) => {
    HOME_COL_MAP.set(`${r},${c}`, { color, index });
  });
}

/** Map from "row,col" → PlayerColor for start positions. */
const START_MAP = new Map<string, PlayerColor>();
for (const color of ['red', 'green', 'yellow', 'blue'] as PlayerColor[]) {
  const [r, c] = MAIN_PATH[PLAYER_START_INDEX[color]];
  START_MAP.set(`${r},${c}`, color);
}

/** Map from "row,col" → PlayerColor for star safe-zone cells (non-start). */
const STAR_MAP = new Map<string, PlayerColor>();
const STAR_PATH_INDICES = [8, 21, 34, 47];
const STAR_PLAYER_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
for (let i = 0; i < STAR_PATH_INDICES.length; i++) {
  const [r, c] = MAIN_PATH[STAR_PATH_INDICES[i]];
  STAR_MAP.set(`${r},${c}`, STAR_PLAYER_COLORS[i]);
}

/** Map from "row,col" → PlayerColor for home-column entry cells. */
const ENTRY_MAP = new Map<string, PlayerColor>([
  ['7,6', 'red'],
  ['6,7', 'green'],
  ['7,8', 'yellow'],
  ['8,7', 'blue'],
]);

/** Grid cells that hold a home-base circle (where pieces sit in "home" state). */
const HOME_CIRCLE_CELLS: Record<PlayerColor, [number, number][]> = {
  red: [[1, 1], [1, 4], [4, 1], [4, 4]],
  green: [[1, 10], [1, 13], [4, 10], [4, 13]],
  yellow: [[10, 10], [10, 13], [13, 10], [13, 13]],
  blue: [[10, 1], [10, 4], [13, 1], [13, 4]],
};
const HOME_CIRCLE_SET = new Set<string>();
for (const color of ['red', 'green', 'yellow', 'blue'] as PlayerColor[]) {
  for (const [r, c] of HOME_CIRCLE_CELLS[color]) {
    HOME_CIRCLE_SET.add(`${r},${c}`);
  }
}

/** Map from "row,col" → PlayerColor for the four 6×6 home-base areas. */
const HOME_BASE_MAP = new Map<string, PlayerColor>();
for (let r = 0; r <= 5; r++)
  for (let c = 0; c <= 5; c++) HOME_BASE_MAP.set(`${r},${c}`, 'red');
for (let r = 0; r <= 5; r++)
  for (let c = 9; c <= 14; c++) HOME_BASE_MAP.set(`${r},${c}`, 'green');
for (let r = 9; r <= 14; r++)
  for (let c = 9; c <= 14; c++) HOME_BASE_MAP.set(`${r},${c}`, 'yellow');
for (let r = 9; r <= 14; r++)
  for (let c = 0; c <= 5; c++) HOME_BASE_MAP.set(`${r},${c}`, 'blue');

/** The four "cross-inner" cells in the 3×3 center that aren't center/entry. */
const CROSS_INNER_SET = new Set(['6,6', '6,8', '8,6', '8,8']);

/** Small pixel offsets to separate stacked pieces. */
const STACK_OFFSETS = [
  { x: -5, y: -5 },
  { x: 5, y: -5 },
  { x: -5, y: 5 },
  { x: 5, y: 5 },
  { x: 0, y: -6 },
  { x: 0, y: 6 },
  { x: -6, y: 0 },
  { x: 6, y: 0 },
];

/** Direction of initial movement for each player's arrow. */
const ARROW_DIRECTION: Record<PlayerColor, number> = {
  red: 0,   // →
  green: 90, // ↓
  yellow: 180, // ←
  blue: 270,  // ↑
};

/** Home base arrow overlay positions (top%, left% in the board). */
const HOME_ARROW_POS: Record<PlayerColor, { top: number; left: number }> = {
  red:    { top: 13.3, left: 13.3 },
  green:  { top: 13.3, left: 73.3 },
  yellow: { top: 73.3, left: 73.3 },
  blue:   { top: 73.3, left: 13.3 },
};

// ─────────────────────────────────────────────────────────────────────────────
// SVG ICON COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Five-pointed star for safe zones. */
function StarIcon({ color }: { color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-[72%] h-[72%]"
      style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))' }}
    >
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={color}
        stroke="rgba(0,0,0,0.12)"
        strokeWidth="0.5"
      />
    </svg>
  );
}

/** Chevron/arrow pointing in the direction of movement for start cells. */
function StartArrow({ rotation }: { rotation: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-[65%] h-[65%]"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path
        d="M8 5l8 7-8 7"
        fill="none"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Triangle arrow for home bases pointing toward start position. */
function HomeBaseArrow({ color }: { color: PlayerColor }) {
  const hex = PLAYER_COLOR_HEX[color];
  const rot = ARROW_DIRECTION[color];
  return (
    <svg
      viewBox="0 0 40 40"
      style={{
        width: '100%',
        height: '100%',
        transform: `rotate(${rot}deg)`,
        filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.15))`,
      }}
    >
      <path
        d="M4 14 L20 6 L20 14 L36 14 L36 26 L20 26 L20 34 L4 26 Z"
        fill={hex}
        opacity="0.35"
      />
    </svg>
  );
}

/** Trophy icon for the center HOME cell. */
function TrophyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-[45%] h-[45%]"
      style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))' }}
    >
      <path
        d="M5 3h14v1.5C19 8 16.5 11 13 11.75V14h1.5a2 2 0 012 2v2h-2v2H9.5v-2h-2v-2a2 2 0 012-2H11v-2.25C7.5 11 5 8 5 4.5V3zm2.5 2v.5c0 2.2 1.2 4.1 3 4.65V5H7.5zm6 0v5.15c1.8-.55 3-2.45 3-4.65V5h-3z"
        fill="white"
        opacity="0.95"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CELL CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

type CellInfo =
  | { kind: 'homeBase'; color: PlayerColor; zone: 'border' | 'inner' | 'circle' }
  | { kind: 'path' }
  | { kind: 'start'; color: PlayerColor }
  | { kind: 'star'; color: PlayerColor }
  | { kind: 'homeColumn'; color: PlayerColor; index: number; total: number }
  | { kind: 'entry'; color: PlayerColor }
  | { kind: 'center' }
  | { kind: 'crossInner' };

function classifyCell(row: number, col: number): CellInfo {
  const k = `${row},${col}`;

  if (row === 7 && col === 7) return { kind: 'center' };
  if (ENTRY_MAP.has(k)) return { kind: 'entry', color: ENTRY_MAP.get(k)! };

  const hc = HOME_COL_MAP.get(k);
  if (hc) return { kind: 'homeColumn', color: hc.color, index: hc.index, total: 5 };

  if (START_MAP.has(k)) return { kind: 'start', color: START_MAP.get(k)! };

  if (MAIN_PATH_SET.has(k)) {
    const sc = STAR_MAP.get(k);
    return sc ? { kind: 'star', color: sc } : { kind: 'path' };
  }

  if (HOME_BASE_MAP.has(k)) {
    const color = HOME_BASE_MAP.get(k)!;
    // Compute relative position within the 6×6 area (0-5)
    let rr: number, rc: number;
    if (color === 'red')    { rr = row; rc = col; }
    else if (color === 'green')  { rr = row; rc = col - 9; }
    else if (color === 'yellow') { rr = row - 9; rc = col - 9; }
    else /* blue */               { rr = row - 9; rc = col; }

    const onBorder = rr === 0 || rr === 5 || rc === 0 || rc === 5;
    if (HOME_CIRCLE_SET.has(k)) return { kind: 'homeBase', color, zone: 'circle' };
    if (onBorder)                return { kind: 'homeBase', color, zone: 'border' };
    return { kind: 'homeBase', color, zone: 'inner' };
  }

  if (CROSS_INNER_SET.has(k)) return { kind: 'crossInner' };

  return { kind: 'path' };
}

// ─────────────────────────────────────────────────────────────────────────────
// STATIC CELL RENDERING  (memoised once)
// ─────────────────────────────────────────────────────────────────────────────

function buildCells(): React.ReactNode[] {
  const cells: React.ReactNode[] = [];

  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const info = classifyCell(r, c);
      const k = `${r},${c}`;
      let bg: string = '#ffffff';
      let extra: React.CSSProperties = {};
      let content: React.ReactNode = null;

      switch (info.kind) {
        /* ─── HOME BASE ──────────────────────────────────────────────── */
        case 'homeBase': {
          const hex = PLAYER_COLOR_HEX[info.color];
          const dark = PLAYER_COLOR_DARK[info.color];
          const light = PLAYER_COLOR_LIGHT[info.color];

          if (info.zone === 'border') {
            // Coloured outer ring → creates the "border" around the white interior
            bg = `linear-gradient(145deg, ${hex}, ${dark})`;
          } else if (info.zone === 'circle') {
            // Light tint behind the white sitting circle
            bg = light;
            content = (
              <div
                className="w-[80%] h-[80%] rounded-full shrink-0"
                style={{
                  background:
                    'radial-gradient(circle at 38% 32%, #ffffff, #f3f4f6)',
                  boxShadow:
                    '0 2px 6px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 3px rgba(0,0,0,0.06)',
                  border: `2px solid ${hex}50`,
                }}
              />
            );
          } else {
            // Inner white area (not a circle cell)
            bg = '#ffffff';
          }
          break;
        }

        /* ─── PATH ───────────────────────────────────────────────────── */
        case 'path':
          bg = '#ffffff';
          extra.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.05)';
          break;

        /* ─── START CELL ─────────────────────────────────────────────── */
        case 'start': {
          const hex = PLAYER_COLOR_HEX[info.color];
          const dark = PLAYER_COLOR_DARK[info.color];
          bg = `linear-gradient(135deg, ${hex}, ${dark})`;
          extra.boxShadow = 'inset 0 1px 4px rgba(0,0,0,0.2)';
          content = <StartArrow rotation={ARROW_DIRECTION[info.color]} />;
          break;
        }

        /* ─── STAR SAFE ZONE ─────────────────────────────────────────── */
        case 'star': {
          const hex = PLAYER_COLOR_HEX[info.color];
          const light = PLAYER_COLOR_LIGHT[info.color];
          bg = `linear-gradient(135deg, ${light}, #ffffff)`;
          extra.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.05)';
          content = <StarIcon color={hex} />;
          break;
        }

        /* ─── HOME COLUMN ────────────────────────────────────────────── */
        case 'homeColumn': {
          const hex = PLAYER_COLOR_HEX[info.color];
          const light = PLAYER_COLOR_LIGHT[info.color];
          // Gradient: more saturated far from centre, lighter near centre
          const t = info.index / (info.total - 1); // 0 = entry, 1 = near centre
          const satAlpha = Math.round(40 - t * 25).toString(16).padStart(2, '0');
          bg = `linear-gradient(135deg, ${hex}${satAlpha}, ${light})`;
          extra.borderLeft = `1px solid ${hex}25`;
          extra.borderRight = `1px solid ${hex}25`;
          extra.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.04)';
          break;
        }

        /* ─── HOME COLUMN ENTRY ──────────────────────────────────────── */
        case 'entry': {
          const hex = PLAYER_COLOR_HEX[info.color];
          const dark = PLAYER_COLOR_DARK[info.color];
          bg = `linear-gradient(135deg, ${hex}, ${dark})`;
          extra.boxShadow = 'inset 0 1px 4px rgba(0,0,0,0.2)';
          // Small triangle pointing toward home column direction
          const rot = ARROW_DIRECTION[info.color];
          content = (
            <svg
              viewBox="0 0 24 24"
              className="w-[55%] h-[55%]"
              style={{ transform: `rotate(${rot}deg)`, opacity: 0.7 }}
            >
              <path
                d="M6 9l6-5 6 5"
                fill="none"
                stroke="white"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          );
          break;
        }

        /* ─── CENTER / HOME ──────────────────────────────────────────── */
        case 'center':
          bg = '#ffffff';
          content = (
            <div
              className="w-[94%] h-[94%] rounded-full shrink-0 relative flex items-center justify-center"
              style={{
                background: `conic-gradient(
                  #DC2626 0deg 90deg,
                  #16A34A 90deg 180deg,
                  #CA8A04 180deg 270deg,
                  #2563EB 270deg 360deg
                )`,
                boxShadow:
                  '0 0 20px rgba(0,0,0,0.3), 0 0 40px rgba(0,0,0,0.1)',
              }}
            >
              {/* Inner ring */}
              <div
                className="absolute rounded-full flex items-center justify-center"
                style={{
                  width: '58%',
                  height: '58%',
                  background: `conic-gradient(
                    #EF4444 0deg 90deg,
                    #22C55E 90deg 180deg,
                    #EAB308 180deg 270deg,
                    #3B82F6 270deg 360deg
                  )`,
                  boxShadow: 'inset 0 0 8px rgba(0,0,0,0.15)',
                }}
              >
                {/* White centre disc */}
                <div
                  className="w-[52%] h-[52%] rounded-full flex items-center justify-center"
                  style={{
                    background: 'radial-gradient(circle at 40% 35%, #ffffff, #f1f5f9)',
                    boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.1)',
                  }}
                >
                  <TrophyIcon />
                </div>
              </div>
            </div>
          );
          break;

        /* ─── CROSS INNER ────────────────────────────────────────────── */
        case 'crossInner':
          bg = '#ffffff';
          extra.boxShadow = 'inset 0 1px 3px rgba(0,0,0,0.05)';
          break;
      }

      cells.push(
        <div
          key={k}
          className="flex items-center justify-center overflow-hidden relative"
          style={{ background: bg, ...extra }}
        >
          {content}
        </div>,
      );
    }
  }

  return cells;
}

// ─────────────────────────────────────────────────────────────────────────────
// PIECE RENDER DATA
// ─────────────────────────────────────────────────────────────────────────────

interface PieceRenderData {
  id: string;
  color: PlayerColor;
  pieceIndex: number;
  row: number;
  col: number;
  isValid: boolean;
  stackIdx: number;
  stackTotal: number;
}

function computePieces(
  gameState: SerializedGameState | null,
  validMoves: number[],
  myColor: PlayerColor | null,
): PieceRenderData[] {
  if (!gameState) return [];

  const groups = new Map<string, PieceRenderData[]>();

  for (const player of gameState.players) {
    for (const piece of player.pieces) {
      let row: number;
      let col: number;

      if (piece.state === 'home') {
        [row, col] = HOME_CIRCLE_CELLS[piece.color][piece.index];
      } else if (piece.state === 'finished') {
        [row, col] = [7, 7];
      } else {
        [row, col] = getPiecePosition(piece.color, piece.steps);
      }

      const posKey = `${row},${col}`;
      if (!groups.has(posKey)) groups.set(posKey, []);

      groups.get(posKey)!.push({
        id: `${piece.color}-${piece.index}`,
        color: piece.color,
        pieceIndex: piece.index,
        row,
        col,
        isValid: piece.color === myColor && validMoves.includes(piece.index),
        stackIdx: 0,
        stackTotal: 0,
      });
    }
  }

  const result: PieceRenderData[] = [];
  for (const group of groups.values()) {
    const total = group.length;
    for (let i = 0; i < total; i++) {
      group[i].stackIdx = i;
      group[i].stackTotal = total;
    }
    result.push(...group);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// LudoBoard COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function LudoBoard({
  gameState,
  validMoves,
  onPieceClick,
  myColor,
}: LudoBoardProps) {
  // Static cells – built once and never change
  const cells = useMemo(() => buildCells(), []);

  // Piece positions – recomputed when game state / valid moves change
  const pieces = useMemo(
    () => computePieces(gameState, validMoves, myColor),
    [gameState, validMoves, myColor],
  );

  return (
    <div className="w-full max-w-[min(600px,90vw)] mx-auto select-none">
      {/* ── Premium outer frame (wood-tone gradient) ─────────────────── */}
      <div
        className="rounded-2xl p-[7px]"
        style={{
          background:
            'linear-gradient(145deg, #a0845c 0%, #6b5640 40%, #8b7355 70%, #a0845c 100%)',
          boxShadow:
            '0 16px 48px rgba(0,0,0,0.28), 0 4px 14px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.18)',
        }}
      >
        <div
          className="aspect-square relative overflow-hidden rounded-[10px]"
          style={{
            boxShadow: 'inset 0 0 0 1.5px rgba(0,0,0,0.12)',
          }}
        >
          {/* ── Cell grid layer (static board) ────────────────────────── */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(15, 1fr)',
              gridTemplateRows: 'repeat(15, 1fr)',
              gap: '0.5px',
              background: '#c9bda8',
              zIndex: 1,
            }}
          >
            {cells}
          </div>

          {/* ── Home-base arrow overlays ──────────────────────────────── */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 1 }}
          >
            {(['red', 'green', 'yellow', 'blue'] as PlayerColor[]).map(
              (color) => {
                const pos = HOME_ARROW_POS[color];
                return (
                  <div
                    key={color}
                    className="absolute flex items-center justify-center"
                    style={{
                      top: `${pos.top}%`,
                      left: `${pos.left}%`,
                      width: '13.33%',
                      height: '13.33%',
                    }}
                  >
                    <HomeBaseArrow color={color} />
                  </div>
                );
              },
            )}
          </div>

          {/* ── Piece overlay layer (animated) ────────────────────────── */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(15, 1fr)',
              gridTemplateRows: 'repeat(15, 1fr)',
              gap: '0.5px',
              zIndex: 2,
            }}
          >
            {pieces.map((p) => {
              const stacked = p.stackTotal > 1;
              const offset = stacked
                ? STACK_OFFSETS[p.stackIdx] ?? { x: 0, y: 0 }
                : { x: 0, y: 0 };
              const size = stacked ? '58%' : '76%';
              const hex = PLAYER_COLOR_HEX[p.color];
              const dark = PLAYER_COLOR_DARK[p.color];

              // Glow keyframes for valid-move pulsing
              const glowKeyframes = p.isValid
                ? [
                    `0 3px 8px rgba(0,0,0,0.30), 0 0 6px ${hex}80, inset 0 2px 4px rgba(255,255,255,0.40), inset 0 -2px 4px rgba(0,0,0,0.12)`,
                    `0 3px 8px rgba(0,0,0,0.30), 0 0 18px ${hex}bb, inset 0 2px 4px rgba(255,255,255,0.40), inset 0 -2px 4px rgba(0,0,0,0.12)`,
                    `0 3px 8px rgba(0,0,0,0.30), 0 0 28px ${hex}, inset 0 2px 4px rgba(255,255,255,0.40), inset 0 -2px 4px rgba(0,0,0,0.12)`,
                    `0 3px 8px rgba(0,0,0,0.30), 0 0 18px ${hex}bb, inset 0 2px 4px rgba(255,255,255,0.40), inset 0 -2px 4px rgba(0,0,0,0.12)`,
                    `0 3px 8px rgba(0,0,0,0.30), 0 0 6px ${hex}80, inset 0 2px 4px rgba(255,255,255,0.40), inset 0 -2px 4px rgba(0,0,0,0.12)`,
                  ]
                : undefined;

              const scaleKeyframes = p.isValid
                ? [1, 1.07, 1.12, 1.07, 1]
                : undefined;

              return (
                <motion.div
                  key={p.id}
                  layout
                  style={{
                    gridRow: p.row + 1,
                    gridColumn: p.col + 1,
                    pointerEvents: p.isValid ? 'auto' : 'none',
                  }}
                  className="flex items-center justify-center relative"
                  transition={{
                    type: 'spring',
                    stiffness: 360,
                    damping: 26,
                    mass: 0.8,
                  }}
                >
                  {/* Drop shadow (offset down for 3-D feel) */}
                  <div
                    className="absolute rounded-full"
                    style={{
                      width: size,
                      height: size,
                      transform: `translate(${offset.x}px, ${offset.y + 2}px)`,
                      background:
                        'radial-gradient(ellipse, rgba(0,0,0,0.18) 0%, transparent 70%)',
                    }}
                  />

                  {/* Piece body */}
                  <motion.div
                    className="relative rounded-full shrink-0"
                    style={{
                      width: size,
                      height: size,
                      transform: `translate(${offset.x}px, ${offset.y}px)`,
                      cursor: p.isValid ? 'pointer' : 'default',
                      // 3-D glossy gradient: highlight top-left → base colour → shadow bottom-right
                      background: `radial-gradient(circle at 36% 28%, ${hex}ff 0%, ${hex}dd 45%, ${dark} 100%)`,
                      boxShadow: `0 3px 8px rgba(0,0,0,0.30), inset 0 2px 4px rgba(255,255,255,0.40), inset 0 -2px 4px rgba(0,0,0,0.12)`,
                      border: '1.5px solid rgba(255,255,255,0.30)',
                    }}
                    animate={
                      glowKeyframes
                        ? {
                            boxShadow: glowKeyframes,
                            scale: scaleKeyframes,
                          }
                        : undefined
                    }
                    transition={
                      p.isValid
                        ? {
                            repeat: Infinity,
                            duration: 1.4,
                            ease: 'easeInOut' as const,
                          }
                        : undefined
                    }
                    onClick={() => {
                      if (p.isValid) onPieceClick(p.color, p.pieceIndex);
                    }}
                    whileTap={p.isValid ? { scale: 0.88 } : undefined}
                  >
                    {/* Specular highlight arc */}
                    <div
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        top: '8%',
                        left: '12%',
                        width: '55%',
                        height: '38%',
                        background:
                          'radial-gradient(ellipse at 50% 60%, rgba(255,255,255,0.55) 0%, transparent 100%)',
                        borderRadius: '50%',
                      }}
                    />

                    {/* Piece number label */}
                    <span
                      className="absolute inset-0 flex items-center justify-center font-extrabold z-10 pointer-events-none"
                      style={{
                        fontSize: 'clamp(7px, 1.15vw, 14px)',
                        color: '#ffffff',
                        textShadow: '0 1px 3px rgba(0,0,0,0.45)',
                        lineHeight: 1,
                      }}
                    >
                      {p.pieceIndex + 1}
                    </span>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
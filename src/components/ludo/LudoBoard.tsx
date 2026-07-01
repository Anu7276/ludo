'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PlayerColor, PLAYER_COLOR_HEX, PLAYER_COLOR_LIGHT } from '@/lib/ludo/types';
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
// MODULE-LEVEL LOOKUP TABLES  (built once, never change)
// ─────────────────────────────────────────────────────────────────────────────

/** Set of "row,col" strings for every main-path cell. */
const MAIN_PATH_SET = new Set(MAIN_PATH.map(([r, c]) => `${r},${c}`));

/** Map from "row,col" → PlayerColor for home-column cells. */
const HOME_COL_MAP = new Map<string, PlayerColor>();
for (const color of ['red', 'green', 'yellow', 'blue'] as PlayerColor[]) {
  for (const [r, c] of HOME_COLUMNS[color]) {
    HOME_COL_MAP.set(`${r},${c}`, color);
  }
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
  { x: -3, y: -3 },
  { x: 3, y: -3 },
  { x: -3, y: 3 },
  { x: 3, y: 3 },
  { x: 0, y: -4 },
  { x: 0, y: 4 },
  { x: -4, y: 0 },
  { x: 4, y: 0 },
];

// ─────────────────────────────────────────────────────────────────────────────
// CELL CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

type CellInfo =
  | { kind: 'homeBase'; color: PlayerColor }
  | { kind: 'path' }
  | { kind: 'start'; color: PlayerColor }
  | { kind: 'star'; color: PlayerColor }
  | { kind: 'homeColumn'; color: PlayerColor }
  | { kind: 'entry'; color: PlayerColor }
  | { kind: 'center' }
  | { kind: 'crossInner' };

function classifyCell(row: number, col: number): CellInfo {
  const k = `${row},${col}`;

  if (row === 7 && col === 7) return { kind: 'center' };
  if (ENTRY_MAP.has(k)) return { kind: 'entry', color: ENTRY_MAP.get(k)! };
  if (HOME_COL_MAP.has(k)) return { kind: 'homeColumn', color: HOME_COL_MAP.get(k)! };
  if (START_MAP.has(k)) return { kind: 'start', color: START_MAP.get(k)! };
  if (MAIN_PATH_SET.has(k)) {
    const sc = STAR_MAP.get(k);
    return sc ? { kind: 'star', color: sc } : { kind: 'path' };
  }
  if (HOME_BASE_MAP.has(k)) return { kind: 'homeBase', color: HOME_BASE_MAP.get(k)! };
  if (CROSS_INNER_SET.has(k)) return { kind: 'crossInner' };

  // Fallback – shouldn't happen on a valid 15×15 Ludo board
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
      let bg: string;
      let content: React.ReactNode = null;

      switch (info.kind) {
        case 'homeBase':
          bg = PLAYER_COLOR_LIGHT[info.color];
          if (HOME_CIRCLE_SET.has(k)) {
            content = (
              <div
                className="w-[78%] h-[78%] rounded-full shrink-0"
                style={{
                  background: '#ffffff',
                  boxShadow:
                    '0 1px 4px rgba(0,0,0,0.08), inset 0 1px 2px rgba(0,0,0,0.06)',
                }}
              />
            );
          }
          break;

        case 'path':
          bg = '#ffffff';
          break;

        case 'start':
          bg = PLAYER_COLOR_HEX[info.color];
          content = (
            <span className="text-[clamp(7px,1.4vw,13px)] leading-none select-none drop-shadow-sm">
              ⭐
            </span>
          );
          break;

        case 'star':
          bg = PLAYER_COLOR_LIGHT[info.color];
          content = (
            <span className="text-[clamp(7px,1.4vw,13px)] leading-none select-none drop-shadow-sm">
              ⭐
            </span>
          );
          break;

        case 'homeColumn':
          bg = PLAYER_COLOR_LIGHT[info.color];
          break;

        case 'entry':
          bg = PLAYER_COLOR_HEX[info.color];
          break;

        case 'center':
          bg = '#ffffff';
          content = (
            <div
              className="w-[88%] h-[88%] rounded-full shrink-0"
              style={{
                background: `conic-gradient(
                  #EF4444 0deg 90deg,
                  #22C55E 90deg 180deg,
                  #EAB308 180deg 270deg,
                  #3B82F6 270deg 360deg
                )`,
                boxShadow: '0 0 10px rgba(0,0,0,0.18)',
              }}
            >
              {/* White center dot */}
              <div className="w-[28%] h-[28%] rounded-full bg-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-sm" />
            </div>
          );
          break;

        case 'crossInner':
          bg = '#ffffff';
          break;
      }

      cells.push(
        <div
          key={k}
          className="flex items-center justify-center overflow-hidden relative"
          style={{ background: bg }}
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
  /** Unique key – same across renders for stable DOM identity. */
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
      <div
        className="aspect-square relative rounded-xl overflow-hidden"
        style={{
          boxShadow:
            '0 8px 30px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.12)',
          border: '2px solid rgba(156,163,175,0.5)',
        }}
      >
        {/* ── Cell grid layer (static board) ──────────────────────────── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(15, 1fr)',
            gridTemplateRows: 'repeat(15, 1fr)',
            gap: '1px',
            background: '#9ca3af',
            zIndex: 1,
          }}
        >
          {cells}
        </div>

        {/* ── Piece overlay layer (animated) ──────────────────────────── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(15, 1fr)',
            zIndex: 2,
            gridTemplateRows: 'repeat(15, 1fr)',
            gap: '1px',
          }}
        >
          {pieces.map((p) => {
            const stacked = p.stackTotal > 1;
            const offset = stacked
              ? STACK_OFFSETS[p.stackIdx] ?? { x: 0, y: 0 }
              : { x: 0, y: 0 };
            const circleSize = stacked ? '62%' : '78%';
            const hex = PLAYER_COLOR_HEX[p.color];

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
                  stiffness: 400,
                  damping: 30,
                  mass: 0.8,
                }}
              >
                <motion.div
                  className="relative rounded-full shrink-0"
                  style={{
                    width: circleSize,
                    height: circleSize,
                    backgroundColor: hex,
                    transform: `translate(${offset.x}px, ${offset.y}px)`,
                    cursor: p.isValid ? 'pointer' : 'default',
                    boxShadow: `0 2px 5px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.2)`,
                  }}
                  animate={
                    p.isValid
                      ? {
                          boxShadow: [
                            `0 2px 5px rgba(0,0,0,0.22), 0 0 6px ${hex}90`,
                            `0 2px 5px rgba(0,0,0,0.22), 0 0 16px ${hex}`,
                            `0 2px 5px rgba(0,0,0,0.22), 0 0 24px ${hex}`,
                            `0 2px 5px rgba(0,0,0,0.22), 0 0 16px ${hex}`,
                            `0 2px 5px rgba(0,0,0,0.22), 0 0 6px ${hex}90`,
                          ],
                          scale: [1, 1.06, 1.1, 1.06, 1],
                        }
                      : {}
                  }
                  transition={
                    p.isValid
                      ? {
                          repeat: Infinity,
                          duration: 1.8,
                          ease: 'easeInOut' as const,
                        }
                      : {}
                  }
                  onClick={() => {
                    if (p.isValid) onPieceClick(p.color, p.pieceIndex);
                  }}
                  whileTap={p.isValid ? { scale: 0.92 } : undefined}
                >
                  {/* ── Donut hole (white inner circle) ──────────────── */}
                  <div
                    className="absolute rounded-full"
                    style={{
                      inset: '24%',
                      background: '#ffffff',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.12)',
                    }}
                  />

                  {/* ── Piece index label (shown only in heavy stacks) ── */}
                  {p.stackTotal > 2 && (
                    <span
                      className="absolute inset-0 flex items-center justify-center font-bold z-10"
                      style={{
                        fontSize: 'clamp(6px, 1vw, 11px)',
                        color: '#fff',
                        textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                      }}
                    >
                      {p.pieceIndex + 1}
                    </span>
                  )}
                </motion.div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
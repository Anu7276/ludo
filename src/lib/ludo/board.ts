import { PlayerColor } from './types';

// 15x15 grid positions
// The board is a cross-shaped playing area with 4 home bases in corners
// and 4 home columns leading to the center

// Main path: 52 cells forming a clockwise loop
// Each player enters at a specific index and traverses 51 cells
// before entering their home column
export const MAIN_PATH: [number, number][] = [
  // Red's arm top (row 6, cols 1-5) - 5 cells
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  // Top arm left side (col 6, rows 5-0) - 6 cells
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  // Top edge (row 0, col 7) - 1 cell
  [0, 7],
  // Top arm right side (col 8, rows 0-5) - 6 cells
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  // Green's arm top (row 6, cols 9-14) - 6 cells
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  // Right edge (col 14, row 7) - 1 cell
  [7, 14],
  // Yellow's arm bottom (row 8, cols 14-9) - 6 cells
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  // Bottom arm right side (col 8, rows 9-14) - 6 cells
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  // Bottom edge (row 14, col 7) - 1 cell
  [14, 7],
  // Bottom arm left side (col 6, rows 14-9) - 6 cells
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  // Blue's arm bottom (row 8, cols 5-1) - 5 cells
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1],
  // Left edge (col 0, row 7) - 1 cell
  [7, 0],
  // Connect back (row 6, col 0) - 1 cell
  [6, 0],
];

// Verify: 5+6+1+6+6+1+6+6+1+6+5+1+1 = 52 cells

// Player start indices on the main path
export const PLAYER_START_INDEX: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

// Home columns: 5 cells each leading to the center [7,7]
export const HOME_COLUMNS: Record<PlayerColor, [number, number][]> = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
};

// Center/finish position
export const CENTER: [number, number] = [7, 7];

// Home base positions for each player's 4 pieces (visual positions in the 6x6 corner areas)
export const HOME_BASE_POSITIONS: Record<PlayerColor, [number, number][]> = {
  red: [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]],
  green: [[1.5, 10.5], [1.5, 12.5], [3.5, 10.5], [3.5, 12.5]],
  yellow: [[10.5, 10.5], [10.5, 12.5], [12.5, 10.5], [12.5, 12.5]],
  blue: [[10.5, 1.5], [10.5, 3.5], [12.5, 1.5], [12.5, 3.5]],
};

// Safe zone indices on the main path (start positions + star positions)
export const SAFE_ZONE_INDICES: Set<number> = new Set([
  0,   // Red start
  8,   // Red star
  13,  // Green start
  21,  // Green star
  26,  // Yellow start
  34,  // Yellow star
  39,  // Blue start
  47,  // Blue star
]);

// Get the grid position of a piece based on its color and steps
export function getPiecePosition(color: PlayerColor, steps: number): [number, number] {
  if (steps === 0) {
    // In home base - return a special marker
    return [-1, -1];
  }
  if (steps >= 1 && steps <= 51) {
    // On the common path
    const pathIndex = (PLAYER_START_INDEX[color] + steps - 1) % 52;
    return MAIN_PATH[pathIndex];
  }
  if (steps >= 52 && steps <= 56) {
    // In the home column
    const homeColIndex = steps - 52;
    return HOME_COLUMNS[color][homeColIndex];
  }
  // Finished - at center
  return CENTER;
}

// Get the main path index for a player at given steps
export function getMainPathIndex(color: PlayerColor, steps: number): number {
  if (steps < 1 || steps > 51) return -1;
  return (PLAYER_START_INDEX[color] + steps - 1) % 52;
}

// Check if a path index is a safe zone
export function isSafeZone(pathIndex: number): boolean {
  return SAFE_ZONE_INDICES.has(pathIndex);
}

// Get which cells on the 15x15 grid are part of the playing area
export function getCellType(row: number, col: number): CellType {
  // Center
  if (row === 7 && col === 7) return 'center';
  
  // Home columns
  for (const color of ['red', 'green', 'yellow', 'blue'] as PlayerColor[]) {
    for (const [hr, hc] of HOME_COLUMNS[color]) {
      if (row === hr && col === hc) return `homeColumn_${color}` as CellType;
    }
  }
  
  // Main path
  for (const [pr, pc] of MAIN_PATH) {
    if (row === pr && col === pc) return 'path';
  }
  
  // Home bases (6x6 corners)
  if (row >= 0 && row <= 5 && col >= 0 && col <= 5) return 'homeBase_red';
  if (row >= 0 && row <= 5 && col >= 9 && col <= 14) return 'homeBase_green';
  if (row >= 9 && row <= 14 && col >= 9 && col <= 14) return 'homeBase_yellow';
  if (row >= 9 && row <= 14 && col >= 0 && col <= 5) return 'homeBase_blue';
  
  // Cross area (non-path cells in the cross arms)
  // Row 7 middle cells (between home columns)
  if (row === 7 && col === 6) return 'homeColumnEntry_red';
  if (row === 7 && col === 8) return 'homeColumnEntry_green';
  if (row === 6 && col === 7) return 'homeColumnEntry_green'; // This is green's start entry
  
  // These cells are part of the cross but not path/home column
  if ((row >= 6 && row <= 8 && col >= 6 && col <= 8)) return 'crossInner';
  
  // Background
  return 'empty';
}

export type CellType = 
  | 'path' 
  | 'center'
  | 'empty'
  | 'crossInner'
  | `homeBase_${PlayerColor}`
  | `homeColumn_${PlayerColor}`
  | `homeColumnEntry_${PlayerColor}`;

// Determine if a path cell should be colored for a specific player
export function getPathCellColor(row: number, col: number): PlayerColor | null {
  // Check if this cell is on a player's "entry" path (start cell)
  const pathIndex = MAIN_PATH.findIndex(([r, c]) => r === row && c === col);
  if (pathIndex === -1) return null;
  
  // Color the start cells
  for (const color of ['red', 'green', 'yellow', 'blue'] as PlayerColor[]) {
    if (pathIndex === PLAYER_START_INDEX[color]) return color;
  }
  
  // Color the safe star cells
  const starPositions = [8, 21, 34, 47];
  const starColors: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];
  for (let i = 0; i < starPositions.length; i++) {
    if (pathIndex === starPositions[i]) return starColors[i];
  }
  
  return null;
}

// Get the color of the home column entry cell
export function getHomeColumnEntryColor(row: number, col: number): PlayerColor | null {
  // Red's home column entry is at [7, 6]
  if (row === 7 && col === 6) return 'red';
  // Green's home column entry is at [6, 7]
  if (row === 6 && col === 7) return 'green'; // actually this is green's start
  // Yellow's home column entry is at [7, 8]
  if (row === 7 && col === 8) return 'yellow';
  // Blue's home column entry is at [8, 7]
  if (row === 8 && col === 7) return 'blue';
  return null;
}
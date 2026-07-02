export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';

export type PieceState = 'home' | 'active' | 'finished';

export interface Piece {
  id: string;
  color: PlayerColor;
  index: number; // 0-3, which of the 4 pieces
  state: PieceState;
  steps: number; // 0 = in home, 1-51 = on common path, 52-56 = in home column, 57 = finished
}

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  pieces: Piece[];
  isConnected: boolean;
  isBot: boolean;
}

export type GamePhase = 'waiting' | 'playing' | 'finished';

export interface GameState {
  roomId: string;
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number; // index into players array
  diceValue: number | null;
  diceRolled: boolean;
  consecutiveSixes: number;
  winner: PlayerColor | null;
  turnHistory: TurnRecord[];
  createdAt: number;
}

export type CapturedPiece = { color: PlayerColor; pieceIndex: number };

export interface TurnRecord {
  playerId: string;
  playerColor: PlayerColor;
  diceValue: number;
  pieceIndex: number;
  fromSteps: number;
  toSteps: number;
  captured: CapturedPiece | null;
  captures?: CapturedPiece[];
  timestamp: number;
}

export interface RoomInfo {
  id: string;
  name: string;
  code: string;
  hostId: string;
  maxPlayers: number;
  playerCount: number;
  status: GamePhase;
  createdAt: number;
}

export interface MoveResult {
  success: boolean;
  pieceIndex: number;
  fromSteps: number;
  toSteps: number;
  captured?: CapturedPiece;
  captures?: CapturedPiece[];
  enteredBoard?: boolean;
  reachedHome?: boolean;
  extraTurn?: boolean;
  noMove?: boolean;
  reason?: string;
}

export const PLAYER_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

export const PLAYER_COLOR_HEX: Record<PlayerColor, string> = {
  red: '#EF4444',
  green: '#22C55E',
  yellow: '#EAB308',
  blue: '#3B82F6',
};

export const PLAYER_COLOR_LIGHT: Record<PlayerColor, string> = {
  red: '#FEE2E2',
  green: '#DCFCE7',
  yellow: '#FEF9C3',
  blue: '#DBEAFE',
};

export const PLAYER_COLOR_DARK: Record<PlayerColor, string> = {
  red: '#DC2626',
  green: '#16A34A',
  yellow: '#CA8A04',
  blue: '#2563EB',
};

export const PLAYER_COLOR_BG: Record<PlayerColor, string> = {
  red: 'bg-red-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  blue: 'bg-blue-500',
};
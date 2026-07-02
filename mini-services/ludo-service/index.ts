import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

// ============ GAME LOGIC (inlined for the mini-service) ============

type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';
type PieceState = 'home' | 'active' | 'finished';
type GamePhase = 'waiting' | 'playing' | 'finished';

interface Piece {
  id: string;
  color: PlayerColor;
  index: number;
  state: PieceState;
  steps: number;
}

interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  pieces: Piece[];
  isConnected: boolean;
  isBot: boolean;
}

interface GameState {
  roomId: string;
  phase: GamePhase;
  players: Player[];
  currentPlayerIndex: number;
  diceValue: number | null;
  diceRolled: boolean;
  consecutiveSixes: number;
  winner: PlayerColor | null;
  turnHistory: any[];
  createdAt: number;
}

interface RoomInfo {
  id: string;
  name: string;
  code: string;
  hostId: string;
  maxPlayers: number;
  playerCount: number;
  status: GamePhase;
  createdAt: number;
}

const PLAYER_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

const MAIN_PATH: [number, number][] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1],
  [7, 0],
  [6, 0],
];

const PLAYER_START_INDEX: Record<PlayerColor, number> = {
  red: 0, green: 13, yellow: 26, blue: 39,
};

const SAFE_ZONE_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

function getMainPathIndex(color: PlayerColor, steps: number): number {
  if (steps < 1 || steps > 51) return -1;
  return (PLAYER_START_INDEX[color] + steps - 1) % 52;
}

function isSafeZone(pathIndex: number): boolean {
  return SAFE_ZONE_INDICES.has(pathIndex);
}

function createPiece(color: PlayerColor, index: number): Piece {
  return { id: uuidv4(), color, index, state: 'home', steps: 0 };
}

function createPlayer(id: string, name: string, color: PlayerColor, isBot: boolean = false): Player {
  return {
    id, name, color, isBot, isConnected: true,
    pieces: [createPiece(color, 0), createPiece(color, 1), createPiece(color, 2), createPiece(color, 3)],
  };
}

function createGameState(roomId: string): GameState {
  return {
    roomId, phase: 'waiting', players: [], currentPlayerIndex: 0,
    diceValue: null, diceRolled: false, consecutiveSixes: 0,
    winner: null, turnHistory: [], createdAt: Date.now(),
  };
}

function rollDice(state: GameState): number {
  const value = Math.floor(Math.random() * 6) + 1;
  state.diceValue = value;
  state.diceRolled = true;
  state.consecutiveSixes = value === 6 ? state.consecutiveSixes + 1 : 0;
  return value;
}

function isStartSquareBlocked(player: Player, pieceIndex: number): boolean {
  return player.pieces.some(
    p => p.index !== pieceIndex && p.state === 'active' && p.steps === 1
  );
}

function canMovePiece(state: GameState, playerIndex: number, pieceIndex: number, diceValue: number): boolean {
  const player = state.players[playerIndex];
  if (!player) return false;
  const piece = player.pieces[pieceIndex];
  if (!piece || piece.state === 'finished') return false;
  if (piece.state === 'home') {
    if (diceValue !== 6) return false;
    return !isStartSquareBlocked(player, pieceIndex);
  }
  const newSteps = piece.steps + diceValue;
  if (newSteps > 57) return false;
  if (newSteps >= 52 && newSteps <= 56) {
    if (player.pieces.some(p => p.index !== pieceIndex && p.steps === newSteps && p.state === 'active')) return false;
  }
  if (newSteps >= 1 && newSteps <= 51) {
    const destPathIndex = getMainPathIndex(player.color, newSteps);
    if (player.pieces.some(p => {
      if (p.index === pieceIndex || p.state !== 'active') return false;
      if (p.steps < 1 || p.steps > 51) return false;
      return getMainPathIndex(player.color, p.steps) === destPathIndex;
    })) return false;
  }
  return true;
}

function getValidMoves(state: GameState, playerIndex: number, diceValue: number): number[] {
  const moves: number[] = [];
  for (let i = 0; i < 4; i++) {
    if (canMovePiece(state, playerIndex, i, diceValue)) moves.push(i);
  }
  return moves;
}

type CapturedPiece = { color: PlayerColor; pieceIndex: number };

function checkAndCapture(state: GameState, movingPlayer: Player, movingPiece: Piece): CapturedPiece[] {
  if (movingPiece.steps < 1 || movingPiece.steps > 51) return [];
  const pathIndex = getMainPathIndex(movingPlayer.color, movingPiece.steps);
  if (isSafeZone(pathIndex)) return [];
  const captured: CapturedPiece[] = [];
  for (const opponent of state.players) {
    if (opponent.color === movingPlayer.color) continue;
    for (const piece of opponent.pieces) {
      if (piece.state !== 'active' || piece.steps < 1 || piece.steps > 51) continue;
      if (getMainPathIndex(opponent.color, piece.steps) === pathIndex) {
        piece.state = 'home';
        piece.steps = 0;
        captured.push({ color: opponent.color, pieceIndex: piece.index });
      }
    }
  }
  return captured;
}

function captureFields(result: { captured?: CapturedPiece | null; captures?: CapturedPiece[] }) {
  const captures = result.captures ?? (result.captured ? [result.captured] : []);
  return { captured: result.captured ?? null, captures };
}

function executeMove(state: GameState, playerIndex: number, pieceIndex: number, diceValue: number): any {
  const player = state.players[playerIndex];
  if (!player) return { success: false, pieceIndex, fromSteps: 0, toSteps: 0, reason: 'Player not found' };
  const piece = player.pieces[pieceIndex];
  if (!piece) return { success: false, pieceIndex, fromSteps: 0, toSteps: 0, reason: 'Piece not found' };
  const fromSteps = piece.steps;

  if (piece.state === 'home') {
    if (diceValue !== 6) return { success: false, pieceIndex, fromSteps, toSteps: fromSteps, reason: 'Need 6' };
    if (isStartSquareBlocked(player, pieceIndex)) {
      return { success: false, pieceIndex, fromSteps, toSteps: fromSteps, reason: 'Move your piece on start first' };
    }
    piece.state = 'active';
    piece.steps = 1;
    const captures = checkAndCapture(state, player, piece);
    return {
      success: true, pieceIndex, fromSteps: 0, toSteps: 1,
      captures, captured: captures[0] ?? null, enteredBoard: true, extraTurn: true,
    };
  }

  const newSteps = piece.steps + diceValue;
  if (newSteps > 57) return { success: false, pieceIndex, fromSteps, toSteps: fromSteps, reason: 'Exceeds home' };

  piece.steps = newSteps;

  if (newSteps === 57) {
    piece.state = 'finished';
    if (player.pieces.every(p => p.state === 'finished')) {
      state.winner = player.color;
      state.phase = 'finished';
    }
    return { success: true, pieceIndex, fromSteps, toSteps: newSteps, reachedHome: true, extraTurn: diceValue === 6 };
  }

  let captures: CapturedPiece[] = [];
  if (newSteps >= 1 && newSteps <= 51) {
    captures = checkAndCapture(state, player, piece);
  }
  return {
    success: true, pieceIndex, fromSteps, toSteps: newSteps,
    captures, captured: captures[0] ?? null, extraTurn: diceValue === 6 || captures.length > 0,
  };
}

function applyTripleSixPenalty(state: GameState, playerIndex: number): void {
  const player = state.players[playerIndex];
  if (!player) return;

  for (let i = state.turnHistory.length - 1; i >= 0; i--) {
    const record = state.turnHistory[i];
    if (record.playerId !== player.id || record.pieceIndex < 0) continue;
    const piece = player.pieces[record.pieceIndex];
    if (piece?.state === 'active') {
      piece.state = 'home';
      piece.steps = 0;
      return;
    }
  }

  let furthest: Piece | null = null;
  for (const piece of player.pieces) {
    if (piece.state === 'active' && (!furthest || piece.steps > furthest.steps)) {
      furthest = piece;
    }
  }
  if (furthest) {
    furthest.state = 'home';
    furthest.steps = 0;
  }
}

function nextTurn(state: GameState, hadExtraTurn: boolean = false): void {
  if (state.phase === 'finished') return;
  if (hadExtraTurn && state.consecutiveSixes < 3) {
    state.diceValue = null;
    state.diceRolled = false;
    return;
  }
  if (state.consecutiveSixes >= 3) {
    applyTripleSixPenalty(state, state.currentPlayerIndex);
    state.consecutiveSixes = 0;
  }
  let nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  let attempts = 0;
  while (attempts < state.players.length) {
    const p = state.players[nextIndex];
    if (p && (p.isConnected || p.isBot)) break;
    nextIndex = (nextIndex + 1) % state.players.length;
    attempts++;
  }
  state.currentPlayerIndex = nextIndex;
  state.diceValue = null;
  state.diceRolled = false;
  state.consecutiveSixes = 0;
}

function autoSelectMove(state: GameState, playerIndex: number, diceValue: number): number {
  const validMoves = getValidMoves(state, playerIndex, diceValue);
  if (validMoves.length === 0) return -1;
  if (validMoves.length === 1) return validMoves[0];
  const player = state.players[playerIndex];
  if (!player) return validMoves[0];
  let bestMove = validMoves[0];
  let bestScore = -Infinity;
  for (const moveIdx of validMoves) {
    let score = 0;
    const piece = player.pieces[moveIdx];
    if (!piece) continue;
    let newSteps: number;
    if (piece.state === 'home') { newSteps = 1; } else { newSteps = piece.steps + diceValue; }
    if (newSteps === 57) score = 1000;
    else if (newSteps >= 52) score = 500 + newSteps;
    else if (piece.state === 'home') score = 300;
    else if (newSteps >= 1 && newSteps <= 51) {
      const destPathIndex = getMainPathIndex(player.color, newSteps);
      if (!isSafeZone(destPathIndex)) {
        for (const opponent of state.players) {
          if (opponent.color === player.color) continue;
          for (const op of opponent.pieces) {
            if (op.state !== 'active' || op.steps < 1 || op.steps > 51) continue;
            if (getMainPathIndex(opponent.color, op.steps) === destPathIndex) score += 400;
          }
        }
      }
      score += piece.steps;
      if (isSafeZone(destPathIndex)) score += 50;
    }
    if (score > bestScore) { bestScore = score; bestMove = moveIdx; }
  }
  return bestMove;
}

// ============ ROOM MANAGEMENT ============

const rooms = new Map<string, GameState>();
const roomCodes = new Map<string, string>(); // code -> roomId
const socketToRoom = new Map<string, { roomId: string; playerId: string }>();
const socketToPlayer = new Map<string, string>(); // socketId -> playerId

let firestore: Firestore | null = null;

function initFirestore(): Firestore | null {
  if (process.env.FIRESTORE_DISABLED === 'true') {
    console.log('[Ludo] Firestore disabled by FIRESTORE_DISABLED=true');
    return null;
  }

  try {
    if (!getApps().length) {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
      initializeApp({
        credential: applicationDefault(),
        ...(projectId ? { projectId } : {}),
      });
    }
    const db = getFirestore();
    console.log('[Ludo] Firestore persistence enabled');
    return db;
  } catch (err) {
    console.warn('[Ludo] Firestore unavailable; running with in-memory rooms only.', err);
    return null;
  }
}

function getRoomCode(roomId: string): string {
  return [...roomCodes.entries()].find(([, id]) => id === roomId)?.[0] || '';
}

function roomPlayers(state: GameState) {
  return state.players.map(p => ({
    id: p.id,
    name: p.name,
    color: p.color,
    isBot: p.isBot,
    isConnected: p.isConnected,
  }));
}

async function saveRoomSnapshot(roomId: string): Promise<void> {
  if (!firestore) return;
  const state = rooms.get(roomId);
  if (!state) return;

  try {
    await firestore.collection('ludoRooms').doc(roomId).set({
      roomId,
      code: getRoomCode(roomId),
      hostId: state.players[0]?.id || '',
      status: state.phase,
      playerCount: state.players.length,
      players: roomPlayers(state),
      gameState: serializeGameState(state),
      createdAt: state.createdAt,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn(`[Ludo] Failed to persist room ${roomId}`, err);
  }
}

async function deleteRoomSnapshot(roomId: string): Promise<void> {
  if (!firestore) return;
  try {
    await firestore.collection('ludoRooms').doc(roomId).delete();
  } catch (err) {
    console.warn(`[Ludo] Failed to delete room ${roomId}`, err);
  }
}

async function saveChatMessage(roomId: string, message: Record<string, unknown>): Promise<void> {
  if (!firestore) return;
  try {
    await firestore
      .collection('ludoRooms')
      .doc(roomId)
      .collection('messages')
      .add({ ...message, createdAt: FieldValue.serverTimestamp() });
  } catch (err) {
    console.warn(`[Ludo] Failed to persist chat message for room ${roomId}`, err);
  }
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (roomCodes.has(code));
  return code;
}

function getRoomInfo(state: GameState, hostId: string): RoomInfo {
  return {
    id: state.roomId,
    name: `Ludo Room`,
    code: getRoomCode(state.roomId),
    hostId,
    maxPlayers: 4,
    playerCount: state.players.length,
    status: state.phase,
    createdAt: state.createdAt,
  };
}

function getAllRooms(): RoomInfo[] {
  const result: RoomInfo[] = [];
  rooms.forEach((state, id) => {
    const host = state.players[0];
    result.push(getRoomInfo(state, host?.id || ''));
  });
  return result;
}

// ============ BOT AI ============

const roomBotTimers = new Map<string, ReturnType<typeof setTimeout>>();
const roomBotGeneration = new Map<string, number>();

function cancelBotTimer(roomId: string): void {
  const timer = roomBotTimers.get(roomId);
  if (timer) clearTimeout(timer);
  roomBotTimers.delete(roomId);
}

function scheduleBotTurn(io: Server, roomId: string, delay = 500): void {
  cancelBotTimer(roomId);
  const generation = (roomBotGeneration.get(roomId) || 0) + 1;
  roomBotGeneration.set(roomId, generation);
  const timer = setTimeout(() => {
    roomBotTimers.delete(roomId);
    if (roomBotGeneration.get(roomId) !== generation) return;
    void processBotTurn(io, roomId);
  }, delay);
  roomBotTimers.set(roomId, timer);
}

function finishBotTurn(io: Server, roomId: string, hadExtraTurn: boolean): void {
  scheduleBotTurn(io, roomId, hadExtraTurn ? 400 : 600);
}

function passTurnWithNoMoves(
  io: Server,
  roomId: string,
  state: GameState,
  player: Player,
  diceValue: number,
): void {
  state.turnHistory.push({
    playerId: player.id,
    playerColor: player.color,
    diceValue,
    pieceIndex: -1,
    fromSteps: 0,
    toSteps: 0,
    captured: null,
    timestamp: Date.now(),
  });
  io.to(roomId).emit('turn:noMoves', {
    playerId: player.id,
    playerColor: player.color,
    diceValue,
  });
  nextTurn(state, false);
  void saveRoomSnapshot(roomId);
  io.to(roomId).emit('game:stateUpdate', serializeGameState(state));
  finishBotTurn(io, roomId, false);
}

async function processBotTurn(io: Server, roomId: string): Promise<void> {
  const state = rooms.get(roomId);
  if (!state || state.phase !== 'playing') return;

  const playerIndex = state.currentPlayerIndex;
  const player = state.players[playerIndex];
  if (!player?.isBot) return;

  try {
    if (!state.diceRolled) {
      await new Promise((r) => setTimeout(r, 500));
      const current = rooms.get(roomId);
      if (!current || current.phase !== 'playing') return;
      if (current.currentPlayerIndex !== playerIndex) {
        scheduleBotTurn(io, roomId, 200);
        return;
      }
      if (current.diceRolled) {
        scheduleBotTurn(io, roomId, 200);
        return;
      }

      const diceValue = rollDice(current);
      void saveRoomSnapshot(roomId);
      io.to(roomId).emit('dice:rolled', {
        playerId: player.id,
        playerColor: player.color,
        value: diceValue,
      });
      io.to(roomId).emit('game:stateUpdate', serializeGameState(current));

      const validMoves = getValidMoves(current, playerIndex, diceValue);
      if (validMoves.length === 0) {
        await new Promise((r) => setTimeout(r, 400));
        const afterRoll = rooms.get(roomId);
        if (!afterRoll || afterRoll.currentPlayerIndex !== playerIndex) {
          scheduleBotTurn(io, roomId, 200);
          return;
        }
        passTurnWithNoMoves(io, roomId, afterRoll, player, diceValue);
        return;
      }

      scheduleBotTurn(io, roomId, 500);
      return;
    }

    await new Promise((r) => setTimeout(r, 500));
    const current = rooms.get(roomId);
    if (!current || current.phase !== 'playing') return;
    if (current.currentPlayerIndex !== playerIndex) {
      scheduleBotTurn(io, roomId, 200);
      return;
    }
    if (!current.diceRolled || current.diceValue === null) {
      scheduleBotTurn(io, roomId, 200);
      return;
    }

    const diceValue = current.diceValue;
    const validMoves = getValidMoves(current, playerIndex, diceValue);
    if (validMoves.length === 0) {
      passTurnWithNoMoves(io, roomId, current, player, diceValue);
      return;
    }

    const moveIdx = autoSelectMove(current, playerIndex, diceValue);
    const result = executeMove(current, playerIndex, moveIdx, diceValue);
    if (!result.success) {
      console.warn(`[Ludo] Bot move failed: ${result.reason}`);
      passTurnWithNoMoves(io, roomId, current, player, diceValue);
      return;
    }

    current.turnHistory.push({
      playerId: player.id,
      playerColor: player.color,
      diceValue,
      pieceIndex: moveIdx,
      fromSteps: result.fromSteps,
      toSteps: result.toSteps,
      ...captureFields(result),
      timestamp: Date.now(),
    });

    io.to(roomId).emit('piece:moved', {
      playerId: player.id,
      playerColor: player.color,
      pieceIndex: moveIdx,
      fromSteps: result.fromSteps,
      toSteps: result.toSteps,
      ...captureFields(result),
      enteredBoard: result.enteredBoard,
      reachedHome: result.reachedHome,
    });

    if (current.winner) {
      void saveRoomSnapshot(roomId);
      io.to(roomId).emit('game:finished', { winner: current.winner, winnerName: player.name });
      io.to(roomId).emit('game:stateUpdate', serializeGameState(current));
      cancelBotTimer(roomId);
      return;
    }

    const hadExtraTurn = result.extraTurn;
    nextTurn(current, hadExtraTurn);
    void saveRoomSnapshot(roomId);
    io.to(roomId).emit('game:stateUpdate', serializeGameState(current));
    finishBotTurn(io, roomId, hadExtraTurn);
  } catch (err) {
    console.error('[Ludo] processBotTurn error:', err);
    scheduleBotTurn(io, roomId, 800);
  }
}

function handleBotTurn(io: Server, roomId: string, _playerIndex: number): void {
  scheduleBotTurn(io, roomId, 300);
}

function serializeGameState(state: GameState): any {
  return {
    roomId: state.roomId,
    phase: state.phase,
    players: state.players.map(p => ({
      id: p.id, name: p.name, color: p.color, isConnected: p.isConnected, isBot: p.isBot,
      pieces: p.pieces.map(pc => ({ id: pc.id, color: pc.color, index: pc.index, state: pc.state, steps: pc.steps })),
    })),
    currentPlayerIndex: state.currentPlayerIndex,
    diceValue: state.diceValue,
    diceRolled: state.diceRolled,
    winner: state.winner,
    turnHistory: state.turnHistory.slice(-20), // Last 20 turns
  };
}

// ============ SOCKET.IO SERVER ============

const PORT = Number(process.env.PORT || 3003);
firestore = initFirestore();
const httpServer = createServer();
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});
httpServer.listen(PORT, '0.0.0.0');
console.log(`[Ludo] Socket.io server running on port ${PORT}`);

// Watchdog: restart bot chain if it stalls in multi-player games
setInterval(() => {
  rooms.forEach((state, roomId) => {
    if (state.phase !== 'playing') return;
    const current = state.players[state.currentPlayerIndex];
    if (current?.isBot && !roomBotTimers.has(roomId)) {
      scheduleBotTurn(io, roomId, 150);
    }
  });
}, 2500);

// Keep process alive and handle errors
process.on('uncaughtException', (err) => {
  console.error('[Ludo] Uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[Ludo] Unhandled rejection:', err);
});
httpServer.on('error', (err) => {
  console.error('[Ludo] HTTP server error:', err);
});

io.on('connection', (socket) => {
  console.log(`[Ludo] Connected: ${socket.id}`);

  // Create a new room
  socket.on('room:create', (data: { playerName: string }, callback: (response: any) => void) => {
    const roomId = uuidv4();
    const code = generateRoomCode();
    const state = createGameState(roomId);
    
    const playerId = uuidv4();
    const color = PLAYER_COLORS[0];
    state.players.push(createPlayer(playerId, data.playerName || 'Player 1', color));
    
    rooms.set(roomId, state);
    roomCodes.set(code, roomId);
    socketToRoom.set(socket.id, { roomId, playerId });
    socketToPlayer.set(socket.id, playerId);
    
    socket.join(roomId);
    
    void saveRoomSnapshot(roomId);
    callback({ success: true, roomId, code, color, playerId, playerCount: 1 });
    io.to(roomId).emit('room:updated', {
      players: state.players.map(p => ({ id: p.id, name: p.name, color: p.color, isBot: p.isBot, isConnected: p.isConnected })),
      hostId: playerId,
    });
    console.log(`[Ludo] Room created: ${code} by ${data.playerName}`);
  });

  // Join an existing room
  socket.on('room:join', (data: { code: string; playerName: string }, callback: (response: any) => void) => {
    const roomId = roomCodes.get(data.code.toUpperCase());
    if (!roomId) {
      callback({ success: false, error: 'Room not found' });
      return;
    }
    
    const state = rooms.get(roomId);
    if (!state) {
      callback({ success: false, error: 'Room not found' });
      return;
    }
    
    if (state.phase !== 'waiting') {
      callback({ success: false, error: 'Game already in progress' });
      return;
    }
    
    if (state.players.length >= 4) {
      callback({ success: false, error: 'Room is full' });
      return;
    }
    
    const playerId = uuidv4();
    const color = PLAYER_COLORS[state.players.length];
    state.players.push(createPlayer(playerId, data.playerName || `Player ${state.players.length + 1}`, color));
    
    socketToRoom.set(socket.id, { roomId, playerId });
    socketToPlayer.set(socket.id, playerId);
    socket.join(roomId);
    
    void saveRoomSnapshot(roomId);
    callback({ success: true, roomId, code: data.code.toUpperCase(), color, playerId, playerCount: state.players.length });
    io.to(roomId).emit('room:updated', {
      players: state.players.map(p => ({ id: p.id, name: p.name, color: p.color, isBot: p.isBot, isConnected: p.isConnected })),
      hostId: state.players[0]?.id,
    });
    io.to(roomId).emit('game:stateUpdate', serializeGameState(state));
    console.log(`[Ludo] ${data.playerName} joined room ${data.code.toUpperCase()}`);
  });

  // Add bot to room
  socket.on('room:addBot', (data: { roomId?: string }, callback: (response: any) => void) => {
    const info = socketToRoom.get(socket.id);
    const roomId = data.roomId || info?.roomId;
    if (!roomId) { callback({ success: false, error: 'Not in a room' }); return; }
    
    const state = rooms.get(roomId);
    if (!state) { callback({ success: false, error: 'Room not found' }); return; }
    if (state.phase !== 'waiting') { callback({ success: false, error: 'Game already started' }); return; }
    if (state.players.length >= 4) { callback({ success: false, error: 'Room is full' }); return; }
    
    const botId = `bot-${uuidv4()}`;
    const color = PLAYER_COLORS[state.players.length];
    const botNames = ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta'];
    const botCount = state.players.filter(p => p.isBot).length;
    state.players.push(createPlayer(botId, botNames[botCount] || `Bot ${botCount + 1}`, color, true));
    
    void saveRoomSnapshot(roomId);
    callback({ success: true, botName: state.players[state.players.length - 1].name, color });
    io.to(roomId).emit('room:updated', {
      players: state.players.map(p => ({ id: p.id, name: p.name, color: p.color, isBot: p.isBot, isConnected: p.isConnected })),
      hostId: state.players[0]?.id,
    });
    console.log(`[Ludo] Bot added to room, now ${state.players.length} players`);
  });

  // Remove bot from room
  socket.on('room:removeBot', (data: { roomId?: string }, callback: (response: any) => void) => {
    const info = socketToRoom.get(socket.id);
    const roomId = data.roomId || info?.roomId;
    if (!roomId) { callback({ success: false, error: 'Not in a room' }); return; }
    
    const state = rooms.get(roomId);
    if (!state) { callback({ success: false, error: 'Room not found' }); return; }
    if (state.phase !== 'waiting') { callback({ success: false, error: 'Game already started' }); return; }
    
    const botIndex = state.players.findLastIndex(p => p.isBot);
    if (botIndex === -1) { callback({ success: false, error: 'No bots to remove' }); return; }
    
    state.players.splice(botIndex, 1);
    void saveRoomSnapshot(roomId);
    callback({ success: true });
    io.to(roomId).emit('room:updated', {
      players: state.players.map(p => ({ id: p.id, name: p.name, color: p.color, isBot: p.isBot, isConnected: p.isConnected })),
      hostId: state.players[0]?.id,
    });
  });

  // Start the game
  socket.on('game:start', (data: {}, callback: (response: any) => void) => {
    const info = socketToRoom.get(socket.id);
    if (!info) { callback({ success: false, error: 'Not in a room' }); return; }
    
    const state = rooms.get(info.roomId);
    if (!state) { callback({ success: false, error: 'Room not found' }); return; }
    if (state.players[0]?.id !== info.playerId) { callback({ success: false, error: 'Only host can start' }); return; }
    if (state.players.length < 2) { callback({ success: false, error: 'Need at least 2 players' }); return; }
    
    state.phase = 'playing';
    state.currentPlayerIndex = 0;
    state.diceValue = null;
    state.diceRolled = false;
    state.consecutiveSixes = 0;
    state.createdAt = Date.now();
    roomBotGeneration.set(info.roomId, (roomBotGeneration.get(info.roomId) || 0) + 1);
    cancelBotTimer(info.roomId);
    
    void saveRoomSnapshot(info.roomId);
    callback({ success: true });
    io.to(info.roomId).emit('game:started', { gameState: serializeGameState(state) });
    io.to(info.roomId).emit('game:stateUpdate', serializeGameState(state));
    console.log(`[Ludo] Game started in room ${info.roomId}`);
    
    // If first player is a bot, handle their turn
    const firstPlayer = state.players[0];
    if (firstPlayer?.isBot) {
      handleBotTurn(io, info.roomId, 0);
    }
  });

  // Roll dice
  socket.on('dice:roll', (data: {}, callback: (response: any) => void) => {
    const info = socketToRoom.get(socket.id);
    if (!info) { callback({ success: false, error: 'Not in a room' }); return; }
    
    const state = rooms.get(info.roomId);
    if (!state) { callback({ success: false, error: 'Room not found' }); return; }
    if (state.phase !== 'playing') { callback({ success: false, error: 'Game not in progress' }); return; }
    
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== info.playerId) {
      callback({ success: false, error: 'Not your turn' });
      return;
    }
    if (state.diceRolled) {
      callback({ success: false, error: 'Already rolled' });
      return;
    }
    
    const diceValue = rollDice(state);
    console.log(`[Ludo] ${currentPlayer.name} rolled ${diceValue}`);
    
    void saveRoomSnapshot(info.roomId);
    callback({ success: true, value: diceValue });
    io.to(info.roomId).emit('dice:rolled', {
      playerId: info.playerId,
      playerColor: currentPlayer.color,
      value: diceValue,
    });
    
    // Check for valid moves
    const validMoves = getValidMoves(state, state.currentPlayerIndex, diceValue);
    
    if (validMoves.length === 0) {
      // Auto-pass after short delay
      setTimeout(() => {
        if (!rooms.has(info.roomId)) return;
        const s = rooms.get(info.roomId)!;
        s.turnHistory.push({
          playerId: info.playerId, playerColor: currentPlayer.color,
          diceValue, pieceIndex: -1, fromSteps: 0, toSteps: 0,
          captured: null, timestamp: Date.now(),
        });
        io.to(info.roomId).emit('turn:noMoves', { playerId: info.playerId, playerColor: currentPlayer.color, diceValue });
        nextTurn(s, false);
        void saveRoomSnapshot(info.roomId);
        io.to(info.roomId).emit('game:stateUpdate', serializeGameState(s));
        
        // Check if next is bot
        const nextP = s.players[s.currentPlayerIndex];
        if (nextP?.isBot && s.phase === 'playing') {
          scheduleBotTurn(io, info.roomId, 400);
        }
      }, 1500);
    }
    
    io.to(info.roomId).emit('game:stateUpdate', serializeGameState(state));
  });

  // Move piece
  socket.on('piece:move', (data: { pieceIndex: number }, callback: (response: any) => void) => {
    const info = socketToRoom.get(socket.id);
    if (!info) { callback({ success: false, error: 'Not in a room' }); return; }
    
    const state = rooms.get(info.roomId);
    if (!state) { callback({ success: false, error: 'Room not found' }); return; }
    if (state.phase !== 'playing') { callback({ success: false, error: 'Game not in progress' }); return; }
    if (!state.diceRolled || state.diceValue === null) { callback({ success: false, error: 'Roll dice first' }); return; }
    
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== info.playerId) {
      callback({ success: false, error: 'Not your turn' });
      return;
    }
    
    const result = executeMove(state, state.currentPlayerIndex, data.pieceIndex, state.diceValue);
    if (!result.success) {
      callback({ success: false, error: result.reason });
      return;
    }
    
    state.turnHistory.push({
      playerId: info.playerId, playerColor: currentPlayer.color,
      diceValue: state.diceValue, pieceIndex: data.pieceIndex,
      fromSteps: result.fromSteps, toSteps: result.toSteps,
      ...captureFields(result), timestamp: Date.now(),
    });
    
    void saveRoomSnapshot(info.roomId);
    callback({ success: true, result });
    io.to(info.roomId).emit('piece:moved', {
      playerId: info.playerId, playerColor: currentPlayer.color,
      pieceIndex: data.pieceIndex, fromSteps: result.fromSteps, toSteps: result.toSteps,
      ...captureFields(result), enteredBoard: result.enteredBoard,
      reachedHome: result.reachedHome,
    });
    
    if (state.winner) {
      void saveRoomSnapshot(info.roomId);
      io.to(info.roomId).emit('game:finished', { winner: state.winner, winnerName: currentPlayer.name });
      io.to(info.roomId).emit('game:stateUpdate', serializeGameState(state));
      return;
    }
    
    const hadExtraTurn = result.extraTurn;
    nextTurn(state, hadExtraTurn);
    void saveRoomSnapshot(info.roomId);
    io.to(info.roomId).emit('game:stateUpdate', serializeGameState(state));
    
    if (hadExtraTurn) {
      const p = state.players[state.currentPlayerIndex];
      if (p?.isBot && state.phase === 'playing') {
        scheduleBotTurn(io, info.roomId, 400);
      }
    } else {
      const nextP = state.players[state.currentPlayerIndex];
      if (nextP?.isBot && state.phase === 'playing') {
        scheduleBotTurn(io, info.roomId, 600);
      }
    }
  });

  // Get valid moves
  socket.on('game:getValidMoves', (data: {}, callback: (response: any) => void) => {
    const info = socketToRoom.get(socket.id);
    if (!info) { callback({ success: false, moves: [] }); return; }
    const state = rooms.get(info.roomId);
    if (!state || state.phase !== 'playing' || !state.diceRolled || state.diceValue === null) {
      callback({ success: false, moves: [] });
      return;
    }
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== info.playerId) {
      callback({ success: false, moves: [] });
      return;
    }
    const moves = getValidMoves(state, state.currentPlayerIndex, state.diceValue);
    callback({ success: true, moves });
  });

  // Leave room
  socket.on('room:leave', () => {
    const info = socketToRoom.get(socket.id);
    if (!info) return;
    
    const state = rooms.get(info.roomId);
    if (state) {
      const playerIndex = state.players.findIndex(p => p.id === info.playerId);
      if (playerIndex !== -1) {
        const disconnectedPlayer = state.players[playerIndex];
        if (disconnectedPlayer.isBot) {
          state.players.splice(playerIndex, 1);
          // Reassign colors
          state.players.forEach((p, i) => {
            p.color = PLAYER_COLORS[i];
            p.pieces.forEach(piece => { piece.color = PLAYER_COLORS[i]; });
          });
        } else {
          disconnectedPlayer.isConnected = false;
        }
      }
      
      if (state.phase === 'waiting') {
        // Remove player entirely in waiting phase
        const idx = state.players.findIndex(p => p.id === info.playerId);
        if (idx !== -1) {
          state.players.splice(idx, 1);
          state.players.forEach((p, i) => {
            p.color = PLAYER_COLORS[i];
            p.pieces.forEach(piece => { piece.color = PLAYER_COLORS[i]; });
          });
        }
      }
      
      io.to(info.roomId).emit('room:updated', {
        players: state.players.map(p => ({ id: p.id, name: p.name, color: p.color, isBot: p.isBot, isConnected: p.isConnected })),
        hostId: state.players[0]?.id,
      });
      io.to(info.roomId).emit('game:stateUpdate', serializeGameState(state));
      
      // Clean up empty rooms
      if (state.players.length === 0) {
        rooms.delete(info.roomId);
        const code = [...roomCodes.entries()].find(([, id]) => id === info.roomId)?.[0];
        if (code) roomCodes.delete(code);
        void deleteRoomSnapshot(info.roomId);
      } else {
        void saveRoomSnapshot(info.roomId);
      }
    }
    
    socket.leave(info.roomId);
    socketToRoom.delete(socket.id);
    socketToPlayer.delete(socket.id);
    console.log(`[Ludo] Disconnected: ${socket.id}`);
  });

  // Get room list
  socket.on('rooms:list', (callback: (rooms: RoomInfo[]) => void) => {
    callback(getAllRooms());
  });

  // Reconnect
  socket.on('room:reconnect', (data: { roomId: string; playerId: string }, callback: (response: any) => void) => {
    const state = rooms.get(data.roomId);
    if (!state) { callback({ success: false, error: 'Room not found' }); return; }
    
    const playerIndex = state.players.findIndex(p => p.id === data.playerId);
    if (playerIndex === -1) { callback({ success: false, error: 'Player not found' }); return; }
    
    state.players[playerIndex].isConnected = true;
    socketToRoom.set(socket.id, { roomId: data.roomId, playerId: data.playerId });
    socketToPlayer.set(socket.id, data.playerId);
    socket.join(data.roomId);
    
    void saveRoomSnapshot(data.roomId);
    callback({ success: true, gameState: serializeGameState(state) });
    io.to(data.roomId).emit('room:updated', {
      players: state.players.map(p => ({ id: p.id, name: p.name, color: p.color, isBot: p.isBot, isConnected: p.isConnected })),
      hostId: state.players[0]?.id,
    });
    console.log(`[Ludo] Reconnected: ${data.playerId}`);
  });

  // Chat message
  socket.on('chat:message', (data: { message: string }, callback: (response: any) => void) => {
    const info = socketToRoom.get(socket.id);
    if (!info) { callback({ success: false, error: 'Not in a room' }); return; }
    
    const state = rooms.get(info.roomId);
    if (!state) { callback({ success: false, error: 'Room not found' }); return; }
    
    const player = state.players.find(p => p.id === info.playerId);
    if (!player) { callback({ success: false, error: 'Player not found' }); return; }
    
    const truncated = data.message.substring(0, 200);
    const chatMessage = {
      playerId: info.playerId,
      playerName: player.name,
      playerColor: player.color,
      message: truncated,
      timestamp: Date.now(),
    };
    
    // Broadcast to all players in the room
    io.to(info.roomId).emit('chat:message', chatMessage);
    void saveChatMessage(info.roomId, chatMessage);
    
    callback({ success: true });
  });

  // Turn timeout — auto-pass or auto-move so mixed games don't freeze
  socket.on('turn:timeout', (data: {}, callback: (response: any) => void) => {
    const info = socketToRoom.get(socket.id);
    if (!info) { callback({ success: false, error: 'Not in a room' }); return; }

    const state = rooms.get(info.roomId);
    if (!state || state.phase !== 'playing') { callback({ success: false, error: 'Game not in progress' }); return; }

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer || currentPlayer.id !== info.playerId) {
      callback({ success: false, error: 'Not your turn' });
      return;
    }

    if (!state.diceRolled) {
      const diceValue = rollDice(state);
      void saveRoomSnapshot(info.roomId);
      io.to(info.roomId).emit('dice:rolled', {
        playerId: info.playerId,
        playerColor: currentPlayer.color,
        value: diceValue,
      });
      const validMoves = getValidMoves(state, state.currentPlayerIndex, diceValue);
      if (validMoves.length === 0) {
        state.turnHistory.push({
          playerId: info.playerId, playerColor: currentPlayer.color,
          diceValue, pieceIndex: -1, fromSteps: 0, toSteps: 0,
          captured: null, timestamp: Date.now(),
        });
        io.to(info.roomId).emit('turn:noMoves', { playerId: info.playerId, playerColor: currentPlayer.color, diceValue });
        nextTurn(state, false);
        void saveRoomSnapshot(info.roomId);
        io.to(info.roomId).emit('game:stateUpdate', serializeGameState(state));
        const nextP = state.players[state.currentPlayerIndex];
        if (nextP?.isBot) scheduleBotTurn(io, info.roomId, 400);
        callback({ success: true, action: 'passed' });
        return;
      }
      io.to(info.roomId).emit('game:stateUpdate', serializeGameState(state));
      callback({ success: true, action: 'rolled', value: diceValue });
      return;
    }

    const validMoves = getValidMoves(state, state.currentPlayerIndex, state.diceValue!);
    if (validMoves.length === 0) {
      callback({ success: false, error: 'No moves' });
      return;
    }

    const moveIdx = validMoves[0];
    const result = executeMove(state, state.currentPlayerIndex, moveIdx, state.diceValue!);
    if (!result.success) {
      callback({ success: false, error: result.reason });
      return;
    }

    state.turnHistory.push({
      playerId: info.playerId, playerColor: currentPlayer.color,
      diceValue: state.diceValue, pieceIndex: moveIdx,
      fromSteps: result.fromSteps, toSteps: result.toSteps,
      ...captureFields(result), timestamp: Date.now(),
    });
    void saveRoomSnapshot(info.roomId);
    io.to(info.roomId).emit('piece:moved', {
      playerId: info.playerId, playerColor: currentPlayer.color,
      pieceIndex: moveIdx, fromSteps: result.fromSteps, toSteps: result.toSteps,
      ...captureFields(result), enteredBoard: result.enteredBoard,
      reachedHome: result.reachedHome,
    });

    if (state.winner) {
      io.to(info.roomId).emit('game:finished', { winner: state.winner, winnerName: currentPlayer.name });
      io.to(info.roomId).emit('game:stateUpdate', serializeGameState(state));
      callback({ success: true, action: 'won' });
      return;
    }

    const hadExtraTurn = result.extraTurn;
    nextTurn(state, hadExtraTurn);
    io.to(info.roomId).emit('game:stateUpdate', serializeGameState(state));
    const nextP = state.players[state.currentPlayerIndex];
    if (nextP?.isBot) scheduleBotTurn(io, info.roomId, hadExtraTurn ? 400 : 600);
    callback({ success: true, action: 'moved' });
  });

  // Restart game
  socket.on('game:restart', (data: {}, callback: (response: any) => void) => {
    const info = socketToRoom.get(socket.id);
    if (!info) { callback({ success: false, error: 'Not in a room' }); return; }
    
    const state = rooms.get(info.roomId);
    if (!state) { callback({ success: false, error: 'Room not found' }); return; }
    if (state.players[0]?.id !== info.playerId) { callback({ success: false, error: 'Only host can restart' }); return; }
    
    // Reset all pieces
    state.phase = 'waiting';
    state.players.forEach(p => {
      p.pieces.forEach(piece => {
        piece.state = 'home';
        piece.steps = 0;
      });
    });
    state.currentPlayerIndex = 0;
    state.diceValue = null;
    state.diceRolled = false;
    state.consecutiveSixes = 0;
    state.winner = null;
    state.turnHistory = [];
    
    void saveRoomSnapshot(info.roomId);
    callback({ success: true });
    io.to(info.roomId).emit('game:stateUpdate', serializeGameState(state));
    io.to(info.roomId).emit('room:updated', {
      players: state.players.map(p => ({ id: p.id, name: p.name, color: p.color, isBot: p.isBot, isConnected: p.isConnected })),
      hostId: state.players[0]?.id,
    });
  });

  socket.on('disconnect', () => {
    const info = socketToRoom.get(socket.id);
    if (!info) return;
    
    const state = rooms.get(info.roomId);
    if (state) {
      const playerIndex = state.players.findIndex(p => p.id === info.playerId);
      if (playerIndex !== -1 && !state.players[playerIndex].isBot) {
        state.players[playerIndex].isConnected = false;
        io.to(info.roomId).emit('player:disconnected', { playerId: info.playerId });

        if (state.phase === 'playing' && state.currentPlayerIndex === playerIndex) {
          cancelBotTimer(info.roomId);
          if (state.diceRolled && state.diceValue !== null) {
            const moves = getValidMoves(state, playerIndex, state.diceValue);
            if (moves.length > 0) {
              const result = executeMove(state, playerIndex, moves[0], state.diceValue);
              if (result.success) {
                state.turnHistory.push({
                  playerId: info.playerId, playerColor: state.players[playerIndex].color,
                  diceValue: state.diceValue, pieceIndex: moves[0],
                  fromSteps: result.fromSteps, toSteps: result.toSteps,
                  ...captureFields(result), timestamp: Date.now(),
                });
                if (!state.winner) nextTurn(state, result.extraTurn);
              } else {
                nextTurn(state, false);
              }
            } else {
              nextTurn(state, false);
            }
          } else {
            nextTurn(state, false);
          }
          io.to(info.roomId).emit('game:stateUpdate', serializeGameState(state));
          const nextP = state.players[state.currentPlayerIndex];
          if (nextP?.isBot && state.phase === 'playing') {
            scheduleBotTurn(io, info.roomId, 400);
          }
        }
      }
      
      io.to(info.roomId).emit('room:updated', {
        players: state.players.map(p => ({ id: p.id, name: p.name, color: p.color, isBot: p.isBot, isConnected: p.isConnected })),
        hostId: state.players[0]?.id,
      });
      void saveRoomSnapshot(info.roomId);
    }
    
    socketToRoom.delete(socket.id);
    socketToPlayer.delete(socket.id);
    console.log(`[Ludo] Disconnected: ${socket.id}`);
  });
});

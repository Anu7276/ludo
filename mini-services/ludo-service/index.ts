import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

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

function canMovePiece(state: GameState, playerIndex: number, pieceIndex: number, diceValue: number): boolean {
  const player = state.players[playerIndex];
  if (!player) return false;
  const piece = player.pieces[pieceIndex];
  if (!piece || piece.state === 'finished') return false;
  if (piece.state === 'home') return diceValue === 6;
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

function checkAndCapture(state: GameState, movingPlayer: Player, movingPiece: Piece): { color: PlayerColor; pieceIndex: number } | null {
  if (movingPiece.steps < 1 || movingPiece.steps > 51) return null;
  const pathIndex = getMainPathIndex(movingPlayer.color, movingPiece.steps);
  if (isSafeZone(pathIndex)) return null;
  for (const opponent of state.players) {
    if (opponent.color === movingPlayer.color) continue;
    for (const piece of opponent.pieces) {
      if (piece.state !== 'active' || piece.steps < 1 || piece.steps > 51) continue;
      if (getMainPathIndex(opponent.color, piece.steps) === pathIndex) {
        piece.state = 'home';
        piece.steps = 0;
        return { color: opponent.color, pieceIndex: piece.index };
      }
    }
  }
  return null;
}

function executeMove(state: GameState, playerIndex: number, pieceIndex: number, diceValue: number): any {
  const player = state.players[playerIndex];
  if (!player) return { success: false, pieceIndex, fromSteps: 0, toSteps: 0, reason: 'Player not found' };
  const piece = player.pieces[pieceIndex];
  if (!piece) return { success: false, pieceIndex, fromSteps: 0, toSteps: 0, reason: 'Piece not found' };
  const fromSteps = piece.steps;

  if (piece.state === 'home') {
    if (diceValue !== 6) return { success: false, pieceIndex, fromSteps, toSteps: fromSteps, reason: 'Need 6' };
    if (player.pieces.some(p => p.index !== pieceIndex && p.state === 'active' && p.steps === 1)) {
      return { success: false, pieceIndex, fromSteps, toSteps: fromSteps, reason: 'Blocked' };
    }
    piece.state = 'active';
    piece.steps = 1;
    const captured = checkAndCapture(state, player, piece);
    return { success: true, pieceIndex, fromSteps: 0, toSteps: 1, captured, enteredBoard: true, extraTurn: true };
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

  let captured = null;
  if (newSteps >= 1 && newSteps <= 51) {
    captured = checkAndCapture(state, player, piece);
  }
  return { success: true, pieceIndex, fromSteps, toSteps: newSteps, captured, extraTurn: diceValue === 6 };
}

function nextTurn(state: GameState, hadExtraTurn: boolean = false): void {
  if (state.phase === 'finished') return;
  if (hadExtraTurn && state.consecutiveSixes < 3) {
    state.diceValue = null;
    state.diceRolled = false;
    return;
  }
  if (state.consecutiveSixes >= 3) {
    const player = state.players[state.currentPlayerIndex];
    if (player) {
      const lastRecord = state.turnHistory[state.turnHistory.length - 1];
      if (lastRecord && lastRecord.playerId === player.id) {
        const piece = player.pieces[lastRecord.pieceIndex];
        if (piece && piece.state === 'active') { piece.state = 'home'; piece.steps = 0; }
      }
    }
    state.consecutiveSixes = 0;
  }
  let nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  let attempts = 0;
  while (attempts < state.players.length) {
    const p = state.players[nextIndex];
    if (p && (p.isConnected || !p.isBot)) break;
    if (p && p.isBot && !p.isConnected) break;
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
    code: roomCodes.get(state.roomId) || '',
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

function handleBotTurn(io: Server, roomId: string, playerIndex: number) {
  const state = rooms.get(roomId);
  if (!state) return;
  
  const player = state.players[playerIndex];
  if (!player || !player.isBot) return;
  
  // Delay for realism
  setTimeout(() => {
    if (!rooms.has(roomId)) return;
    const currentState = rooms.get(roomId)!;
    if (currentState.phase !== 'playing' || currentState.currentPlayerIndex !== playerIndex) return;
    
    // Roll dice
    const diceValue = rollDice(currentState);
    io.to(roomId).emit('dice:rolled', {
      playerId: player.id,
      playerColor: player.color,
      value: diceValue,
    });
    
    // Get valid moves
    const validMoves = getValidMoves(currentState, playerIndex, diceValue);
    
    if (validMoves.length === 0) {
      // No valid moves, pass turn
      setTimeout(() => {
        if (!rooms.has(roomId)) return;
        const s = rooms.get(roomId)!;
        s.turnHistory.push({
          playerId: player.id, playerColor: player.color,
          diceValue, pieceIndex: -1, fromSteps: 0, toSteps: 0,
          captured: null, timestamp: Date.now(),
        });
        io.to(roomId).emit('turn:noMoves', { playerId: player.id, playerColor: player.color, diceValue });
        nextTurn(s, false);
        io.to(roomId).emit('game:stateUpdate', serializeGameState(s));
        
        // Check next player for bot
        const nextP = s.players[s.currentPlayerIndex];
        if (nextP?.isBot && s.phase === 'playing') {
          handleBotTurn(io, roomId, s.currentPlayerIndex);
        }
      }, 800);
      return;
    }
    
    // Select move
    const moveIdx = autoSelectMove(currentState, playerIndex, diceValue);
    
    setTimeout(() => {
      if (!rooms.has(roomId)) return;
      const s = rooms.get(roomId)!;
      if (s.phase !== 'playing' || s.currentPlayerIndex !== playerIndex) return;
      
      const result = executeMove(s, playerIndex, moveIdx, diceValue);
      
      s.turnHistory.push({
        playerId: player.id, playerColor: player.color,
        diceValue, pieceIndex: moveIdx,
        fromSteps: result.fromSteps, toSteps: result.toSteps,
        captured: result.captured || null, timestamp: Date.now(),
      });
      
      io.to(roomId).emit('piece:moved', {
        playerId: player.id, playerColor: player.color,
        pieceIndex: moveIdx, fromSteps: result.fromSteps, toSteps: result.toSteps,
        captured: result.captured || null, enteredBoard: result.enteredBoard,
        reachedHome: result.reachedHome,
      });
      
      if (s.phase === 'finished') {
        io.to(roomId).emit('game:finished', { winner: s.winner, winnerName: player.name });
        io.to(roomId).emit('game:stateUpdate', serializeGameState(s));
        return;
      }
      
      const hadExtraTurn = result.extraTurn && result.success;
      nextTurn(s, hadExtraTurn);
      io.to(roomId).emit('game:stateUpdate', serializeGameState(s));
      
      if (hadExtraTurn) {
        handleBotTurn(io, roomId, s.currentPlayerIndex);
      } else {
        const nextP = s.players[s.currentPlayerIndex];
        if (nextP?.isBot && s.phase === 'playing') {
          handleBotTurn(io, roomId, s.currentPlayerIndex);
        }
      }
    }, 1000);
  }, 1200);
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

const io = new Server({
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 10000,
  pingInterval: 5000,
});

io.on('connection', (socket) => {
  console.log(`[Ludo] Connected: ${socket.id}`);

  // Create a new room
  socket.on('room:create', (data: { playerName: string }, callback: (response: any) => void) => {
    const roomId = uuidv4();
    const code = generateRoomCode();
    const state = createGameState(roomId);
    
    const playerId = socket.id;
    const color = PLAYER_COLORS[0];
    state.players.push(createPlayer(playerId, data.playerName || 'Player 1', color));
    
    rooms.set(roomId, state);
    roomCodes.set(code, roomId);
    socketToRoom.set(socket.id, { roomId, playerId });
    socketToPlayer.set(socket.id, playerId);
    
    socket.join(roomId);
    
    callback({ success: true, roomId, code, color, playerCount: 1 });
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
    
    const playerId = socket.id;
    const color = PLAYER_COLORS[state.players.length];
    state.players.push(createPlayer(playerId, data.playerName || `Player ${state.players.length + 1}`, color));
    
    socketToRoom.set(socket.id, { roomId, playerId });
    socketToPlayer.set(socket.id, playerId);
    socket.join(roomId);
    
    callback({ success: true, roomId, code: data.code.toUpperCase(), color, playerCount: state.players.length });
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
    state.players.push(createPlayer(botId, botNames[state.players.length] || `Bot ${state.players.length + 1}`, color, true));
    
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
    
    callback({ success: true });
    io.to(info.roomId).emit('game:started', { gameState: serializeGameState(state) });
    io.to(info.roomId).emit('game:stateUpdate', serializeGameState(state));
    console.log(`[Ludo] Game started in room ${roomCodes.get(info.roomId)}`);
    
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
        io.to(info.roomId).emit('game:stateUpdate', serializeGameState(s));
        
        // Check if next is bot
        const nextP = s.players[s.currentPlayerIndex];
        if (nextP?.isBot && s.phase === 'playing') {
          handleBotTurn(io, info.roomId, s.currentPlayerIndex);
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
      captured: result.captured || null, timestamp: Date.now(),
    });
    
    callback({ success: true, result });
    io.to(info.roomId).emit('piece:moved', {
      playerId: info.playerId, playerColor: currentPlayer.color,
      pieceIndex: data.pieceIndex, fromSteps: result.fromSteps, toSteps: result.toSteps,
      captured: result.captured || null, enteredBoard: result.enteredBoard,
      reachedHome: result.reachedHome,
    });
    
    if (state.phase === 'finished') {
      io.to(info.roomId).emit('game:finished', { winner: state.winner, winnerName: currentPlayer.name });
      io.to(info.roomId).emit('game:stateUpdate', serializeGameState(state));
      return;
    }
    
    const hadExtraTurn = result.extraTurn;
    nextTurn(state, hadExtraTurn);
    io.to(info.roomId).emit('game:stateUpdate', serializeGameState(state));
    
    if (hadExtraTurn) {
      const p = state.players[state.currentPlayerIndex];
      if (p?.isBot && state.phase === 'playing') {
        handleBotTurn(io, info.roomId, state.currentPlayerIndex);
      }
    } else {
      const nextP = state.players[state.currentPlayerIndex];
      if (nextP?.isBot && state.phase === 'playing') {
        handleBotTurn(io, info.roomId, state.currentPlayerIndex);
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
    
    callback({ success: true, gameState: serializeGameState(state) });
    io.to(data.roomId).emit('room:updated', {
      players: state.players.map(p => ({ id: p.id, name: p.name, color: p.color, isBot: p.isBot, isConnected: p.isConnected })),
      hostId: state.players[0]?.id,
    });
    console.log(`[Ludo] Reconnected: ${data.playerId}`);
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
      }
      
      io.to(info.roomId).emit('room:updated', {
        players: state.players.map(p => ({ id: p.id, name: p.name, color: p.color, isBot: p.isBot, isConnected: p.isConnected })),
        hostId: state.players[0]?.id,
      });
    }
    
    socketToRoom.delete(socket.id);
    socketToPlayer.delete(socket.id);
    console.log(`[Ludo] Disconnected: ${socket.id}`);
  });
});

const PORT = 3003;
io.listen(PORT);
console.log(`[Ludo] Socket.io server running on port ${PORT}`);
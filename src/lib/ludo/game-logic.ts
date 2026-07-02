import { 
  GameState, Player, Piece, PlayerColor, MoveResult, CapturedPiece,
  PLAYER_COLORS, PieceState 
} from './types';
import { 
  getMainPathIndex, isSafeZone, MAIN_PATH, 
  getPiecePosition, HOME_BASE_POSITIONS 
} from './board';
import { v4 as uuidv4 } from 'uuid';

// Create a new piece
export function createPiece(color: PlayerColor, index: number): Piece {
  return {
    id: uuidv4(),
    color,
    index,
    state: 'home',
    steps: 0,
  };
}

// Create a new player
export function createPlayer(id: string, name: string, color: PlayerColor, isBot: boolean = false): Player {
  return {
    id,
    name,
    color,
    pieces: [
      createPiece(color, 0),
      createPiece(color, 1),
      createPiece(color, 2),
      createPiece(color, 3),
    ],
    isConnected: true,
    isBot,
  };
}

// Create initial game state
export function createGameState(roomId: string): GameState {
  return {
    roomId,
    phase: 'waiting',
    players: [],
    currentPlayerIndex: 0,
    diceValue: null,
    diceRolled: false,
    consecutiveSixes: 0,
    winner: null,
    turnHistory: [],
    createdAt: Date.now(),
  };
}

// Add a player to the game
export function addPlayer(state: GameState, playerId: string, name: string, isBot: boolean = false): PlayerColor | null {
  if (state.players.length >= 4) return null;
  if (state.phase !== 'waiting') return null;
  if (state.players.find(p => p.id === playerId)) return null;

  const color = PLAYER_COLORS[state.players.length];
  const player = createPlayer(playerId, name, color, isBot);
  state.players.push(player);
  return color;
}

// Remove a player from the game
export function removePlayer(state: GameState, playerId: string): void {
  const index = state.players.findIndex(p => p.id === playerId);
  if (index !== -1) {
    state.players.splice(index, 1);
    // Reassign colors
    state.players.forEach((p, i) => {
      p.color = PLAYER_COLORS[i];
      p.pieces.forEach(piece => {
        piece.color = PLAYER_COLORS[i];
      });
    });
  }
}

// Start the game
export function startGame(state: GameState): boolean {
  if (state.players.length < 2) return false;
  state.phase = 'playing';
  state.currentPlayerIndex = 0;
  state.diceValue = null;
  state.diceRolled = false;
  state.consecutiveSixes = 0;
  return true;
}

// Roll the dice
export function rollDice(state: GameState): number {
  const value = Math.floor(Math.random() * 6) + 1;
  state.diceValue = value;
  state.diceRolled = true;
  
  if (value === 6) {
    state.consecutiveSixes++;
  } else {
    state.consecutiveSixes = 0;
  }
  
  return value;
}

// Check if a player has any valid moves
export function hasValidMoves(state: GameState, playerIndex: number, diceValue: number): boolean {
  const player = state.players[playerIndex];
  if (!player) return false;
  
  for (const piece of player.pieces) {
    if (canMovePiece(state, playerIndex, piece.index, diceValue)) {
      return true;
    }
  }
  return false;
}

// Check if a specific piece can move
export function canMovePiece(state: GameState, playerIndex: number, pieceIndex: number, diceValue: number): boolean {
  const player = state.players[playerIndex];
  if (!player) return false;
  
  const piece = player.pieces[pieceIndex];
  if (!piece || piece.state === 'finished') return false;
  
  // If piece is in home, need a 6 to come out
  if (piece.state === 'home') {
    if (diceValue !== 6) return false;
    const startOccupied = player.pieces.some(
      p => p.index !== pieceIndex && p.state === 'active' && p.steps === 1
    );
    return !startOccupied;
  }
  
  // Check if the move would exceed the home
  const newSteps = piece.steps + diceValue;
  if (newSteps > 57) return false;
  
  // Check if destination in home column is blocked by own piece
  if (newSteps >= 52 && newSteps <= 56) {
    const ownPiecesAtDest = player.pieces.filter(
      p => p.index !== pieceIndex && p.steps === newSteps && p.state === 'active'
    );
    if (ownPiecesAtDest.length > 0) return false;
  }
  
  // If on the common path, check for own pieces at destination
  if (newSteps >= 1 && newSteps <= 51) {
    const destPathIndex = getMainPathIndex(player.color, newSteps);
    const ownPiecesAtDest = player.pieces.filter(p => {
      if (p.index === pieceIndex || p.state !== 'active') return false;
      if (p.steps < 1 || p.steps > 51) return false;
      return getMainPathIndex(player.color, p.steps) === destPathIndex;
    });
    if (ownPiecesAtDest.length > 0) return false;
  }
  
  return true;
}

// Get all valid moves for a player
export function getValidMoves(state: GameState, playerIndex: number, diceValue: number): number[] {
  const moves: number[] = [];
  const player = state.players[playerIndex];
  if (!player) return moves;
  
  for (let i = 0; i < 4; i++) {
    if (canMovePiece(state, playerIndex, i, diceValue)) {
      moves.push(i);
    }
  }
  return moves;
}

// Execute a move
export function executeMove(state: GameState, playerIndex: number, pieceIndex: number, diceValue: number): MoveResult {
  const player = state.players[playerIndex];
  if (!player) {
    return { success: false, pieceIndex, fromSteps: 0, toSteps: 0, reason: 'Player not found' };
  }
  
  const piece = player.pieces[pieceIndex];
  if (!piece) {
    return { success: false, pieceIndex, fromSteps: 0, toSteps: 0, reason: 'Piece not found' };
  }
  
  const fromSteps = piece.steps;
  
  // Piece in home - coming out on 6
  if (piece.state === 'home') {
    if (diceValue !== 6) {
      return { success: false, pieceIndex, fromSteps, toSteps: fromSteps, reason: 'Need 6 to leave home' };
    }
    
    // Check if start position is blocked by own piece
    const startOccupied = player.pieces.some(
      p => p.index !== pieceIndex && p.state === 'active' && p.steps === 1
    );
    if (startOccupied) {
      return { success: false, pieceIndex, fromSteps, toSteps: fromSteps, reason: 'Start position blocked by own piece' };
    }
    
    piece.state = 'active';
    piece.steps = 1;
    
    // Check for capture at start position
    const captures = checkAndCapture(state, player, piece);
    
    return {
      success: true,
      pieceIndex,
      fromSteps: 0,
      toSteps: 1,
      captures,
      captured: captures[0],
      enteredBoard: true,
      extraTurn: true, // 6 gives extra turn
    };
  }
  
  // Piece on board
  const newSteps = piece.steps + diceValue;
  
  if (newSteps > 57) {
    return { success: false, pieceIndex, fromSteps, toSteps: fromSteps, reason: 'Cannot exceed home' };
  }
  
  piece.steps = newSteps;
  
  // Check if reached home
  if (newSteps === 57) {
    piece.state = 'finished';
    
    // Check if all pieces are finished
    const allFinished = player.pieces.every(p => p.state === 'finished');
    if (allFinished) {
      state.winner = player.color;
      state.phase = 'finished';
    }
    
    return {
      success: true,
      pieceIndex,
      fromSteps,
      toSteps: newSteps,
      reachedHome: true,
      extraTurn: diceValue === 6,
    };
  }
  
  // Check for capture (only on common path, not in home column)
  let captures: CapturedPiece[] = [];
  if (newSteps >= 1 && newSteps <= 51) {
    captures = checkAndCapture(state, player, piece);
  }
  
  return {
    success: true,
    pieceIndex,
    fromSteps,
    toSteps: newSteps,
    captures,
    captured: captures[0],
    extraTurn: diceValue === 6 || captures.length > 0,
  };
}

// Check if a piece captures any opponent pieces at its position
function checkAndCapture(state: GameState, movingPlayer: Player, movingPiece: Piece): CapturedPiece[] {
  if (movingPiece.steps < 1 || movingPiece.steps > 51) return [];
  
  const pathIndex = getMainPathIndex(movingPlayer.color, movingPiece.steps);
  
  // Can't capture on safe zones
  if (isSafeZone(pathIndex)) return [];
  
  const captured: CapturedPiece[] = [];
  for (const opponent of state.players) {
    if (opponent.color === movingPlayer.color) continue;
    
    for (const piece of opponent.pieces) {
      if (piece.state !== 'active') continue;
      if (piece.steps < 1 || piece.steps > 51) continue;
      
      const opponentPathIndex = getMainPathIndex(opponent.color, piece.steps);
      if (opponentPathIndex === pathIndex) {
        piece.state = 'home';
        piece.steps = 0;
        captured.push({ color: opponent.color, pieceIndex: piece.index });
      }
    }
  }
  
  return captured;
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

// Advance to next player's turn
export function nextTurn(state: GameState, hadExtraTurn: boolean = false): void {
  if (state.phase === 'finished') return;
  
  if (hadExtraTurn && state.consecutiveSixes < 3) {
    // Same player gets another turn
    state.diceValue = null;
    state.diceRolled = false;
    return;
  }
  
  // Check for 3 consecutive sixes - penalize
  if (state.consecutiveSixes >= 3) {
    applyTripleSixPenalty(state, state.currentPlayerIndex);
    state.consecutiveSixes = 0;
  }
  
  // Move to next player (skip disconnected humans; bots always play)
  let nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  let attempts = 0;
  while (attempts < state.players.length) {
    const nextPlayer = state.players[nextIndex];
    if (nextPlayer && (nextPlayer.isConnected || nextPlayer.isBot)) break;
    nextIndex = (nextIndex + 1) % state.players.length;
    attempts++;
  }
  
  state.currentPlayerIndex = nextIndex;
  state.diceValue = null;
  state.diceRolled = false;
  state.consecutiveSixes = 0;
}

// Record a turn in history
export function recordTurn(
  state: GameState, 
  playerId: string, 
  playerColor: PlayerColor, 
  diceValue: number, 
  pieceIndex: number, 
  fromSteps: number, 
  toSteps: number, 
  captured: CapturedPiece | null,
  captures?: CapturedPiece[],
): void {
  state.turnHistory.push({
    playerId,
    playerColor,
    diceValue,
    pieceIndex,
    fromSteps,
    toSteps,
    captured,
    captures: captures ?? (captured ? [captured] : []),
    timestamp: Date.now(),
  });
}

// Get movable pieces count
export function getMovablePiecesCount(state: GameState, playerIndex: number, diceValue: number): number {
  return getValidMoves(state, playerIndex, diceValue).length;
}

// Get all pieces at a specific grid position (for rendering stacking)
export function getPiecesAtPosition(
  state: GameState, 
  row: number, 
  col: number
): { playerIndex: number; pieceIndex: number; color: PlayerColor; steps: number }[] {
  const pieces: { playerIndex: number; pieceIndex: number; color: PlayerColor; steps: number }[] = [];
  
  state.players.forEach((player, playerIndex) => {
    player.pieces.forEach((piece, pieceIndex) => {
      if (piece.state === 'finished' && row === 7 && col === 7) {
        pieces.push({ playerIndex, pieceIndex, color: player.color, steps: 57 });
        return;
      }
      if (piece.state === 'home') return;
      
      const pos = getPiecePosition(piece.color, piece.steps);
      if (pos[0] === row && pos[1] === col) {
        pieces.push({ playerIndex, pieceIndex, color: player.color, steps: piece.steps });
      }
    });
  });
  
  return pieces;
}

// Auto-select the best move for AI/bot
export function autoSelectMove(state: GameState, playerIndex: number, diceValue: number): number {
  const validMoves = getValidMoves(state, playerIndex, diceValue);
  if (validMoves.length === 0) return -1;
  if (validMoves.length === 1) return validMoves[0];
  
  const player = state.players[playerIndex];
  if (!player) return validMoves[0];
  
  // Priority: capture > leave home > advance furthest piece > default
  let bestMove = validMoves[0];
  let bestScore = -Infinity;
  
  for (const moveIdx of validMoves) {
    let score = 0;
    const piece = player.pieces[moveIdx];
    
    if (!piece) continue;
    
    // Simulate the move
    let newSteps: number;
    if (piece.state === 'home') {
      newSteps = 1; // Coming out on 6
    } else {
      newSteps = piece.steps + diceValue;
    }
    
    // Reaching home is highest priority
    if (newSteps === 57) {
      score = 1000;
    }
    // Entering home column is good
    else if (newSteps >= 52) {
      score = 500 + newSteps;
    }
    // Leaving home is good
    else if (piece.state === 'home') {
      score = 300;
    }
    // Check for potential capture
    else if (newSteps >= 1 && newSteps <= 51) {
      const destPathIndex = getMainPathIndex(player.color, newSteps);
      if (!isSafeZone(destPathIndex)) {
        // Check if opponent is at destination
        for (const opponent of state.players) {
          if (opponent.color === player.color) continue;
          for (const op of opponent.pieces) {
            if (op.state !== 'active' || op.steps < 1 || op.steps > 51) continue;
            if (getMainPathIndex(opponent.color, op.steps) === destPathIndex) {
              score += 400; // Capture opportunity
            }
          }
        }
      }
      
      // Prefer moving pieces that are further along
      score += piece.steps;
      
      // Avoid safe zones if we're ahead (waste of movement)
      // Actually, safe zones are generally good for defense
      if (isSafeZone(destPathIndex)) {
        score += 50;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = moveIdx;
    }
  }
  
  return bestMove;
}
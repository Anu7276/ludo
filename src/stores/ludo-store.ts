import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { PlayerColor, PieceState, GamePhase } from '@/lib/ludo/types';

export interface PieceData {
  id: string;
  color: PlayerColor;
  index: number;
  state: PieceState;
  steps: number;
}

export interface PlayerData {
  id: string;
  name: string;
  color: PlayerColor;
  isConnected: boolean;
  isBot: boolean;
  pieces: PieceData[];
}

export interface SerializedGameState {
  roomId: string;
  phase: GamePhase;
  players: PlayerData[];
  currentPlayerIndex: number;
  diceValue: number | null;
  diceRolled: boolean;
  winner: PlayerColor | null;
  turnHistory: any[];
}

export interface RoomPlayer {
  id: string;
  name: string;
  color: PlayerColor;
  isBot: boolean;
  isConnected: boolean;
}

export interface ChatMessage {
  playerId: string;
  playerName: string;
  playerColor: PlayerColor;
  message: string;
  timestamp: number;
}

interface LudoStore {
  // Connection
  socket: Socket | null;
  connected: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';
  
  // Player info
  playerId: string;
  playerName: string;
  playerColor: PlayerColor | null;
  
  // Room
  roomId: string | null;
  roomCode: string | null;
  hostId: string | null;
  roomPlayers: RoomPlayer[];
  
  // Game state
  gamePhase: GamePhase;
  gameState: SerializedGameState | null;
  diceValue: number | null;
  diceRolled: boolean;
  isMyTurn: boolean;
  validMoves: number[];
  winner: PlayerColor | null;
  
  // Chat
  chatMessages: ChatMessage[];
  sendChatMessage: (message: string) => void;
  
  // Sound
  soundMuted: boolean;
  toggleSound: () => void;
  
  // UI state
  showLobby: boolean;
  showGame: boolean;
  error: string | null;
  lastAction: string | null;
  
  // Actions
  connect: () => void;
  createRoom: (playerName: string) => Promise<{ roomId: string; code: string; color: PlayerColor } | null>;
  joinRoom: (code: string, playerName: string) => Promise<{ roomId: string; code: string; color: PlayerColor } | null>;
  addBot: () => void;
  removeBot: () => void;
  startGame: () => void;
  rollDice: () => Promise<number | null>;
  movePiece: (pieceIndex: number) => Promise<boolean>;
  leaveRoom: () => void;
  restartGame: () => void;
  
  // Internal
  _setGameState: (state: SerializedGameState) => void;
  _setRoomPlayers: (players: RoomPlayer[], hostId: string) => void;
  _setError: (error: string | null) => void;
  _setDiceValue: (value: number | null) => void;
  _setValidMoves: (moves: number[]) => void;
}

export const useLudoStore = create<LudoStore>((set, get) => ({
  socket: null,
  connected: false,
  connectionStatus: 'disconnected',
  playerId: '',
  playerName: '',
  playerColor: null,
  roomId: null,
  roomCode: null,
  hostId: null,
  roomPlayers: [],
  gamePhase: 'waiting',
  gameState: null,
  diceValue: null,
  diceRolled: false,
  isMyTurn: false,
  validMoves: [],
  winner: null,
  chatMessages: [],
  soundMuted: false,
  showLobby: true,
  showGame: false,
  error: null,
  lastAction: null,

  connect: () => {
    const existing = get().socket;
    // Prevent duplicate connections
    if (existing) {
      if (!existing.connected) {
        existing.removeAllListeners();
        existing.disconnect();
      } else {
        return; // Already connected
      }
    }

    set({ connectionStatus: 'connecting' });

    const configuredSocketUrl = process.env.NEXT_PUBLIC_LUDO_SOCKET_URL;
    const socketUrl =
      configuredSocketUrl ||
      (typeof window !== 'undefined' && window.location.port === '3000'
        ? 'http://localhost:3003'
        : '/?XTransformPort=3003');

    const socket = io(socketUrl, {
      path: process.env.NEXT_PUBLIC_LUDO_SOCKET_PATH || '/',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    // Store socket immediately to prevent duplicate creation
    set({ socket });

    socket.on('connect', () => {
      console.log('[Ludo] Connected to server, id=', socket.id);
      set({ connected: true, playerId: socket.id || '', connectionStatus: 'connected' });
    });

    socket.on('disconnect', (reason) => {
      console.log('[Ludo] Disconnected from server:', reason);
      set({ connected: false, connectionStatus: reason === 'io server disconnect' ? 'disconnected' : 'reconnecting' });
    });

    socket.on('connect_error', (err) => {
      console.warn('[Ludo] Connection error:', err.message);
      set({ connectionStatus: 'error' });
    });

    socket.io.on('reconnect_attempt', (attempt) => {
      console.log('[Ludo] Reconnect attempt', attempt);
      set({ connectionStatus: 'reconnecting' });
    });

    socket.io.on('reconnect', () => {
      console.log('[Ludo] Reconnected');
      set({ connectionStatus: 'connected', connected: true });
    });

    socket.io.on('reconnect_failed', () => {
      console.error('[Ludo] Reconnect failed');
      set({ connectionStatus: 'error' });
    });

    socket.on('room:updated', (data: { players: RoomPlayer[]; hostId: string }) => {
      get()._setRoomPlayers(data.players, data.hostId);
    });

    socket.on('game:started', (data: { gameState: SerializedGameState }) => {
      set({ 
        gamePhase: 'playing',
        gameState: data.gameState,
        showLobby: false,
        showGame: true,
      });
      const { playerId } = get();
      const currentPlayer = data.gameState.players[data.gameState.currentPlayerIndex];
      set({ isMyTurn: currentPlayer?.id === playerId });
    });

    socket.on('game:stateUpdate', (state: SerializedGameState) => {
      get()._setGameState(state);
    });

    socket.on('dice:rolled', (data: { playerId: string; playerColor: PlayerColor; value: number }) => {
      get()._setDiceValue(data.value);
      const { playerId } = get();
      if (data.playerId === playerId) {
        // Get valid moves
        socket.emit('game:getValidMoves', {}, (response: { success: boolean; moves: number[] }) => {
          if (response.success) {
            set({ validMoves: response.moves });
          }
        });
      }
    });

    socket.on('turn:noMoves', (data: { playerId: string; playerColor: PlayerColor; diceValue: number }) => {
      set({ lastAction: `No valid moves for ${data.playerColor}`, validMoves: [] });
    });

    socket.on('piece:moved', (data: { 
      playerId: string; playerColor: PlayerColor;
      pieceIndex: number; fromSteps: number; toSteps: number;
      captured: any; enteredBoard?: boolean; reachedHome?: boolean;
    }) => {
      const action = data.reachedHome 
        ? `${data.playerColor} piece reached home! 🎉` 
        : data.captured 
          ? `${data.playerColor} captured ${data.captured.color}'s piece! ⚔️` 
          : data.enteredBoard 
            ? `${data.playerColor} piece entered the board` 
            : `${data.playerColor} moved piece ${data.pieceIndex + 1}`;
      set({ lastAction: action, validMoves: [] });
    });

    socket.on('game:finished', (data: { winner: PlayerColor; winnerName: string }) => {
      set({ 
        winner: data.winner,
        gamePhase: 'finished',
        lastAction: `🏆 ${data.winnerName} (${data.winner}) wins the game!`,
      });
    });

    socket.on('player:disconnected', (data: { playerId: string }) => {
      set({ lastAction: `A player disconnected` });
    });

    socket.on('chat:message', (data: ChatMessage) => {
      const { chatMessages } = get();
      set({ chatMessages: [...chatMessages.slice(-49), data] }); // Keep last 50 messages
    });

    set({ socket });
  },

  createRoom: async (playerName: string) => {
    const { socket } = get();
    if (!socket) return null;

    return new Promise((resolve) => {
      socket.emit('room:create', { playerName }, (response: any) => {
        if (response.success) {
          set({
            roomId: response.roomId,
            roomCode: response.code,
            playerColor: response.color,
            playerName,
            hostId: socket.id,
            showLobby: true,
            showGame: false,
            error: null,
          });
          resolve({ roomId: response.roomId, code: response.code, color: response.color });
        } else {
          set({ error: response.error });
          resolve(null);
        }
      });
    });
  },

  joinRoom: async (code: string, playerName: string) => {
    const { socket } = get();
    if (!socket) return null;

    return new Promise((resolve) => {
      socket.emit('room:join', { code, playerName }, (response: any) => {
        if (response.success) {
          set({
            roomId: response.roomId,
            roomCode: response.code,
            playerColor: response.color,
            playerName,
            showLobby: true,
            showGame: false,
            error: null,
          });
          resolve({ roomId: response.roomId, code: response.code, color: response.color });
        } else {
          set({ error: response.error });
          resolve(null);
        }
      });
    });
  },

  addBot: () => {
    const { socket } = get();
    if (!socket) return;
    socket.emit('room:addBot', {}, (response: any) => {
      if (!response.success) set({ error: response.error });
    });
  },

  removeBot: () => {
    const { socket } = get();
    if (!socket) return;
    socket.emit('room:removeBot', {}, (response: any) => {
      if (!response.success) set({ error: response.error });
    });
  },

  startGame: () => {
    const { socket } = get();
    if (!socket) return;
    socket.emit('game:start', {}, (response: any) => {
      if (!response.success) set({ error: response.error });
    });
  },

  rollDice: async () => {
    const { socket } = get();
    if (!socket) return null;

    return new Promise((resolve) => {
      socket.emit('dice:roll', {}, (response: any) => {
        if (response.success) {
          resolve(response.value);
        } else {
          set({ error: response.error });
          resolve(null);
        }
      });
    });
  },

  movePiece: async (pieceIndex: number) => {
    const { socket } = get();
    if (!socket) return false;

    return new Promise((resolve) => {
      socket.emit('piece:move', { pieceIndex }, (response: any) => {
        if (response.success) {
          set({ validMoves: [] });
          resolve(true);
        } else {
          set({ error: response.error });
          resolve(false);
        }
      });
    });
  },

  sendChatMessage: (message: string) => {
    const { socket } = get();
    if (!socket || !message.trim()) return;
    socket.emit('chat:message', { message: message.trim() });
  },

  toggleSound: () => set(state => ({ soundMuted: !state.soundMuted })),

  leaveRoom: () => {
    const { socket, roomId } = get();
    if (socket && roomId) {
      socket.emit('room:leave');
    }
    set({
      roomId: null,
      roomCode: null,
      playerColor: null,
      hostId: null,
      roomPlayers: [],
      gamePhase: 'waiting',
      gameState: null,
      diceValue: null,
      diceRolled: false,
      isMyTurn: false,
      validMoves: [],
      winner: null,
      chatMessages: [],
      showLobby: true,
      showGame: false,
      error: null,
      lastAction: null,
    });
  },

  restartGame: () => {
    const { socket } = get();
    if (!socket) return;
    socket.emit('game:restart', {}, (response: any) => {
      if (response.success) {
        set({ winner: null, lastAction: null, gamePhase: 'waiting', showLobby: true, showGame: false });
      } else {
        set({ error: response.error });
      }
    });
  },

  _setGameState: (state: SerializedGameState) => {
    const { playerId } = get();
    const currentPlayer = state.players[state.currentPlayerIndex];
    set({
      gameState: state,
      gamePhase: state.phase,
      diceValue: state.diceValue,
      diceRolled: state.diceRolled,
      isMyTurn: currentPlayer?.id === playerId && state.phase === 'playing',
      winner: state.winner,
    });
  },

  _setRoomPlayers: (players: RoomPlayer[], hostId: string) => {
    const { playerId } = get();
    const me = players.find(p => p.id === playerId);
    set({ 
      roomPlayers: players, 
      hostId,
      playerColor: me?.color || get().playerColor,
    });
  },

  _setError: (error: string | null) => set({ error }),
  _setDiceValue: (value: number | null) => set({ diceValue: value }),
  _setValidMoves: (moves: number[]) => set({ validMoves: moves }),
}));

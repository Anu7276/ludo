'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLudoStore, RoomPlayer } from '@/stores/ludo-store';
import { PlayerColor, PLAYER_COLOR_HEX, PLAYER_COLOR_DARK } from '@/lib/ludo/types';
import { Badge } from '@/components/ui/badge';
import { Crown, Bot, Wifi, WifiOff, Home, ArrowRight } from 'lucide-react';

export default function PlayerPanel() {
  const {
    gameState,
    roomPlayers,
    currentPlayerIndex,
    isMyTurn,
    diceValue,
    diceRolled,
    lastAction,
    winner,
    playerColor: myColor,
    playerId,
  } = useLudoStore();

  const players = gameState?.players || [];

  const getProgress = (color: PlayerColor): number => {
    const player = players.find(p => p.color === color);
    if (!player) return 0;
    let total = 0;
    for (const piece of player.pieces) {
      total += piece.state === 'finished' ? 57 : piece.steps;
    }
    return Math.round((total / (57 * 4)) * 100);
  };

  const getFinishedCount = (color: PlayerColor): number => {
    const player = players.find(p => p.color === color);
    if (!player) return 0;
    return player.pieces.filter(p => p.state === 'finished').length;
  };

  const getActiveCount = (color: PlayerColor): number => {
    const player = players.find(p => p.color === color);
    if (!player) return 0;
    return player.pieces.filter(p => p.state === 'active').length;
  };

  const getHomeCount = (color: PlayerColor): number => {
    const player = players.find(p => p.color === color);
    if (!player) return 0;
    return player.pieces.filter(p => p.state === 'home').length;
  };

  const rp = (color: PlayerColor) => roomPlayers.find(p => p.color === color);

  return (
    <div className="w-full max-w-xs mx-auto lg:mx-0 space-y-3">
      {/* Turn indicator */}
      <motion.div
        key={currentPlayerIndex}
        initial={{ scale: 0.95, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`
          rounded-xl p-3 text-center font-bold text-sm shadow-sm border-2
          ${winner
            ? 'bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-300'
            : isMyTurn
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300'
              : 'bg-gray-50 border-gray-200'
          }
        `}
      >
        {winner ? (
          <span className="text-amber-700">
            🏆 <span style={{ color: PLAYER_COLOR_HEX[winner] }} className="font-black uppercase">{winner}</span> Wins!
          </span>
        ) : isMyTurn ? (
          <span className="text-green-700">
            🎲 Your Turn — {diceRolled ? 'Select a piece!' : 'Roll the dice!'}
          </span>
        ) : (
          <span className="text-gray-500">
            Waiting for{' '}
            <span style={{ color: PLAYER_COLOR_HEX[players[currentPlayerIndex]?.color || 'red'] }}>
              {players[currentPlayerIndex]?.name || '...'}
            </span>
          </span>
        )}
      </motion.div>

      {/* Player cards */}
      <div className="space-y-2">
        {(['red', 'green', 'yellow', 'blue'] as PlayerColor[]).map((color, idx) => {
          const player = players.find(p => p.color === color);
          const roomPlayer = rp(color);
          if (!player && !roomPlayer) return null;

          const isCurrentTurn = idx === currentPlayerIndex && !winner;
          const progress = getProgress(color);
          const finished = getFinishedCount(color);
          const active = getActiveCount(color);
          const home = getHomeCount(color);
          const isMe = player?.color === myColor;
          const isBot = roomPlayer?.isBot;
          const isDisconnected = roomPlayer && !roomPlayer.isConnected && !isBot;

          return (
            <motion.div
              key={color}
              layout
              initial={false}
              className={`
                rounded-xl p-3 transition-all duration-200 border-2
                ${isCurrentTurn
                  ? 'shadow-md'
                  : 'shadow-sm'
                }
              `}
              style={{
                backgroundColor: `${PLAYER_COLOR_HEX[color]}10`,
                borderColor: isCurrentTurn ? PLAYER_COLOR_HEX[color] : `${PLAYER_COLOR_HEX[color]}25`,
              }}
            >
              <div className="flex items-center gap-2.5">
                {/* Color dot */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm shrink-0"
                  style={{ backgroundColor: PLAYER_COLOR_HEX[color] }}
                >
                  {isBot ? (
                    <Bot className="w-4 h-4 text-white" />
                  ) : (
                    <span className="text-white text-xs font-bold">
                      {(player?.name || '?')[0].toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-gray-800 truncate">
                      {player?.name || roomPlayer?.name || color}
                    </p>
                    {isMe && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">You</Badge>
                    )}
                    {isBot && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">AI</Badge>
                    )}
                    {isDisconnected && (
                      <WifiOff className="w-3 h-3 text-red-400" />
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: PLAYER_COLOR_HEX[color] }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-gray-400 w-8 text-right">
                      {progress}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Piece status */}
              <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-500">
                <span className="flex items-center gap-1">
                  <Home className="w-3 h-3" /> {home}
                </span>
                <span className="flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" /> {active}
                </span>
                <span className="flex items-center gap-1">
                  ⭐ {finished}/4
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Last action */}
      <AnimatePresence mode="wait">
        {lastAction && (
          <motion.div
            key={lastAction}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-xs text-center text-gray-400 py-1 px-3 bg-gray-50 rounded-lg"
          >
            {lastAction}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Room code */}
      {roomPlayers.length > 0 && (
        <div className="text-center">
          <span className="text-[10px] text-gray-300 font-mono tracking-wider">
            ROOM: {useLudoStore.getState().roomCode}
          </span>
        </div>
      )}
    </div>
  );
}
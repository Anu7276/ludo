'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLudoStore, RoomPlayer } from '@/stores/ludo-store';
import { PlayerColor, PLAYER_COLOR_HEX, PLAYER_COLOR_DARK, PLAYER_COLOR_LIGHT } from '@/lib/ludo/types';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Crown, Bot, Wifi, WifiOff, Home, ArrowRight, Star, Users } from 'lucide-react';

export default function PlayerPanel() {
  const {
    gameState,
    roomPlayers,
    currentPlayerIndex,
    isMyTurn,
    lastAction,
    winner,
    playerColor: myColor,
    playerId,
    hostId,
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
  const currentPlayerName = players[currentPlayerIndex]?.name || '...';
  const currentPlayerColor = players[currentPlayerIndex]?.color || 'red';

  return (
    <div className="w-full max-w-xs mx-auto lg:mx-0 space-y-3">
      {/* Turn Indicator */}
      <motion.div
        key={winner ? 'winner' : isMyTurn ? 'myturn' : `turn-${currentPlayerIndex}`}
        initial={{ scale: 0.92, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={`
          rounded-2xl p-3.5 text-center font-bold text-sm shadow-sm border
          ${winner
            ? 'bg-gradient-to-r from-yellow-100 via-amber-50 to-yellow-100 border-yellow-300/60'
            : isMyTurn
              ? 'bg-gradient-to-r from-green-50 via-emerald-50 to-green-100 border-green-300/60'
              : 'bg-gray-50/80 border-gray-200/60'
          }
        `}
      >
        {winner ? (
          <span className="text-amber-700 flex items-center justify-center gap-1.5">
            <motion.span
              animate={{ rotate: [0, 15, -15, 10, -10, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 1.5 }}
              className="inline-block"
            >
              🏆
            </motion.span>
            <span style={{ color: PLAYER_COLOR_HEX[winner] }} className="font-black uppercase">
              {players.find(p => p.color === winner)?.name || winner}
            </span>
            <span className="font-bold">Wins!</span>
          </span>
        ) : isMyTurn ? (
          <span className="text-green-700 flex items-center justify-center gap-1.5">
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="inline-block"
            >
              🎲
            </motion.span>
            <span className="font-extrabold">Your Turn!</span>
            <span className="font-medium text-green-600">
              {isMyTurn && gameState?.diceRolled ? '— Select a piece!' : '— Roll the dice!'}
            </span>
          </span>
        ) : (
          <span className="text-gray-500 flex items-center justify-center gap-1.5">
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-block"
            >
              ⏳
            </motion.span>
            Waiting for{' '}
            <span style={{ color: PLAYER_COLOR_HEX[currentPlayerColor] }} className="font-bold">
              {currentPlayerName}
            </span>
            <span>...</span>
          </span>
        )}
      </motion.div>

      {/* Player Cards */}
      <div className="space-y-2.5 max-h-[calc(100vh-380px)] lg:max-h-96 overflow-y-auto pr-0.5 custom-scrollbar">
        {(['red', 'green', 'yellow', 'blue'] as PlayerColor[]).map((color) => {
          const player = players.find(p => p.color === color);
          const roomPlayer = rp(color);
          if (!player && !roomPlayer) return null;

          const isCurrentTurn = players[currentPlayerIndex]?.color === color && !winner;
          const progress = getProgress(color);
          const finished = getFinishedCount(color);
          const active = getActiveCount(color);
          const home = getHomeCount(color);
          const isMe = color === myColor;
          const isBot = roomPlayer?.isBot;
          const isHost = roomPlayer?.id === hostId;
          const isDisconnected = roomPlayer && !roomPlayer.isConnected && !isBot;
          const name = player?.name || roomPlayer?.name || color;

          return (
            <motion.div
              key={color}
              layout
              initial={false}
              animate={isCurrentTurn ? { scale: [1, 1.015, 1] } : { scale: 1 }}
              transition={isCurrentTurn ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : {}}
              className={`
                rounded-xl p-3 transition-all duration-300 border
                ${isCurrentTurn
                  ? 'shadow-lg relative overflow-hidden'
                  : 'shadow-sm hover:shadow-md'
                }
              `}
              style={{
                backgroundColor: `${PLAYER_COLOR_HEX[color]}08`,
                borderColor: isCurrentTurn
                  ? `${PLAYER_COLOR_HEX[color]}80`
                  : `${PLAYER_COLOR_HEX[color]}20`,
                boxShadow: isCurrentTurn
                  ? `0 0 15px -3px ${PLAYER_COLOR_HEX[color]}40, 0 0 30px -5px ${PLAYER_COLOR_HEX[color]}15`
                  : undefined,
              }}
            >
              {/* Glowing pulse overlay for active player */}
              {isCurrentTurn && (
                <motion.div
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  animate={{
                    boxShadow: [
                      `inset 0 0 0 0 ${PLAYER_COLOR_HEX[color]}00`,
                      `inset 0 0 20px 0 ${PLAYER_COLOR_HEX[color]}10`,
                      `inset 0 0 0 0 ${PLAYER_COLOR_HEX[color]}00`,
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              <div className="flex items-center gap-3 relative">
                {/* Avatar Circle */}
                <div className="relative shrink-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shadow-sm"
                    style={{
                      backgroundColor: PLAYER_COLOR_HEX[color],
                      boxShadow: isCurrentTurn
                        ? `0 0 12px 2px ${PLAYER_COLOR_HEX[color]}50`
                        : undefined,
                    }}
                  >
                    {isBot ? (
                      <Bot className="w-5 h-5 text-white" />
                    ) : (
                      <span className="text-white text-sm font-extrabold">
                        {name[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  {/* Online indicator */}
                  {!isBot && (
                    <div
                      className={`
                        absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white
                        ${isDisconnected ? 'bg-gray-400' : 'bg-green-400'}
                      `}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-bold text-gray-800 truncate">
                      {name}
                    </p>
                    {isMe && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] h-4 px-1.5 font-bold bg-primary/10 text-primary border-primary/20"
                      >
                        You
                      </Badge>
                    )}
                    {isBot && (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1.5 font-bold border-gray-300 text-gray-500"
                      >
                        AI
                      </Badge>
                    )}
                    {isHost && !isBot && (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1.5 font-bold border-amber-300 text-amber-600"
                      >
                        <Crown className="w-2.5 h-2.5 mr-0.5" />
                        Host
                      </Badge>
                    )}
                    {isDisconnected && (
                      <WifiOff className="w-3 h-3 text-red-400" />
                    )}
                  </div>

                  {/* Gradient Progress Bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: `linear-gradient(90deg, ${PLAYER_COLOR_DARK[color]}, ${PLAYER_COLOR_HEX[color]})`,
                        }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                    <span
                      className="text-[10px] font-bold w-8 text-right tabular-nums"
                      style={{ color: PLAYER_COLOR_HEX[color] }}
                    >
                      {progress}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Piece Status */}
              <div className="flex items-center gap-3 mt-2.5 text-[11px] text-gray-400 font-medium">
                <span className="flex items-center gap-1">
                  <Home className="w-3 h-3" />
                  <span>{home}</span>
                </span>
                <Separator orientation="vertical" className="h-3 bg-gray-200" />
                <span className="flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  <span>{active}</span>
                </span>
                <Separator orientation="vertical" className="h-3 bg-gray-200" />
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  <span>{finished}/4</span>
                </span>
                {/* Mini piece dots */}
                <div className="ml-auto flex items-center gap-1">
                  {player?.pieces.map((piece, i) => (
                    <div
                      key={i}
                      className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                      style={{
                        backgroundColor:
                          piece.state === 'finished'
                            ? PLAYER_COLOR_HEX[color]
                            : piece.state === 'active'
                              ? `${PLAYER_COLOR_HEX[color]}90`
                              : `${PLAYER_COLOR_HEX[color]}25`,
                        boxShadow:
                          piece.state === 'finished'
                            ? `0 0 4px ${PLAYER_COLOR_HEX[color]}`
                            : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Last Action with slide-in animation */}
      <AnimatePresence mode="wait">
        {lastAction && (
          <motion.div
            key={lastAction}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="text-xs text-center text-gray-400 py-2 px-4 bg-gray-50/80 rounded-xl border border-gray-100 font-medium"
          >
            {lastAction}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Room Code */}
      <div className="text-center pt-1">
        <div className="flex items-center justify-center gap-1.5">
          <Users className="w-3 h-3 text-gray-300" />
          <span className="text-[10px] text-gray-300 font-mono tracking-widest uppercase">
            Room: {useLudoStore.getState().roomCode}
          </span>
        </div>
      </div>
    </div>
  );
}
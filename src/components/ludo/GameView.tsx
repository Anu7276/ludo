'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useLudoStore } from '@/stores/ludo-store';
import { PlayerColor, PLAYER_COLOR_HEX } from '@/lib/ludo/types';
import LudoBoard from './LudoBoard';
import LudoDice from './LudoDice';
import PlayerPanel from './PlayerPanel';
import GameChat from './GameChat';
import { playDiceRoll, playPieceMove, playCapture, playPieceHome, playWin, playNoMoves } from '@/lib/sounds';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Trophy,
  RotateCcw,
  LogOut,
  Volume2,
  VolumeX,
  HelpCircle,
  Users,
  Dices,
  ChevronUp,
  Zap,
  Clock,
} from 'lucide-react';

// Dice face unicode symbols
const DICE_FACES: Record<number, string> = {
  1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅',
};

export default function GameView() {
  const {
    gameState,
    validMoves,
    playerColor,
    diceValue,
    diceRolled,
    isMyTurn,
    currentPlayerIndex,
    winner,
    gamePhase,
    lastAction,
    rollDice,
    movePiece,
    leaveRoom,
    restartGame,
    roomCode,
    soundMuted,
    toggleSound,
  } = useLudoStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const soundMutedRef = useRef(soundMuted);
  const confettiFired = useRef(false);
  const winnerRef = useRef<PlayerColor | null>(null);
  const [turnTimer, setTurnTimer] = useState(30);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Turn countdown timer  
  const isActive = isMyTurn && !diceRolled && !winner && gamePhase === 'playing';
  useEffect(() => {
    if (timerInterval.current) clearInterval(timerInterval.current);
    timerInterval.current = null;
    if (!isActive) return;
    const startTime = Date.now();
    timerInterval.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setTurnTimer(Math.max(0, 30 - elapsed));
      if (30 - elapsed <= 0 && timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    }, 250);
    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
        timerInterval.current = null;
      }
    };
  }, [isActive]);

  // Keep soundMuted ref in sync
  useEffect(() => {
    soundMutedRef.current = soundMuted;
  }, [soundMuted]);

  const currentPlayerColor = gameState?.players[currentPlayerIndex]?.color || null;
  const currentPlayerName = gameState?.players[currentPlayerIndex]?.name || '...';
  const winnerName = winner
    ? gameState?.players.find(p => p.color === winner)?.name || winner
    : null;

  // Fire confetti when winner is set
  useEffect(() => {
    if (winner && winner !== winnerRef.current && !confettiFired.current) {
      confettiFired.current = true;
      winnerRef.current = winner;

      const winnerColorHex = PLAYER_COLOR_HEX[winner];

      // Play win sound
      if (!soundMutedRef.current) playWin();

      // First burst
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: [winnerColorHex],
      });

      // Second burst - delayed
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.65 },
          colors: [winnerColorHex, '#FFD700', '#FFFFFF'],
        });
      }, 300);

      // Third burst - delayed
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.65 },
          colors: [winnerColorHex, '#FFD700', '#FFFFFF'],
        });
      }, 500);
    }

    // Reset confetti flag when winner changes to null (new game)
    if (!winner) {
      confettiFired.current = false;
      winnerRef.current = null;
    }
  }, [winner]);

  const handlePieceClick = useCallback(
    async (color: PlayerColor, pieceIndex: number) => {
      if (color !== playerColor) return;
      if (!validMoves.includes(pieceIndex)) return;
      await movePiece(pieceIndex);
    },
    [playerColor, validMoves, movePiece],
  );

  // Play sounds on game events
  useEffect(() => {
    if (!lastAction || soundMutedRef.current) return;
    if (lastAction.includes('captured')) {
      playCapture();
    } else if (lastAction.includes('reached home')) {
      playPieceHome();
    } else if (lastAction.includes('moved piece') || lastAction.includes('entered the board')) {
      playPieceMove();
    } else if (lastAction.includes('No valid moves')) {
      playNoMoves();
    }
  }, [lastAction]);

  const handleRoll = useCallback(async () => {
    if (!soundMutedRef.current) playDiceRoll();
    await rollDice();
  }, [rollDice]);

  // Auto-roll for extra turns
  useEffect(() => {
    if (isMyTurn && diceRolled && validMoves.length === 0 && gamePhase === 'playing') {
      // Server handles auto-pass
    }
  }, [isMyTurn, diceRolled, validMoves, gamePhase]);

  if (!gameState) return null;

  const myColorHex = playerColor ? PLAYER_COLOR_HEX[playerColor] : '#6B7280';

  return (
    <div className="h-[100dvh] flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-100 overflow-hidden">
      {/* ==================== GAME HEADER ==================== */}
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-200/80 px-4 py-2.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          {/* Player color indicator + Logo */}
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-400 via-yellow-400 to-green-400 flex items-center justify-center shadow-sm">
              <span className="text-white text-xs font-black">L</span>
            </div>
            <div
              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: myColorHex }}
            />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-none tracking-tight">
              Ludo Online
            </h1>
            <p className="text-[10px] text-gray-400 mt-0.5 font-mono tracking-wider">
              Room: {roomCode}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* How to Play */}
          <Dialog>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                    >
                      <HelpCircle className="w-4 h-4" />
                      <span className="sr-only">How to Play</span>
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>How to Play</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Dices className="w-5 h-5 text-amber-500" />
                  How to Play Ludo
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm text-gray-600 leading-relaxed pt-2">
                <div>
                  <h4 className="font-bold text-gray-800 mb-1">🎲 Objective</h4>
                  <p>Be the first player to move all 4 of your pieces from your home base to the center finish area.</p>
                </div>
                <Separator />
                <div>
                  <h4 className="font-bold text-gray-800 mb-1">🚀 Starting</h4>
                  <p>Roll a <strong>6</strong> to move a piece out of your home base onto the board. You get an extra turn when you roll a 6.</p>
                </div>
                <Separator />
                <div>
                  <h4 className="font-bold text-gray-800 mb-1">↩️ Movement</h4>
                  <p>Pieces move clockwise around the board. Roll the dice and tap a piece to move it forward by that number of steps.</p>
                </div>
                <Separator />
                <div>
                  <h4 className="font-bold text-gray-800 mb-1">⚔️ Capturing</h4>
                  <p>Land on an opponent&apos;s piece to send it back to their home base! You then get an extra turn.</p>
                </div>
                <Separator />
                <div>
                  <h4 className="font-bold text-gray-800 mb-1">🏠 Finishing</h4>
                  <p>Once a piece completes a full loop, it enters your home column. Roll the exact number needed to reach the center.</p>
                </div>
                <Separator />
                <div>
                  <h4 className="font-bold text-gray-800 mb-1">🏆 Winning</h4>
                  <p>The first player to get all 4 pieces into the center wins the game!</p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                  <p className="text-amber-700 text-xs font-medium">
                    💡 <strong>Tip:</strong> Rolling three 6&apos;s in a row will forfeit your turn!
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Sound Toggle */}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                  onClick={toggleSound}
                >
                  {soundMuted ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                  <span className="sr-only">{soundMuted ? 'Unmute' : 'Mute'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{soundMuted ? 'Unmute sounds' : 'Mute sounds'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {winner && (
            <Button
              variant="outline"
              size="sm"
              onClick={restartGame}
              className="h-8 text-xs font-semibold border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">New Game</span>
            </Button>
          )}

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={leaveRoom}
                  className="h-8 text-xs text-gray-400 hover:text-red-500"
                >
                  <LogOut className="w-3.5 h-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Leave</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Leave Room</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      {/* ==================== STATUS BAR ==================== */}
      <div className="bg-white/60 backdrop-blur-sm border-b border-gray-100 px-4 py-2">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Current Turn Indicator */}
          <div className="flex items-center gap-2 min-w-0">
            <motion.div
              key={currentPlayerColor}
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
              style={{ backgroundColor: PLAYER_COLOR_HEX[currentPlayerColor || 'red'] }}
            />
            <span className="text-xs font-semibold text-gray-600 truncate">
              {winner ? (
                <span style={{ color: PLAYER_COLOR_HEX[winner] }}>
                  🏆 {winnerName} Wins!
                </span>
              ) : isMyTurn ? (
                <span className="text-green-600">Your Turn</span>
              ) : (
                <span className="text-gray-500">{currentPlayerName}&apos;s Turn</span>
              )}
            </span>
          </div>

          {/* Dice Value Display */}
          <div className="flex items-center gap-2 shrink-0">
            {diceRolled && diceValue ? (
              <motion.div
                key={diceValue}
                initial={{ scale: 0.6, rotateZ: -10 }}
                animate={{ scale: 1, rotateZ: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="flex items-center gap-1.5 bg-white rounded-lg px-2.5 py-1 shadow-sm border border-gray-100"
              >
                <span className="text-lg leading-none">{DICE_FACES[diceValue] || ''}</span>
                <span className="text-sm font-black text-gray-700 tabular-nums">{diceValue}</span>
              </motion.div>
            ) : (
              <div className="flex items-center gap-1.5 text-gray-300 px-2.5 py-1">
                <Dices className="w-4 h-4" />
                <span className="text-xs text-gray-300">--</span>
              </div>
            )}
          </div>

          {/* Turn Timer (when it's player's turn and hasn't rolled) */}
          {isMyTurn && !diceRolled && !winner && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span
                className={`text-sm font-mono font-bold tabular-nums ${
                  turnTimer <= 10 ? 'text-red-500 animate-pulse' : turnTimer <= 20 ? 'text-amber-500' : 'text-gray-500'
                }`}
              >
                {turnTimer}s
              </span>
            </div>
          )}

          {/* Last Action (hidden on small mobile) */}
          <div className="hidden sm:flex items-center gap-1.5 min-w-0 max-w-[200px]">
            <AnimatePresence mode="wait">
              {lastAction && (
                <motion.span
                  key={lastAction}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.25 }}
                  className="text-[11px] text-gray-400 truncate font-medium"
                >
                  {lastAction}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ==================== MAIN CONTENT ==================== */}
      <main className="flex-1 flex items-center justify-center p-2 sm:p-4 lg:p-6 overflow-hidden">
        <div className="max-w-5xl w-full flex flex-col lg:flex-row items-center lg:items-start justify-center gap-2 sm:gap-4 lg:gap-6">
          {/* Board + Dice Column */}
          <div className="flex flex-col items-center gap-2 sm:gap-3 flex-shrink-0">
            <LudoBoard
              gameState={gameState}
              validMoves={validMoves}
              onPieceClick={handlePieceClick}
              myColor={playerColor}
            />

            {/* Dice below board */}
            <LudoDice
              value={diceValue}
              rolling={false}
              onRoll={handleRoll}
              disabled={!isMyTurn || diceRolled || !!winner}
              currentColor={currentPlayerColor}
            />

            {/* Mobile: Last Action */}
            <div className="sm:hidden w-full max-w-xs">
              <AnimatePresence mode="wait">
                {lastAction && (
                  <motion.div
                    key={lastAction}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="text-[11px] text-center text-gray-400 py-1.5 px-3 bg-gray-50/80 rounded-lg border border-gray-100 font-medium"
                  >
                    {lastAction}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Desktop Side Panel */}
          <div className="hidden lg:block w-72 shrink-0 pt-2">
            <PlayerPanel />
          </div>
        </div>
      </main>

      {/* ==================== MOBILE BOTTOM BAR ==================== */}
      <div className="lg:hidden bg-white/90 backdrop-blur-md border-t border-gray-200/80 px-3 py-2 flex items-center justify-between safe-area-bottom">
        <div className="flex items-center gap-2 min-w-0">
          <motion.div
            key={currentPlayerColor}
            animate={isMyTurn ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: PLAYER_COLOR_HEX[currentPlayerColor || 'red'] }}
          />
          <span className="text-xs font-semibold text-gray-600 truncate">
            {winner ? (
              <span style={{ color: PLAYER_COLOR_HEX[winner] }}>🏆 {winnerName} Wins!</span>
            ) : isMyTurn ? (
              <span className="text-green-600">
                <Zap className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                Your Turn{diceRolled ? ' — Tap!' : ' — Roll!'}
              </span>
            ) : (
              <span className="text-gray-400">{currentPlayerName}&apos;s turn</span>
            )}
          </span>
        </div>

        {/* Mini player color dots */}
        <div className="flex items-center gap-1">
          {gameState?.players.map((p) => (
            <motion.div
              key={p.color}
              animate={p.color === currentPlayerColor && !winner ? { scale: [1, 1.15, 1] } : { scale: 1 }}
              transition={{ duration: 1.5, repeat: p.color === currentPlayerColor && !winner ? Infinity : 0 }}
              className="w-3 h-3 rounded-full border border-white shadow-sm"
              style={{
                backgroundColor: PLAYER_COLOR_HEX[p.color],
                opacity: p.color === currentPlayerColor ? 1 : 0.5,
              }}
            />
          ))}
        </div>

        {/* Mobile Players Drawer Trigger */}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[11px] font-semibold gap-1 border-gray-200"
            >
              <Users className="w-3 h-3" />
              <ChevronUp className="w-2.5 h-2.5 text-gray-400" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[70vh]">
            <DrawerHeader className="text-center">
              <DrawerTitle className="flex items-center justify-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                Players
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-8">
              <PlayerPanel />
            </div>
          </DrawerContent>
        </Drawer>
      </div>

      {/* ==================== GAME CHAT ==================== */}
      <GameChat />

      {/* ==================== WINNER CELEBRATION MODAL ==================== */}
      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="bg-white rounded-3xl p-8 text-center shadow-2xl max-w-sm w-full relative overflow-hidden"
            >
              {/* Background glow */}
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  background: `radial-gradient(circle at 50% 30%, ${PLAYER_COLOR_HEX[winner]}, transparent 70%)`,
                }}
              />

              <div className="relative z-10">
                {/* Trophy with animation */}
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
                >
                  <motion.div
                    animate={{
                      rotate: [0, -8, 8, -5, 5, 0],
                      scale: [1, 1.1, 1],
                    }}
                    transition={{
                      duration: 1.5,
                      delay: 0.4,
                      repeat: Infinity,
                      repeatDelay: 2,
                      ease: 'easeInOut',
                    }}
                    className="inline-block"
                  >
                    <div
                      className="w-20 h-20 mx-auto rounded-full flex items-center justify-center shadow-lg"
                      style={{
                        background: `linear-gradient(135deg, ${PLAYER_COLOR_HEX[winner]}20, ${PLAYER_COLOR_HEX[winner]}05)`,
                        border: `2px solid ${PLAYER_COLOR_HEX[winner]}30`,
                      }}
                    >
                      <Trophy
                        className="w-10 h-10"
                        style={{ color: PLAYER_COLOR_HEX[winner] }}
                      />
                    </div>
                  </motion.div>
                </motion.div>

                {/* Title */}
                <motion.h2
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-2xl font-black text-gray-900 mt-5"
                >
                  Game Over!
                </motion.h2>

                {/* Winner Name */}
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.55 }}
                >
                  <p
                    className="text-xl font-black mt-2"
                    style={{ color: PLAYER_COLOR_HEX[winner] }}
                  >
                    {winnerName}
                  </p>
                  <p className="text-sm text-gray-400 mt-0.5 font-medium">
                    Wins the game! 🎉
                  </p>
                </motion.div>

                {/* Color pieces indicator */}
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="flex items-center justify-center gap-1.5 mt-4"
                >
                  {[0, 1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.8 + i * 0.1, type: 'spring' }}
                      className="w-4 h-4 rounded-full shadow-sm"
                      style={{
                        backgroundColor: PLAYER_COLOR_HEX[winner],
                        boxShadow: `0 0 8px ${PLAYER_COLOR_HEX[winner]}50`,
                      }}
                    />
                  ))}
                </motion.div>

                {/* Action Buttons */}
                <motion.div
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  className="flex gap-3 mt-7"
                >
                  <Button
                    variant="outline"
                    onClick={leaveRoom}
                    className="flex-1 h-11 font-semibold border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Leave Room
                  </Button>
                  <Button
                    onClick={restartGame}
                    className="flex-1 h-11 font-bold text-white transition-all hover:shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${PLAYER_COLOR_HEX[winner]}, ${PLAYER_COLOR_HEX[winner]}CC)`,
                    }}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Play Again
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
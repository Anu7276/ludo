'use client';

import React, { useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLudoStore } from '@/stores/ludo-store';
import { PlayerColor } from '@/lib/ludo/types';
import LudoBoard from './LudoBoard';
import LudoDice from './LudoDice';
import PlayerPanel from './PlayerPanel';
import { Button } from '@/components/ui/button';
import {
  Trophy,
  RotateCcw,
  LogOut,
  ArrowLeftRight,
} from 'lucide-react';

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
  } = useLudoStore();

  const currentPlayerColor = gameState?.players[currentPlayerIndex]?.color || null;

  const handlePieceClick = useCallback(
    async (color: PlayerColor, pieceIndex: number) => {
      if (color !== playerColor) return;
      if (!validMoves.includes(pieceIndex)) return;
      await movePiece(pieceIndex);
    },
    [playerColor, validMoves, movePiece],
  );

  const handleRoll = useCallback(async () => {
    await rollDice();
  }, [rollDice]);

  // Auto-roll for extra turns
  useEffect(() => {
    if (isMyTurn && diceRolled && validMoves.length === 0 && gamePhase === 'playing') {
      // Server handles auto-pass
    }
  }, [isMyTurn, diceRolled, validMoves, gamePhase]);

  if (!gameState) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Top Bar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-2.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400 flex items-center justify-center">
            <span className="text-white text-xs font-black">L</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-none">Ludo Online</h1>
            <p className="text-[10px] text-gray-400 mt-0.5">Room: {useLudoStore.getState().roomCode}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {winner && (
            <Button
              variant="outline"
              size="sm"
              onClick={restartGame}
              className="h-8 text-xs font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              New Game
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={leaveRoom}
            className="h-8 text-xs text-gray-400 hover:text-red-500"
          >
            <LogOut className="w-3.5 h-3.5 mr-1" />
            Leave
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-start justify-center p-3 sm:p-4 lg:p-6 gap-4 lg:gap-6 overflow-auto">
        {/* Board */}
        <div className="flex flex-col items-center gap-4">
          <LudoBoard
            gameState={gameState}
            validMoves={validMoves}
            onPieceClick={handlePieceClick}
            myColor={playerColor}
          />

          {/* Dice + Controls below board */}
          <div className="flex items-center gap-6">
            <LudoDice
              value={diceValue}
              rolling={false}
              onRoll={handleRoll}
              disabled={!isMyTurn || diceRolled || !!winner}
              currentColor={currentPlayerColor}
            />

            {/* Turn direction indicator */}
            <div className="hidden sm:flex flex-col items-center text-gray-300">
              <ArrowLeftRight className="w-5 h-5" />
              <span className="text-[10px] mt-1">Clockwise</span>
            </div>
          </div>
        </div>

        {/* Side Panel - Player Info */}
        <div className="hidden lg:block w-72 shrink-0 pt-2">
          <PlayerPanel />
        </div>
      </main>

      {/* Mobile Player Panel (bottom drawer) */}
      <div className="lg:hidden border-t border-gray-200 bg-white/80 backdrop-blur-md px-4 py-3">
        <PlayerPanel />
      </div>

      {/* Winner Modal */}
      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="bg-white rounded-3xl p-8 text-center shadow-2xl max-w-sm w-full"
            >
              <motion.div
                initial={{ rotate: -10 }}
                animate={{ rotate: [0, -10, 10, -5, 0] }}
                transition={{ duration: 1, delay: 0.3 }}
              >
                <Trophy className="w-16 h-16 mx-auto text-yellow-500" />
              </motion.div>

              <h2 className="text-2xl font-black text-gray-900 mt-4">
                Game Over!
              </h2>

              <motion.p
                className="text-lg font-bold mt-2"
                style={{
                  color: {
                    red: '#EF4444',
                    green: '#22C55E',
                    yellow: '#EAB308',
                    blue: '#3B82F6',
                  }[winner],
                }}
              >
                {gameState.players.find(p => p.color === winner)?.name || winner} Wins! 🎉
              </motion.p>

              <p className="text-sm text-gray-400 mt-1">
                Congratulations to the {winner} player!
              </p>

              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={leaveRoom}
                  className="flex-1 h-11 font-semibold"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Leave Room
                </Button>
                <Button
                  onClick={restartGame}
                  className="flex-1 h-11 font-bold bg-gradient-to-r from-green-500 to-emerald-600"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Play Again
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
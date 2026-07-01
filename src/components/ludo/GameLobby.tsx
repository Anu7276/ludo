'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLudoStore } from '@/stores/ludo-store';
import { PlayerColor, PLAYER_COLOR_HEX, PLAYER_COLOR_LIGHT } from '@/lib/ludo/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Users, Plus, Bot, X, Copy, Check, Dices, LogIn, Crown, Loader2 } from 'lucide-react';

export default function GameLobby() {
  const {
    connect,
    connected,
    createRoom,
    joinRoom,
    addBot,
    removeBot,
    startGame,
    leaveRoom,
    roomCode,
    roomPlayers,
    hostId,
    playerId,
    playerColor,
    error,
    showLobby,
  } = useLudoStore();

  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Auto-connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  const handleCreateRoom = async () => {
    if (!playerName.trim()) return;
    setLoading(true);
    await createRoom(playerName.trim());
    setLoading(false);
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim() || !joinCode.trim()) return;
    setLoading(true);
    const result = await joinRoom(joinCode.trim(), playerName.trim());
    setLoading(false);
    if (result) setDialogOpen(false);
  };

  const handleCopyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const isHost = playerId === hostId;
  const canStart = roomPlayers.length >= 2;
  const botCount = roomPlayers.filter(p => p.isBot).length;
  const humanCount = roomPlayers.filter(p => !p.isBot).length;

  // Not yet in a room — show name entry + create/join
  if (!roomCode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="shadow-2xl border-0">
            <CardHeader className="text-center pb-2">
              <motion.div
                className="mx-auto mb-3 w-16 h-16 rounded-2xl bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400 flex items-center justify-center shadow-lg"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Dices className="w-9 h-9 text-white" />
              </motion.div>
              <CardTitle className="text-3xl font-black tracking-tight text-gray-900">
                Ludo Online
              </CardTitle>
              <p className="text-gray-500 text-sm mt-1">
                Play with friends in real-time
              </p>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Name input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">Your Name</label>
                <Input
                  placeholder="Enter your name..."
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                  className="h-12 text-base"
                  maxLength={20}
                />
              </div>

              {/* Connection status */}
              {!connected && (
                <div className="flex items-center gap-2 text-amber-600 text-sm p-2 bg-amber-50 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting to game server...
                </div>
              )}

              {/* Create room */}
              <Button
                onClick={handleCreateRoom}
                disabled={!playerName.trim() || loading || !connected}
                className="w-full h-12 text-base font-bold bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 hover:from-red-600 hover:via-orange-600 hover:to-yellow-600 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Plus className="w-5 h-5 mr-2" />
                )}
                Create New Room
              </Button>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium uppercase">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Join room */}
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={!connected}
                    className="w-full h-12 text-base font-semibold border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  >
                    <LogIn className="w-5 h-5 mr-2" />
                    Join with Code
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-xl">Join a Room</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Room Code</label>
                      <Input
                        placeholder="Enter 6-character code..."
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                        className="h-12 text-lg tracking-widest font-mono text-center uppercase"
                        maxLength={6}
                      />
                    </div>
                    <Button
                      onClick={handleJoinRoom}
                      disabled={!playerName.trim() || !joinCode.trim() || loading}
                      className="w-full h-11 font-semibold"
                    >
                      {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Join Room
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-500 text-sm text-center"
                >
                  {error}
                </motion.p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // In a room — show lobby
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg"
      >
        <Card className="shadow-2xl border-0 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black">Game Lobby</h2>
                <p className="text-white/80 text-sm mt-1">Waiting for players...</p>
              </div>
              <Dices className="w-10 h-10 text-white/60" />
            </div>
          </div>

          <CardContent className="p-6 space-y-5">
            {/* Room Code */}
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider mb-2">
                Room Code
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-black tracking-[0.3em] text-gray-900 font-mono">
                  {roomCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                  title="Copy code"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <Copy className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Share this code with friends to join</p>
            </div>

            {/* Player Slots */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Players ({roomPlayers.length}/4)
                </h3>
                {isHost && roomPlayers.length < 4 && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={addBot}
                      className="h-8 text-xs font-semibold"
                    >
                      <Bot className="w-3.5 h-3.5 mr-1.5" />
                      Add Bot
                    </Button>
                    {botCount > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={removeBot}
                        className="h-8 text-xs text-gray-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Show 4 slots */}
                {(['red', 'green', 'yellow', 'blue'] as PlayerColor[]).map((color) => {
                  const player = roomPlayers.find((p) => p.color === color);
                  const isMe = player?.id === playerId;
                  const colorHex = PLAYER_COLOR_HEX[color];
                  const colorLight = PLAYER_COLOR_LIGHT[color];

                  return (
                    <motion.div
                      key={color}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: ['red', 'green', 'yellow', 'blue'].indexOf(color) * 0.1 }}
                      className={`
                        rounded-xl p-3 border-2 transition-all duration-200
                        ${player
                          ? 'border-transparent shadow-sm'
                          : 'border-dashed border-gray-200 bg-gray-50/50'
                        }
                      `}
                      style={player ? { background: colorLight, borderColor: `${colorHex}40` } : {}}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm shrink-0"
                          style={{ backgroundColor: colorHex }}
                        >
                          {player?.isBot ? (
                            <Bot className="w-4 h-4 text-white" />
                          ) : (
                            <span className="text-white text-xs font-bold">
                              {(player?.name || '?')[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {player?.name || `Waiting...`}
                          </p>
                          <div className="flex items-center gap-1.5">
                            {isMe && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                You
                              </Badge>
                            )}
                            {isHost && player?.id === hostId && !isMe && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                <Crown className="w-2.5 h-2.5 mr-0.5" />
                                Host
                              </Badge>
                            )}
                            {player?.isBot && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                AI
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={leaveRoom}
                className="flex-1 h-11 font-semibold"
              >
                Leave
              </Button>
              {isHost ? (
                <Button
                  onClick={startGame}
                  disabled={!canStart}
                  className="flex-1 h-11 font-bold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Dices className="w-4 h-4 mr-2" />
                  {canStart ? 'Start Game!' : `Need ${2 - roomPlayers.length} more`}
                </Button>
              ) : (
                <div className="flex-1 h-11 rounded-md bg-gray-100 flex items-center justify-center text-gray-400 text-sm font-medium">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Waiting for host...
                </div>
              )}
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-500 text-sm text-center"
              >
                {error}
              </motion.p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
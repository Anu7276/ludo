'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLudoStore } from '@/stores/ludo-store';
import { PLAYER_COLOR_HEX } from '@/lib/ludo/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send, X } from 'lucide-react';

export default function GameChat() {
  const { chatMessages, sendChatMessage, playerId } = useLudoStore();
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Auto-scroll and count unread
  useEffect(() => {
    if (chatMessages.length > prevCountRef.current && !isOpen) {
      setUnread(prev => prev + (chatMessages.length - prevCountRef.current));
    }
    prevCountRef.current = chatMessages.length;

    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages.length, isOpen]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendChatMessage(input);
    setInput('');
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <motion.button
        onClick={() => { setIsOpen(!isOpen); setUnread(0); }}
        className="fixed bottom-4 right-4 z-30 w-12 h-12 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors lg:hidden"
        whileTap={{ scale: 0.9 }}
      >
        {isOpen ? <X className="w-5 h-5 text-gray-500" /> : (
          <>
            <MessageCircle className="w-5 h-5 text-gray-500" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </>
        )}
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-20 right-4 z-30 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[60vh]"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 px-4 py-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-white" />
                <span className="text-white font-bold text-sm">Game Chat</span>
                <span className="text-white/70 text-xs ml-auto">{chatMessages.length} messages</span>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[150px] max-h-[300px]">
              {chatMessages.length === 0 ? (
                <p className="text-gray-400 text-xs text-center py-8">No messages yet. Say hello! 👋</p>
              ) : (
                chatMessages.map((msg, i) => {
                  const isMe = msg.playerId === playerId;
                  return (
                    <motion.div
                      key={`${msg.playerId}-${msg.timestamp}-${i}`}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold text-white"
                        style={{ backgroundColor: PLAYER_COLOR_HEX[msg.playerColor] }}
                      >
                        {msg.playerName[0].toUpperCase()}
                      </div>
                      <div className={`max-w-[75%] ${isMe ? 'text-right' : ''}`}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-semibold" style={{ color: PLAYER_COLOR_HEX[msg.playerColor] }}>
                            {msg.playerName}
                          </span>
                          {isMe && <span className="text-[9px] text-gray-400">you</span>}
                        </div>
                        <div
                          className={`inline-block px-2.5 py-1.5 rounded-xl text-xs ${
                            isMe
                              ? 'bg-gray-900 text-white rounded-br-sm'
                              : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                          }`}
                        >
                          {msg.message}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <div className="p-2 border-t border-gray-100">
              <form
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex gap-1.5"
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  className="h-9 text-xs rounded-lg"
                  maxLength={200}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!input.trim()}
                  className="h-9 w-9 p-0 rounded-lg bg-gradient-to-r from-red-500 to-orange-500"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
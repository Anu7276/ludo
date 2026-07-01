'use client';

import { useLudoStore } from '@/stores/ludo-store';
import GameLobby from '@/components/ludo/GameLobby';
import GameView from '@/components/ludo/GameView';
import { Toaster } from '@/components/ui/sonner';

export default function Home() {
  const showLobby = useLudoStore(s => s.showLobby);
  const showGame = useLudoStore(s => s.showGame);

  return (
    <>
      <Toaster position="top-center" richColors />
      {showLobby && <GameLobby />}
      {showGame && <GameView />}
    </>
  );
}
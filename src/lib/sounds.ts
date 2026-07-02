// Web Audio API sound effects for Ludo game
const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.15) {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + duration);
}

export function playDiceRoll() {
  // Quick series of clicks
  for (let i = 0; i < 5; i++) {
    setTimeout(() => playTone(200 + Math.random() * 300, 0.05, 'square', 0.05), i * 60);
  }
  setTimeout(() => playTone(600, 0.1, 'sine', 0.12), 350);
}

export function playPieceMove() {
  playTone(440, 0.08, 'sine', 0.1);
  setTimeout(() => playTone(550, 0.08, 'sine', 0.08), 60);
}

export function playCapture() {
  // Dramatic capture sound
  playTone(300, 0.15, 'sawtooth', 0.1);
  setTimeout(() => playTone(200, 0.2, 'sawtooth', 0.08), 100);
  setTimeout(() => playTone(150, 0.3, 'square', 0.05), 200);
}

export function playPieceHome() {
  // Happy ascending notes
  playTone(523, 0.1, 'sine', 0.12);
  setTimeout(() => playTone(659, 0.1, 'sine', 0.12), 100);
  setTimeout(() => playTone(784, 0.15, 'sine', 0.12), 200);
}

export function playWin() {
  // Victory fanfare
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    setTimeout(() => playTone(freq, 0.3, 'sine', 0.15), i * 150);
  });
}

export function playNoMoves() {
  playTone(300, 0.1, 'sine', 0.08);
  setTimeout(() => playTone(250, 0.15, 'sine', 0.06), 100);
}
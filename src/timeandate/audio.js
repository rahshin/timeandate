let context;

export function unlockTone() {
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    context ??= new Audio();
    if (context.state === "suspended") void context.resume().catch(() => {});
  } catch {
    // Sound is optional when the audio device or browser blocks it.
  }
}

export function playTone() {
  return playSound(523.25, 0.36, 0.03);
}

export function playTick() {
  return playSound(880, 0.07, 0.005);
}

function playSound(frequency, duration, attack) {
  try {
    if (context?.state !== "running") return false;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    const start = context.currentTime;
    oscillator.frequency.value = frequency;
    volume.gain.setValueAtTime(0, start);
    volume.gain.linearRampToValueAtTime(0.10, start + attack);
    volume.gain.exponentialRampToValueAtTime(0.001, start + duration - 0.01);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.addEventListener("ended", () => {
      oscillator.disconnect();
      volume.disconnect();
    }, { once: true });
    oscillator.start(start);
    oscillator.stop(start + duration);
    return true;
  } catch {
    return false;
  }
}

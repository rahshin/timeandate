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
  try {
    if (context?.state !== "running") return;
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    const start = context.currentTime;
    oscillator.frequency.value = 523.25;
    volume.gain.setValueAtTime(0, start);
    volume.gain.linearRampToValueAtTime(0.10, start + 0.03);
    volume.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.addEventListener("ended", () => {
      oscillator.disconnect();
      volume.disconnect();
    }, { once: true });
    oscillator.start(start);
    oscillator.stop(start + 0.36);
  } catch {
    // Audio failures do not affect the countdown.
  }
}

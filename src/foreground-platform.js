import { Capacitor, registerPlugin } from "@capacitor/core";

const native = Capacitor.isNativePlatform();
const alerts = registerPlugin("ForegroundTimer");

function browserSpeech() {
  const synthesis = window.speechSynthesis;
  if (!synthesis || !window.SpeechSynthesisUtterance) return;
  let settle;
  return {
    play(text, expiresAt) {
      if (Date.now() >= expiresAt) return;
      return new Promise(resolve => {
        const speech = new SpeechSynthesisUtterance(text);
        speech.lang = "en";
        const done = () => {
          if (settle === done) settle = undefined;
          resolve();
        };
        settle = done;
        speech.onend = speech.onerror = done;
        try {
          synthesis.speak(speech);
        } catch {
          done();
        }
      });
    },
    stop() {
      synthesis.cancel();
      settle?.();
    },
  };
}

export function foregroundPlatform() {
  if (!native) return {
    speech: browserSpeech(),
    requestWake: navigator.wakeLock ? () => navigator.wakeLock.request("screen") : undefined,
    visible: () => !document.hidden && document.hasFocus(),
  };
  return {
    speech: {
      play: (text, expiresAt) => alerts.speak({ text, expiresAt }),
      stop: () => { void alerts.stop().catch(() => {}); },
    },
    requestWake: async () => {
      await alerts.setAwake({ enabled: true });
      return { release: () => alerts.setAwake({ enabled: false }) };
    },
    visible: () => !document.hidden,
  };
}

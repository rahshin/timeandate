package io.github.rahshin.timeandate;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;
import java.util.UUID;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle state) {
        registerPlugin(ForegroundTimer.class);
        super.onCreate(state);
    }

    @CapacitorPlugin(name = "ForegroundTimer")
    public static class ForegroundTimer extends Plugin {
        private TextToSpeech engine;
        private boolean ready;
        private boolean failed;
        private boolean foreground = true;
        private boolean keepAwake;
        private PluginCall current;
        private String utteranceId;

        @Override
        public void load() {
            getActivity().runOnUiThread(() -> {
                engine = new TextToSpeech(getContext(), status -> new Handler(Looper.getMainLooper()).post(() -> {
                    if (engine == null) return;
                    failed = status != TextToSpeech.SUCCESS ||
                        engine.setLanguage(Locale.ENGLISH) < TextToSpeech.LANG_AVAILABLE;
                    ready = !failed;
                    if (ready) startSpeech();
                    else finishSpeech(utteranceId);
                }));
                engine.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String id) {}
                    @Override public void onDone(String id) { settle(id); }
                    @Override public void onError(String id) { settle(id); }
                    @Override public void onStop(String id, boolean interrupted) { settle(id); }
                });
            });
        }

        @PluginMethod
        public void speak(PluginCall call) {
            getActivity().runOnUiThread(() -> {
                stopSpeech();
                current = call;
                utteranceId = UUID.randomUUID().toString();
                startSpeech();
            });
        }

        private void startSpeech() {
            if (current == null) return;
            if (!foreground || failed || current.getDouble("expiresAt", 0.0) <= System.currentTimeMillis()) {
                finishSpeech(utteranceId);
            } else if (ready && engine.speak(current.getString("text", ""), TextToSpeech.QUEUE_FLUSH,
                    null, utteranceId) == TextToSpeech.ERROR) {
                finishSpeech(utteranceId);
            }
        }

        @PluginMethod
        public void stop(PluginCall call) {
            getActivity().runOnUiThread(() -> {
                stopSpeech();
                call.resolve();
            });
        }

        private void settle(String id) {
            getActivity().runOnUiThread(() -> finishSpeech(id));
        }

        private void finishSpeech(String id) {
            if (current == null || !utteranceId.equals(id)) return;
            PluginCall ended = current;
            current = null;
            utteranceId = null;
            ended.resolve();
        }

        private void stopSpeech() {
            finishSpeech(utteranceId);
            if (engine != null && ready) engine.stop();
        }

        @PluginMethod
        public void setAwake(PluginCall call) {
            getActivity().runOnUiThread(() -> {
                keepAwake = call.getBoolean("enabled", false);
                updateWindow();
                call.resolve();
            });
        }

        private void updateWindow() {
            if (foreground && keepAwake) {
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
        }

        @Override
        protected void handleOnResume() {
            foreground = true;
            updateWindow();
        }

        @Override
        protected void handleOnPause() {
            foreground = false;
            updateWindow();
            stopSpeech();
        }

        @Override
        protected void handleOnDestroy() {
            stopSpeech();
            if (engine != null) engine.shutdown();
            engine = null;
        }
    }
}

package com.summerquest.app;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.speech.tts.TextToSpeech;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;

/**
 * Bounded device-capability bridge for Summer Quest.
 *
 * All educational state and decision logic stays in the shared web runtime.
 * This plugin exposes only device capabilities that cannot
 * be implemented reliably by the bundled web app alone.
 */
@CapacitorPlugin(name = "SummerQuestNative")
public class SummerQuestNativePlugin extends Plugin {
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private TextToSpeech textToSpeech;
    private volatile boolean textToSpeechReady = false;

    private final AudioManager.OnAudioFocusChangeListener audioFocusListener = focusChange -> {
        JSObject data = new JSObject();
        if (focusChange == AudioManager.AUDIOFOCUS_GAIN) {
            data.put("state", "gained");
            notifyListeners("audioFocusChanged", data, true);
        } else if (focusChange == AudioManager.AUDIOFOCUS_LOSS
                || focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT
                || focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) {
            data.put("state", "lost");
            notifyListeners("audioFocusChanged", data, true);
        }
    };

    @Override
    public void load() {
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        textToSpeech = new TextToSpeech(getContext(), status -> {
            textToSpeechReady = status == TextToSpeech.SUCCESS;
        });
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        JSObject data = new JSObject();
        data.put("state", "resume");
        notifyListeners("lifecycleChanged", data, false);
    }

    @Override
    protected void handleOnPause() {
        JSObject data = new JSObject();
        data.put("state", "pause");
        notifyListeners("lifecycleChanged", data, false);
        super.handleOnPause();
    }

    @Override
    protected void handleOnDestroy() {
        releaseAudioFocusInternal();
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
            textToSpeech = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void haptic(PluginCall call) {
        String kind = call.getString("kind");
        if (kind == null || kind.isBlank()) kind = "tap";
        final String requestedKind = kind;
        getActivity().runOnUiThread(() -> vibrate(requestedKind));
        JSObject result = new JSObject();
        result.put("supported", hasVibrator());
        call.resolve(result);
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text");
        String languageTag = call.getString("lang");
        if (!textToSpeechReady || textToSpeech == null || text == null || text.trim().isEmpty()) {
            JSObject result = new JSObject();
            result.put("supported", false);
            call.resolve(result);
            return;
        }
        final String safeText = text;
        final String safeLanguage = languageTag == null || languageTag.trim().isEmpty() ? "en-US" : languageTag;
        getActivity().runOnUiThread(() -> {
            if (textToSpeech == null) return;
            textToSpeech.setLanguage(Locale.forLanguageTag(safeLanguage));
            textToSpeech.speak(safeText, TextToSpeech.QUEUE_FLUSH, null, "summer-quest");
        });
        JSObject result = new JSObject();
        result.put("supported", true);
        call.resolve(result);
    }

    @PluginMethod
    public void requestAudioFocus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", requestAudioFocusInternal());
        call.resolve(result);
    }

    @PluginMethod
    public void releaseAudioFocus(PluginCall call) {
        releaseAudioFocusInternal();
        call.resolve();
    }

    private boolean requestAudioFocusInternal() {
        if (audioManager == null) return false;
        final int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes attributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_GAME)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build();
            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(attributes)
                    .setOnAudioFocusChangeListener(audioFocusListener)
                    .build();
            result = audioManager.requestAudioFocus(audioFocusRequest);
        } else {
            result = audioManager.requestAudioFocus(
                    audioFocusListener,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN
            );
        }
        return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }

    @SuppressWarnings("deprecation")
    private void releaseAudioFocusInternal() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest);
            audioFocusRequest = null;
        } else {
            audioManager.abandonAudioFocus(audioFocusListener);
        }
    }

    private boolean hasVibrator() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) getContext().getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager != null && manager.getDefaultVibrator().hasVibrator();
        }
        Vibrator vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
        return vibrator != null && vibrator.hasVibrator();
    }

    @SuppressWarnings("deprecation")
    private void vibrate(String kind) {
        final long[] pattern;
        if ("success".equals(kind)) pattern = new long[]{0, 18, 30, 24};
        else if ("warning".equals(kind)) pattern = new long[]{0, 28, 35, 28};
        else pattern = new long[]{0, 12};

        Vibrator vibrator;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) getContext().getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            if (manager == null) return;
            vibrator = manager.getDefaultVibrator();
        } else {
            vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
        }
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
        } else {
            vibrator.vibrate(pattern, -1);
        }
    }
}

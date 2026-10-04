package com.summerquest.app;

import android.os.Bundle;

import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/** Thin activity host. All app/learning state remains in the bundled web runtime. */
public class MainActivity extends BridgeActivity {
    private OnBackPressedCallback backCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register before BridgeActivity.onCreate() creates the Bridge and loads the page.
        registerPlugin(SummerQuestNativePlugin.class);
        super.onCreate(savedInstanceState);
        backCallback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                dispatchBack();
            }
        };
        getOnBackPressedDispatcher().addCallback(this, backCallback);
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }

    private void dispatchBack() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            performSystemBack();
            return;
        }
        getBridge().getWebView().evaluateJavascript(
                "(function(){try{return !!(window.SummerQuestNative&&window.SummerQuestNative.triggerBack&&window.SummerQuestNative.triggerBack());}catch(e){return false;}})()",
                value -> {
                    if (!"true".equals(value)) performSystemBack();
                }
        );
    }

    private void performSystemBack() {
        runOnUiThread(() -> {
            backCallback.setEnabled(false);
            getOnBackPressedDispatcher().onBackPressed();
            backCallback.setEnabled(true);
        });
    }
}

package com.summerquest.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/** Thin activity host. All app/learning state remains in the bundled web runtime. */
public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register before BridgeActivity.onCreate() creates the Bridge and loads the page.
        registerPlugin(SummerQuestNativePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (getBridge() == null || getBridge().getWebView() == null) {
            super.onBackPressed();
            return;
        }
        getBridge().getWebView().evaluateJavascript(
                "(function(){try{return !!(window.SummerQuestNative&&window.SummerQuestNative.triggerBack&&window.SummerQuestNative.triggerBack());}catch(e){return false;}})()",
                value -> {
                    if (!"true".equals(value)) performSystemBack();
                }
        );
    }

    @SuppressWarnings("deprecation")
    private void performSystemBack() {
        runOnUiThread(() -> MainActivity.super.onBackPressed());
    }
}

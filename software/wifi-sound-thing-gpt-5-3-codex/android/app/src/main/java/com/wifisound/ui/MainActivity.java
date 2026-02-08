package com.wifisound.ui;

import com.getcapacitor.BridgeActivity;
import com.wifisound.ui.audio.NativeAudioPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(NativeAudioPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

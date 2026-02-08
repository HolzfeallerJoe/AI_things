package com.wifisoundthing.claudeopus46;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.wifisoundthing.claudeopus46.audio.WifiSoundPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WifiSoundPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

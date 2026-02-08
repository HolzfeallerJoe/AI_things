package com.wifisound.ui.audio;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class NativeAudioRuntimeTest {
    @Test
    public void runtimeState_updatesAndResets() {
        NativeAudioRuntime.setHostRunning(true, "playback");
        NativeAudioRuntime.setClientRunning(true);
        NativeAudioRuntime.setLastError("test-error");

        assertTrue(NativeAudioRuntime.isHostRunning());
        assertTrue(NativeAudioRuntime.isClientRunning());
        assertEquals("playback", NativeAudioRuntime.getHostMode());
        assertEquals("test-error", NativeAudioRuntime.getLastError());

        NativeAudioRuntime.setHostRunning(false, "idle");
        NativeAudioRuntime.setClientRunning(false);
        NativeAudioRuntime.setLastError(null);

        assertFalse(NativeAudioRuntime.isHostRunning());
        assertFalse(NativeAudioRuntime.isClientRunning());
        assertEquals("idle", NativeAudioRuntime.getHostMode());
    }
}

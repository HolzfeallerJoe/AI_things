package com.wifisound.ui.audio;

import java.util.concurrent.atomic.AtomicBoolean;

public final class NativeAudioRuntime {
    private static final AtomicBoolean HOST_RUNNING = new AtomicBoolean(false);
    private static final AtomicBoolean CLIENT_RUNNING = new AtomicBoolean(false);

    private static volatile String hostMode = "idle";
    private static volatile String lastError = null;

    private NativeAudioRuntime() {}

    public static void setHostRunning(boolean running, String mode) {
        HOST_RUNNING.set(running);
        hostMode = mode == null ? "idle" : mode;
    }

    public static void setClientRunning(boolean running) {
        CLIENT_RUNNING.set(running);
    }

    public static boolean isHostRunning() {
        return HOST_RUNNING.get();
    }

    public static boolean isClientRunning() {
        return CLIENT_RUNNING.get();
    }

    public static String getHostMode() {
        return hostMode;
    }

    public static String getLastError() {
        return lastError;
    }

    public static void setLastError(String error) {
        lastError = error;
    }
}

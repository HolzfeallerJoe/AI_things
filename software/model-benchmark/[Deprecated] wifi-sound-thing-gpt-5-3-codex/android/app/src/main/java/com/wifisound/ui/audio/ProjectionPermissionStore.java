package com.wifisound.ui.audio;

import android.content.Intent;

public final class ProjectionPermissionStore {
    private static int resultCode = Integer.MIN_VALUE;
    private static Intent dataIntent = null;

    private ProjectionPermissionStore() {}

    public static synchronized void set(int code, Intent data) {
        resultCode = code;
        dataIntent = data;
    }

    public static synchronized int getResultCode() {
        return resultCode;
    }

    public static synchronized Intent getDataIntent() {
        return dataIntent;
    }

    public static synchronized boolean hasPermission() {
        return resultCode != Integer.MIN_VALUE && dataIntent != null;
    }
}

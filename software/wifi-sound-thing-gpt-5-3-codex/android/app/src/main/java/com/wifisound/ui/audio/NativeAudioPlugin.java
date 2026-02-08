package com.wifisound.ui.audio;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.os.Build;

import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "NativeAudio",
    permissions = {
        @Permission(alias = "recordAudio", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class NativeAudioPlugin extends Plugin {
    @PluginMethod
    public void requestCapturePermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("MediaProjection playback capture requires Android 10 or newer.");
            return;
        }
        MediaProjectionManager manager =
            (MediaProjectionManager) getContext().getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (manager == null) {
            call.reject("MediaProjection service unavailable.");
            return;
        }

        Intent captureIntent = manager.createScreenCaptureIntent();
        startActivityForResult(call, captureIntent, "handleCapturePermissionResult");
    }

    @PluginMethod
    public void startHost(PluginCall call) {
        if (getPermissionState("recordAudio") != PermissionState.GRANTED) {
            requestPermissionForAlias("recordAudio", call, "startHostAfterPermission");
            return;
        }
        startHostInternal(call);
    }

    @PluginMethod
    public void stopHost(PluginCall call) {
        Intent stopIntent = new Intent(getContext(), HostForegroundService.class);
        stopIntent.setAction(HostForegroundService.ACTION_STOP);
        getContext().startService(stopIntent);
        NativeAudioRuntime.setHostRunning(false, "idle");
        call.resolve();
    }

    @PluginMethod
    public void startClient(PluginCall call) {
        Intent intent = new Intent(getContext(), ClientForegroundService.class);
        intent.setAction(ClientForegroundService.ACTION_START);
        intent.putExtra(ClientForegroundService.EXTRA_PORT, call.getInt("port", 5052));
        intent.putExtra(
            ClientForegroundService.EXTRA_HOST_ADDRESS,
            call.getString("hostAddress", "")
        );
        intent.putExtra(
            ClientForegroundService.EXTRA_JITTER_FRAMES,
            call.getInt("jitterFrames", 3)
        );
        intent.putExtra(
            ClientForegroundService.EXTRA_SAMPLE_RATE,
            call.getInt("sampleRate", 48000)
        );
        intent.putExtra(
            ClientForegroundService.EXTRA_CHANNELS,
            call.getInt("channels", 2)
        );
        intent.putExtra(
            ClientForegroundService.EXTRA_FRAME_SIZE,
            call.getInt("frameSize", 960)
        );
        startForegroundServiceCompat(intent);
        call.resolve();
    }

    @PluginMethod
    public void stopClient(PluginCall call) {
        Intent stopIntent = new Intent(getContext(), ClientForegroundService.class);
        stopIntent.setAction(ClientForegroundService.ACTION_STOP);
        getContext().startService(stopIntent);
        NativeAudioRuntime.setClientRunning(false);
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("hostRunning", NativeAudioRuntime.isHostRunning());
        result.put("clientRunning", NativeAudioRuntime.isClientRunning());
        result.put("hostMode", NativeAudioRuntime.getHostMode());
        result.put("lastError", NativeAudioRuntime.getLastError());
        result.put("capturePermission", ProjectionPermissionStore.hasPermission());
        call.resolve(result);
    }

    @PermissionCallback
    private void startHostAfterPermission(PluginCall call) {
        if (getPermissionState("recordAudio") != PermissionState.GRANTED) {
            call.reject("Record audio permission denied.");
            return;
        }
        startHostInternal(call);
    }

    @ActivityCallback
    private void handleCapturePermissionResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Capture permission denied.");
            return;
        }
        ProjectionPermissionStore.set(result.getResultCode(), result.getData());
        JSObject payload = new JSObject();
        payload.put("granted", true);
        call.resolve(payload);
    }

    private void startHostInternal(PluginCall call) {
        List<String> peers = new ArrayList<>();
        JSArray peerArray = call.getArray("peers");
        if (peerArray != null) {
            try {
                List<Object> values = peerArray.toList();
                for (Object value : values) {
                    if (value instanceof String) {
                        String candidate = ((String) value).trim();
                        if (!candidate.isEmpty()) {
                            peers.add(candidate);
                        }
                    }
                }
            } catch (JSONException ignored) {
                // Fall through to validation.
            }
        }

        if (peers.isEmpty()) {
            call.reject("At least one peer IP address is required.");
            return;
        }

        Intent intent = new Intent(getContext(), HostForegroundService.class);
        intent.setAction(HostForegroundService.ACTION_START);
        intent.putExtra(HostForegroundService.EXTRA_PEERS, peers.toArray(new String[0]));
        intent.putExtra(HostForegroundService.EXTRA_PORT, call.getInt("port", 5052));
        intent.putExtra(
            HostForegroundService.EXTRA_SAMPLE_RATE,
            call.getInt("sampleRate", 48000)
        );
        intent.putExtra(
            HostForegroundService.EXTRA_CHANNELS,
            call.getInt("channels", 2)
        );
        intent.putExtra(
            HostForegroundService.EXTRA_FRAME_SIZE,
            call.getInt("frameSize", 960)
        );
        intent.putExtra(
            HostForegroundService.EXTRA_CAPTURE_MODE,
            call.getString("captureMode", "auto")
        );

        NativeAudioRuntime.setLastError(null);
        startForegroundServiceCompat(intent);

        JSObject result = new JSObject();
        result.put("started", true);
        result.put("capturePermission", ProjectionPermissionStore.hasPermission());
        call.resolve(result);
    }

    private void startForegroundServiceCompat(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(getContext(), intent);
        } else {
            getContext().startService(intent);
        }
    }
}

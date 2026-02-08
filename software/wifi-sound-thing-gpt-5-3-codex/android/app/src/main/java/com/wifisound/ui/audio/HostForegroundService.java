package com.wifisound.ui.audio;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioPlaybackCaptureConfiguration;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.wifisound.ui.MainActivity;
import com.wifisound.ui.R;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

public class HostForegroundService extends Service {
    public static final String ACTION_START = "com.wifisound.ui.audio.HOST_START";
    public static final String ACTION_STOP = "com.wifisound.ui.audio.HOST_STOP";

    public static final String EXTRA_PEERS = "peers";
    public static final String EXTRA_PORT = "port";
    public static final String EXTRA_SAMPLE_RATE = "sampleRate";
    public static final String EXTRA_CHANNELS = "channels";
    public static final String EXTRA_FRAME_SIZE = "frameSize";
    public static final String EXTRA_CAPTURE_MODE = "captureMode"; // auto|playback|microphone

    private static final String TAG = "HostForegroundService";
    private static final String CHANNEL_ID = "wifi_sound_host_channel";
    private static final int NOTIFICATION_ID = 7211;

    private final AtomicBoolean running = new AtomicBoolean(false);
    private Thread workerThread;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            return START_NOT_STICKY;
        }

        final String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopSelfSafely();
            return START_NOT_STICKY;
        }

        if (!ACTION_START.equals(action)) {
            return START_NOT_STICKY;
        }

        startAsForeground();
        startWorker(intent);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopSelfSafely();
        super.onDestroy();
    }

    private void startWorker(Intent intent) {
        stopWorkerOnly();
        running.set(true);

        workerThread = new Thread(() -> runSenderLoop(intent), "wifi-audio-host-worker");
        workerThread.start();
    }

    private void runSenderLoop(Intent intent) {
        String[] peerList = intent.getStringArrayExtra(EXTRA_PEERS);
        int port = intent.getIntExtra(EXTRA_PORT, 5052);
        int sampleRate = intent.getIntExtra(EXTRA_SAMPLE_RATE, 48000);
        int channels = Math.max(1, Math.min(2, intent.getIntExtra(EXTRA_CHANNELS, 2)));
        int frameSize = intent.getIntExtra(EXTRA_FRAME_SIZE, 960);
        String captureMode = intent.getStringExtra(EXTRA_CAPTURE_MODE);
        if (captureMode == null || captureMode.trim().isEmpty()) {
            captureMode = "auto";
        }

        List<InetAddress> peers = resolvePeers(peerList);
        if (peers.isEmpty()) {
            NativeAudioRuntime.setLastError("No valid peer addresses configured for host sender.");
            NativeAudioRuntime.setHostRunning(false, "idle");
            stopSelfSafely();
            return;
        }

        MediaProjection projection = null;
        AudioRecord recorder = null;
        String activeMode = "microphone";
        boolean playbackEnergyDetected = false;
        int silentPlaybackFrames = 0;
        int silentFallbackThreshold = Math.max(
            60,
            Math.round((sampleRate / (float) Math.max(1, frameSize)) * 10.0f)
        );

        try {
            if (!"microphone".equals(captureMode)) {
                PlaybackRecordResult playbackResult = buildPlaybackCapture(sampleRate, channels, frameSize);
                if (playbackResult.recorder != null) {
                    recorder = playbackResult.recorder;
                    projection = playbackResult.projection;
                    activeMode = "playback";
                }
            }

            if (recorder == null) {
                if ("playback".equals(captureMode)) {
                    throw new IllegalStateException(
                        "Playback capture is unavailable. Use Auto mode to allow microphone fallback."
                    );
                }
                recorder = buildMicrophoneCapture(sampleRate, channels, frameSize);
                activeMode = "microphone";
            }

            if (recorder == null || recorder.getState() != AudioRecord.STATE_INITIALIZED) {
                throw new IllegalStateException("Unable to initialize audio recorder.");
            }

            NativeAudioRuntime.setLastError(null);
            NativeAudioRuntime.setHostRunning(true, activeMode);

            int frameBytes = Math.max(320, frameSize * channels * 2);
            byte[] audioBuffer = new byte[frameBytes];
            int sequence = 0;

            try (DatagramSocket socket = new DatagramSocket()) {
                recorder.startRecording();

                while (running.get()) {
                    int read = recorder.read(audioBuffer, 0, audioBuffer.length);
                    if (read <= 0) {
                        continue;
                    }

                    if ("playback".equals(activeMode) && "auto".equals(captureMode)) {
                        if (hasSignal(audioBuffer, read)) {
                            playbackEnergyDetected = true;
                            silentPlaybackFrames = 0;
                        } else if (!playbackEnergyDetected) {
                            silentPlaybackFrames += 1;
                            if (silentPlaybackFrames >= silentFallbackThreshold) {
                                if (recorder.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                                    recorder.stop();
                                }
                                recorder.release();
                                recorder = buildMicrophoneCapture(sampleRate, channels, frameSize);
                                if (recorder == null || recorder.getState() != AudioRecord.STATE_INITIALIZED) {
                                    throw new IllegalStateException(
                                        "Playback capture stayed silent and microphone fallback failed."
                                    );
                                }
                                if (projection != null) {
                                    projection.stop();
                                    projection = null;
                                }
                                activeMode = "microphone";
                                NativeAudioRuntime.setHostRunning(true, activeMode);
                                recorder.startRecording();
                                continue;
                            }
                        }
                    }

                    long timestampUs = System.nanoTime() / 1000L;
                    byte[] packet = AudioPacketCodec.encode(
                        sequence++,
                        timestampUs,
                        sampleRate,
                        channels,
                        frameSize,
                        audioBuffer,
                        read
                    );

                    for (InetAddress peer : peers) {
                        DatagramPacket datagram = new DatagramPacket(packet, packet.length, peer, port);
                        socket.send(datagram);
                    }
                }
            } finally {
                if (recorder.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                    recorder.stop();
                }
            }
        } catch (Exception error) {
            Log.e(TAG, "Host sender failed", error);
            NativeAudioRuntime.setLastError(error.getMessage());
        } finally {
            NativeAudioRuntime.setHostRunning(false, "idle");
            if (recorder != null) {
                recorder.release();
            }
            if (projection != null) {
                projection.stop();
            }
            stopSelfSafely();
        }
    }

    private boolean hasSignal(byte[] payload, int length) {
        int sampleBytes = (length / 2) * 2;
        int maxAbs = 0;
        for (int i = 0; i < sampleBytes; i += 2) {
            int lo = payload[i] & 0xFF;
            int hi = payload[i + 1];
            short sample = (short) ((hi << 8) | lo);
            int amplitude = Math.abs(sample);
            if (amplitude > maxAbs) {
                maxAbs = amplitude;
                if (maxAbs >= 8) {
                    return true;
                }
            }
        }
        return false;
    }

    private PlaybackRecordResult buildPlaybackCapture(int sampleRate, int channels, int frameSize) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return new PlaybackRecordResult(null, null);
        }
        if (!ProjectionPermissionStore.hasPermission()) {
            return new PlaybackRecordResult(null, null);
        }

        MediaProjectionManager manager =
            (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (manager == null) {
            return new PlaybackRecordResult(null, null);
        }

        MediaProjection projection = manager.getMediaProjection(
            ProjectionPermissionStore.getResultCode(),
            ProjectionPermissionStore.getDataIntent()
        );
        if (projection == null) {
            return new PlaybackRecordResult(null, null);
        }

        int channelMask = channels == 1 ? AudioFormat.CHANNEL_IN_MONO : AudioFormat.CHANNEL_IN_STEREO;
        AudioFormat audioFormat = new AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(sampleRate)
            .setChannelMask(channelMask)
            .build();

        AudioPlaybackCaptureConfiguration captureConfig =
            new AudioPlaybackCaptureConfiguration.Builder(projection)
                .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
                .addMatchingUsage(AudioAttributes.USAGE_GAME)
                .build();

        int minBuffer = AudioRecord.getMinBufferSize(
            sampleRate,
            channelMask,
            AudioFormat.ENCODING_PCM_16BIT
        );
        int frameBytes = Math.max(320, frameSize * channels * 2);
        int bufferSize = Math.max(minBuffer * 2, frameBytes * 6);

        AudioRecord recorder = new AudioRecord.Builder()
            .setAudioFormat(audioFormat)
            .setAudioPlaybackCaptureConfig(captureConfig)
            .setBufferSizeInBytes(bufferSize)
            .build();

        if (recorder.getState() != AudioRecord.STATE_INITIALIZED) {
            recorder.release();
            projection.stop();
            return new PlaybackRecordResult(null, null);
        }

        return new PlaybackRecordResult(recorder, projection);
    }

    private AudioRecord buildMicrophoneCapture(int sampleRate, int channels, int frameSize) {
        int channelMask = channels == 1 ? AudioFormat.CHANNEL_IN_MONO : AudioFormat.CHANNEL_IN_STEREO;
        int minBuffer = AudioRecord.getMinBufferSize(
            sampleRate,
            channelMask,
            AudioFormat.ENCODING_PCM_16BIT
        );
        int frameBytes = Math.max(320, frameSize * channels * 2);
        int bufferSize = Math.max(minBuffer * 2, frameBytes * 6);
        return new AudioRecord(
            MediaRecorder.AudioSource.MIC,
            sampleRate,
            channelMask,
            AudioFormat.ENCODING_PCM_16BIT,
            bufferSize
        );
    }

    private List<InetAddress> resolvePeers(String[] peerList) {
        List<InetAddress> peers = new ArrayList<>();
        if (peerList == null) {
            return peers;
        }
        for (String peer : peerList) {
            if (peer == null) {
                continue;
            }
            String trimmed = peer.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            try {
                peers.add(InetAddress.getByName(trimmed));
            } catch (Exception ignored) {
                // Ignore invalid addresses and continue with remaining peers.
            }
        }
        return peers;
    }

    private void stopSelfSafely() {
        stopWorkerOnly();
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void stopWorkerOnly() {
        running.set(false);
        Thread thread = workerThread;
        workerThread = null;
        if (thread != null) {
            thread.interrupt();
            try {
                thread.join(600);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
        }
    }

    private void startAsForeground() {
        Notification notification = buildNotification(
            "Wi-Fi audio host running",
            "Capturing and sending audio to clients."
        );
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
                    | android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private Notification buildNotification(String title, String body) {
        Intent launchIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            1,
            launchIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Wi-Fi Sound Host",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Foreground service for host audio capture and transmission.");
        manager.createNotificationChannel(channel);
    }

    private static final class PlaybackRecordResult {
        final AudioRecord recorder;
        final MediaProjection projection;

        PlaybackRecordResult(AudioRecord recorder, MediaProjection projection) {
            this.recorder = recorder;
            this.projection = projection;
        }
    }
}

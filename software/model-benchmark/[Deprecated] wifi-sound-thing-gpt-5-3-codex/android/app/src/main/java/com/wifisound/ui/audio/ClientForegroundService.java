package com.wifisound.ui.audio;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.wifisound.ui.MainActivity;
import com.wifisound.ui.R;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.util.TreeMap;
import java.util.concurrent.atomic.AtomicBoolean;

public class ClientForegroundService extends Service {
    public static final String ACTION_START = "com.wifisound.ui.audio.CLIENT_START";
    public static final String ACTION_STOP = "com.wifisound.ui.audio.CLIENT_STOP";

    public static final String EXTRA_PORT = "port";
    public static final String EXTRA_HOST_ADDRESS = "hostAddress";
    public static final String EXTRA_JITTER_FRAMES = "jitterFrames";
    public static final String EXTRA_SAMPLE_RATE = "sampleRate";
    public static final String EXTRA_CHANNELS = "channels";
    public static final String EXTRA_FRAME_SIZE = "frameSize";

    private static final String CHANNEL_ID = "wifi_sound_client_channel";
    private static final int NOTIFICATION_ID = 7212;

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

        String action = intent.getAction();
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
        workerThread = new Thread(() -> runReceiverLoop(intent), "wifi-audio-client-worker");
        workerThread.start();
    }

    private void runReceiverLoop(Intent intent) {
        int port = intent.getIntExtra(EXTRA_PORT, 5052);
        int defaultSampleRate = intent.getIntExtra(EXTRA_SAMPLE_RATE, 48000);
        int defaultChannels = Math.max(1, Math.min(2, intent.getIntExtra(EXTRA_CHANNELS, 2)));
        int defaultFrameSize = intent.getIntExtra(EXTRA_FRAME_SIZE, 960);
        int jitterFrames = Math.max(1, intent.getIntExtra(EXTRA_JITTER_FRAMES, 3));
        String expectedHost = intent.getStringExtra(EXTRA_HOST_ADDRESS);
        if (expectedHost != null) {
            expectedHost = expectedHost.trim();
            if (expectedHost.isEmpty()) {
                expectedHost = null;
            }
        }

        TreeMap<Integer, byte[]> jitterQueue = new TreeMap<>();
        AudioTrack audioTrack = null;
        int activeSampleRate = defaultSampleRate;
        int activeChannels = defaultChannels;
        int activeFrameSize = defaultFrameSize;

        NativeAudioRuntime.setLastError(null);
        NativeAudioRuntime.setClientRunning(true);

        byte[] receiveBuffer = new byte[64 * 1024];

        try (DatagramSocket socket = new DatagramSocket(port)) {
            socket.setSoTimeout(1000);

            while (running.get()) {
                DatagramPacket datagram = new DatagramPacket(receiveBuffer, receiveBuffer.length);
                try {
                    socket.receive(datagram);
                } catch (Exception timeout) {
                    continue;
                }

                if (expectedHost != null) {
                    String packetHost =
                        datagram.getAddress() == null ? null : datagram.getAddress().getHostAddress();
                    if (packetHost == null || !expectedHost.equals(packetHost)) {
                        continue;
                    }
                }

                AudioPacketCodec.DecodedPacket packet =
                    AudioPacketCodec.decode(datagram.getData(), datagram.getLength());
                if (packet == null || packet.payload == null || packet.payload.length == 0) {
                    continue;
                }

                if (
                    audioTrack == null ||
                    packet.sampleRate != activeSampleRate ||
                    packet.channels != activeChannels ||
                    packet.frameSize != activeFrameSize
                ) {
                    if (audioTrack != null) {
                        audioTrack.pause();
                        audioTrack.flush();
                        audioTrack.release();
                    }
                    activeSampleRate = packet.sampleRate;
                    activeChannels = packet.channels;
                    activeFrameSize = packet.frameSize;
                    audioTrack = createAudioTrack(activeSampleRate, activeChannels, activeFrameSize);
                }

                jitterQueue.put(packet.sequence, packet.payload);
                while (jitterQueue.size() > jitterFrames) {
                    byte[] payload = jitterQueue.pollFirstEntry().getValue();
                    if (audioTrack != null) {
                        audioTrack.write(payload, 0, payload.length, AudioTrack.WRITE_BLOCKING);
                    }
                }
            }
        } catch (Exception error) {
            NativeAudioRuntime.setLastError(error.getMessage());
        } finally {
            NativeAudioRuntime.setClientRunning(false);
            if (audioTrack != null) {
                audioTrack.pause();
                audioTrack.flush();
                audioTrack.release();
            }
            stopSelfSafely();
        }
    }

    private AudioTrack createAudioTrack(int sampleRate, int channels, int frameSize) {
        int channelMask = channels == 1 ? AudioFormat.CHANNEL_OUT_MONO : AudioFormat.CHANNEL_OUT_STEREO;
        int minBuffer = AudioTrack.getMinBufferSize(
            sampleRate,
            channelMask,
            AudioFormat.ENCODING_PCM_16BIT
        );
        int frameBytes = Math.max(320, frameSize * channels * 2);
        int bufferSize = Math.max(minBuffer * 2, frameBytes * 6);

        AudioTrack track = new AudioTrack.Builder()
            .setAudioAttributes(
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            .setAudioFormat(
                new AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(sampleRate)
                    .setChannelMask(channelMask)
                    .build()
            )
            .setTransferMode(AudioTrack.MODE_STREAM)
            .setBufferSizeInBytes(bufferSize)
            .build();

        track.play();
        return track;
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
            "Wi-Fi audio client running",
            "Receiving and playing host audio stream."
        );
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private Notification buildNotification(String title, String body) {
        Intent launchIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            2,
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
            "Wi-Fi Sound Client",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Foreground service for audio receiving and playback.");
        manager.createNotificationChannel(channel);
    }
}

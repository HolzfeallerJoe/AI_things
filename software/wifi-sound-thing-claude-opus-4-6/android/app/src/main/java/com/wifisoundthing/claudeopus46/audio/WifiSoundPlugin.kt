package com.wifisoundthing.claudeopus46.audio

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.util.Log
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import rikka.shizuku.Shizuku
import java.util.Timer
import java.util.TimerTask

/**
 * Capacitor bridge between the Angular/Ionic UI and all native audio components.
 *
 * Supports two capture modes:
 * - **Shizuku** (REMOTE_SUBMIX): Captures all audio including DRM-protected apps
 * - **Projection** (AudioPlaybackCapture): Fallback when Shizuku unavailable
 *
 * Plugin name is "WifiSound" — accessed from TypeScript via
 * `registerPlugin<WifiSoundPlugin>('WifiSound')`.
 */
@CapacitorPlugin(name = "WifiSound")
class WifiSoundPlugin : Plugin() {

    companion object {
        private const val TAG = "WifiSoundPlugin"
        private const val SHIZUKU_PERMISSION_REQUEST_CODE = 42
    }

    // MediaProjection grant stored between requestMediaProjection → startHost
    private var projectionResultCode = 0
    private var projectionResultData: Intent? = null

    // Client-side components (no foreground service needed)
    private var audioReceiver: AudioReceiver? = null
    private var audioPlayer: AudioPlayer? = null
    private var jitterBuffer: JitterBuffer? = null
    private var clientCodec: AudioCodec = PcmCodec()

    // Discovery (client mode)
    private var discoveryManager: DiscoveryManager? = null

    // Client metrics timer
    private var clientMetricsTimer: Timer? = null

    // Pending Shizuku permission call
    private var pendingShizukuCall: PluginCall? = null

    private val shizukuPermissionListener =
        Shizuku.OnRequestPermissionResultListener { requestCode, grantResult ->
            if (requestCode == SHIZUKU_PERMISSION_REQUEST_CODE) {
                val call = pendingShizukuCall
                pendingShizukuCall = null
                if (call == null) return@OnRequestPermissionResultListener

                val granted = grantResult == PackageManager.PERMISSION_GRANTED
                val ret = JSObject()
                ret.put("granted", granted)
                call.resolve(ret)
            }
        }

    override fun load() {
        super.load()
        ShizukuHelper.addPermissionResultListener(shizukuPermissionListener)
    }

    override fun handleOnDestroy() {
        ShizukuHelper.removePermissionResultListener(shizukuPermissionListener)
        super.handleOnDestroy()
    }

    // ── Shizuku methods ─────────────────────────────────────────────

    @PluginMethod
    fun checkShizuku(call: PluginCall) {
        val running = ShizukuHelper.isRunning()
        val granted = if (running) ShizukuHelper.hasPermission() else false

        val ret = JSObject()
        ret.put("available", running)
        ret.put("granted", granted)
        call.resolve(ret)
    }

    @PluginMethod
    fun requestShizukuPermission(call: PluginCall) {
        if (!ShizukuHelper.isRunning()) {
            call.reject("Shizuku is not running")
            return
        }

        if (ShizukuHelper.hasPermission()) {
            val ret = JSObject()
            ret.put("granted", true)
            call.resolve(ret)
            return
        }

        pendingShizukuCall = call
        ShizukuHelper.requestPermission(SHIZUKU_PERMISSION_REQUEST_CODE)
    }

    // ── Host methods ────────────────────────────────────────────────

    @PluginMethod
    fun requestMediaProjection(call: PluginCall) {
        val manager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE)
            as MediaProjectionManager
        val intent = manager.createScreenCaptureIntent()
        startActivityForResult(call, intent, "handleProjectionResult")
    }

    @ActivityCallback
    private fun handleProjectionResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return

        if (result.resultCode != Activity.RESULT_OK || result.data == null) {
            call.reject("Media projection permission denied by user")
            return
        }

        projectionResultCode = result.resultCode
        projectionResultData = result.data

        val ret = JSObject()
        ret.put("granted", true)
        call.resolve(ret)
    }

    @PluginMethod
    fun startHost(call: PluginCall) {
        val captureMode = call.getString("captureMode", HostForegroundService.CAPTURE_MODE_PROJECTION)!!

        // Projection mode requires MediaProjection grant
        if (captureMode == HostForegroundService.CAPTURE_MODE_PROJECTION && projectionResultData == null) {
            call.reject("Must call requestMediaProjection() first for projection mode")
            return
        }

        val sampleRate = call.getInt("sampleRate", 48000)!!
        val frameSize = call.getInt("frameSize", 960)!!
        val jitterBuf = call.getInt("jitterBuffer", 3)!!
        val hostName = call.getString("hostName", "WiFi Sound Host")!!
        val hostAddress = call.getString("hostAddress", "")!!

        val peersArray = call.getArray("peers")
        val peers = mutableListOf<String>()
        if (peersArray != null) {
            for (i in 0 until peersArray.length()) {
                val addr = peersArray.getString(i)
                if (!addr.isNullOrBlank()) peers.add(addr)
            }
        }

        // Set up metrics callback
        HostForegroundService.metricsCallback = { metrics ->
            val data = JSObject()
            data.put("packetsSent", metrics.packetsSent)
            data.put("bytesSent", metrics.bytesSent)
            data.put("peerCount", metrics.peerCount)
            data.put("uptimeMs", metrics.uptimeMs)
            notifyListeners("metricsUpdate", data)
        }

        // Start the foreground service
        val serviceIntent = Intent(context, HostForegroundService::class.java).apply {
            action = HostForegroundService.ACTION_START
            putExtra(HostForegroundService.EXTRA_CAPTURE_MODE, captureMode)
            putExtra(HostForegroundService.EXTRA_SAMPLE_RATE, sampleRate)
            putExtra(HostForegroundService.EXTRA_FRAME_SIZE, frameSize)
            putExtra(HostForegroundService.EXTRA_JITTER_BUFFER, jitterBuf)
            putExtra(HostForegroundService.EXTRA_PEERS, peers.toTypedArray())
            putExtra(HostForegroundService.EXTRA_HOST_NAME, hostName)
            putExtra(HostForegroundService.EXTRA_HOST_ADDRESS, hostAddress)

            // Only include projection data for projection mode
            if (captureMode == HostForegroundService.CAPTURE_MODE_PROJECTION) {
                putExtra(HostForegroundService.EXTRA_RESULT_CODE, projectionResultCode)
                putExtra(HostForegroundService.EXTRA_RESULT_DATA, projectionResultData)
            }
        }
        context.startForegroundService(serviceIntent)

        Log.d(TAG, "startHost: mode=$captureMode, peers=${peers.joinToString()}, rate=$sampleRate")

        val ret = JSObject()
        ret.put("started", true)
        ret.put("captureMode", captureMode)
        call.resolve(ret)
    }

    @PluginMethod
    fun stopHost(call: PluginCall) {
        HostForegroundService.metricsCallback = null

        val serviceIntent = Intent(context, HostForegroundService::class.java).apply {
            action = HostForegroundService.ACTION_STOP
        }
        context.startService(serviceIntent)

        projectionResultData = null
        Log.d(TAG, "stopHost")

        call.resolve()
    }

    // ── Client methods ──────────────────────────────────────────────

    @PluginMethod
    fun startClient(call: PluginCall) {
        val hostAddress = call.getString("hostAddress")
        if (hostAddress.isNullOrBlank()) {
            call.reject("hostAddress is required")
            return
        }

        val sampleRate = call.getInt("sampleRate", 48000)!!
        val frameSize = call.getInt("frameSize", 960)!!
        val jitterDepth = call.getInt("jitterBuffer", 3)!!

        val config = AudioConfig(
            sampleRate = sampleRate,
            frameSizeSamples = frameSize,
            jitterBufferDepth = jitterDepth
        )

        jitterBuffer = JitterBuffer(jitterDepth, config.frameSizeBytes)
        audioReceiver = AudioReceiver(config, clientCodec, jitterBuffer!!)
        audioPlayer = AudioPlayer(config)

        audioReceiver?.start()
        audioPlayer?.start(jitterBuffer!!)

        startClientMetricsTimer()

        Log.d(TAG, "startClient: host=$hostAddress, rate=$sampleRate, jitter=$jitterDepth")

        val ret = JSObject()
        ret.put("connected", true)
        call.resolve(ret)
    }

    @PluginMethod
    fun stopClient(call: PluginCall) {
        stopClientMetricsTimer()

        jitterBuffer?.stop()
        audioPlayer?.stop()
        audioReceiver?.stop()

        audioPlayer = null
        audioReceiver = null
        jitterBuffer = null

        Log.d(TAG, "stopClient")
        call.resolve()
    }

    // ── Discovery methods ───────────────────────────────────────────

    @PluginMethod
    fun startDiscovery(call: PluginCall) {
        if (discoveryManager != null) {
            call.resolve()
            return
        }

        val config = AudioConfig()
        discoveryManager = DiscoveryManager(config)
        discoveryManager?.startListening(object : DiscoveryListener {
            override fun onHostDiscovered(beacon: DiscoveryBeacon) {
                val data = JSObject()
                data.put("id", beacon.address)
                data.put("name", beacon.name)
                data.put("address", beacon.address)
                data.put("port", beacon.port)
                data.put("codec", beacon.codec)
                data.put("sampleRate", beacon.sampleRate)
                data.put("transport", "udp://${beacon.address}:${beacon.port}")
                notifyListeners("hostDiscovered", data)
            }

            override fun onHostLost(address: String) {
                val data = JSObject()
                data.put("address", address)
                notifyListeners("hostLost", data)
            }
        })

        Log.d(TAG, "startDiscovery")
        call.resolve()
    }

    @PluginMethod
    fun stopDiscovery(call: PluginCall) {
        discoveryManager?.stopListening()
        discoveryManager = null
        Log.d(TAG, "stopDiscovery")
        call.resolve()
    }

    // ── Internal helpers ────────────────────────────────────────────

    private fun startClientMetricsTimer() {
        clientMetricsTimer = Timer("ClientMetrics-Timer", true).also { timer ->
            timer.scheduleAtFixedRate(object : TimerTask() {
                override fun run() {
                    val receiver = audioReceiver ?: return
                    val jb = jitterBuffer ?: return
                    val data = JSObject()
                    data.put("packetsReceived", receiver.packetsReceived)
                    data.put("latencyUs", receiver.lastLatencyUs)
                    data.put("bufferDepth", jb.currentDepth())
                    data.put("packetsDropped", jb.packetsDropped)
                    notifyListeners("clientMetricsUpdate", data)
                }
            }, 1000L, 1000L)
        }
    }

    private fun stopClientMetricsTimer() {
        clientMetricsTimer?.cancel()
        clientMetricsTimer = null
    }
}

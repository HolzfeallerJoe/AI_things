package app.wifisoundthing.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.widget.ArrayAdapter
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import app.wifisoundthing.R
import app.wifisoundthing.app.ClientSession
import app.wifisoundthing.app.Prefs
import app.wifisoundthing.core.Format
import app.wifisoundthing.core.NetUtils
import app.wifisoundthing.databinding.ActivityClientBinding
import app.wifisoundthing.databinding.ItemHostBinding
import app.wifisoundthing.net.ClientEngine
import app.wifisoundthing.net.Discovery
import app.wifisoundthing.service.ClientService
import com.google.android.material.snackbar.Snackbar

/** Client screen: discover hosts, connect, watch stream health (FR-6, FR-8). */
class ClientActivity : AppCompatActivity() {

    private lateinit var binding: ActivityClientBinding
    private lateinit var prefs: Prefs
    private val handler = Handler(Looper.getMainLooper())
    private var seenErrorSerial = 0L

    private var browser: Discovery.Browser? = null
    private var multicastLock: WifiManager.MulticastLock? = null
    private val foundHosts = LinkedHashMap<String, Discovery.FoundHost>()

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* optional */ }

    private val uiUpdater = object : Runnable {
        override fun run() {
            refreshUi()
            handler.postDelayed(this, UI_INTERVAL_MS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityClientBinding.inflate(layoutInflater)
        setContentView(binding.root)
        prefs = Prefs(this)
        seenErrorSerial = ClientSession.errorSerial

        val labels = resources.getStringArray(R.array.latency_labels)
        binding.spinnerLatency.setAdapter(ArrayAdapter(this, android.R.layout.simple_list_item_1, labels))
        val savedIndex = Prefs.JITTER_OPTIONS.indexOf(prefs.jitterDepth).takeIf { it >= 0 } ?: 1
        binding.spinnerLatency.setText(labels[savedIndex], false)
        binding.spinnerLatency.setOnItemClickListener { _, _, position, _ ->
            prefs.jitterDepth = Prefs.JITTER_OPTIONS[position]
        }

        binding.editManualAddress.setText(prefs.lastManualAddress)
        binding.buttonManualConnect.setOnClickListener {
            val parsed = NetUtils.parseHostPort(binding.editManualAddress.text?.toString() ?: "")
            if (parsed == null) {
                Snackbar.make(binding.root, R.string.client_error_bad_address, Snackbar.LENGTH_LONG).show()
            } else {
                prefs.lastManualAddress = binding.editManualAddress.text?.toString()?.trim() ?: ""
                connect(parsed.first, parsed.second, parsed.first)
            }
        }

        binding.buttonDisconnect.setOnClickListener { ClientService.stop(this) }

        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    override fun onStart() {
        super.onStart()
        startDiscovery()
        handler.post(uiUpdater)
    }

    override fun onStop() {
        handler.removeCallbacks(uiUpdater)
        stopDiscovery()
        super.onStop()
    }

    private fun connect(host: String, port: Int, label: String) {
        ClientService.start(this, host, port, label, prefs.jitterDepth)
    }

    private fun startDiscovery() {
        val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        multicastLock = wifi.createMulticastLock("WiFiSoundThing:discovery").apply {
            setReferenceCounted(false)
            acquire()
        }
        browser = Discovery.Browser(
            this,
            object : Discovery.Browser.Callback {
                override fun onHostFound(host: Discovery.FoundHost) {
                    runOnUiThread {
                        foundHosts[host.serviceName] = host
                        rebuildHostList()
                    }
                }

                override fun onHostLost(serviceName: String) {
                    runOnUiThread {
                        foundHosts.remove(serviceName)
                        rebuildHostList()
                    }
                }
            },
        ).also { it.start() }
    }

    private fun stopDiscovery() {
        browser?.stop()
        browser = null
        try {
            multicastLock?.release()
        } catch (_: Exception) {
        }
        multicastLock = null
        foundHosts.clear()
    }

    private fun rebuildHostList() {
        binding.hostList.removeAllViews()
        binding.discoveryEmpty.text = getString(
            if (foundHosts.isEmpty()) R.string.client_discovery_searching else R.string.client_discovery_tap,
        )
        val inflater = LayoutInflater.from(this)
        for (host in foundHosts.values) {
            val item = ItemHostBinding.inflate(inflater, binding.hostList, false)
            item.hostName.text = host.serviceName
            item.hostAddress.text = getString(R.string.host_address_format, host.hostAddress, host.port)
            item.root.setOnClickListener { connect(host.hostAddress, host.port, host.serviceName) }
            binding.hostList.addView(item.root)
        }
    }

    private fun refreshUi() {
        val state = ClientSession.state
        val connected = state != ClientEngine.State.STOPPED

        binding.buttonDisconnect.isEnabled = connected
        binding.statusDot.isActivated = state == ClientEngine.State.PLAYING
        binding.statusText.text = when (state) {
            ClientEngine.State.STOPPED -> getString(R.string.client_state_stopped)
            ClientEngine.State.CONNECTING -> getString(R.string.client_state_connecting, ClientSession.hostLabel ?: "")
            ClientEngine.State.BUFFERING -> getString(R.string.client_state_buffering)
            ClientEngine.State.PLAYING -> getString(R.string.client_state_playing, ClientSession.hostLabel ?: "")
            ClientEngine.State.RECONNECTING -> getString(R.string.client_state_reconnecting)
            ClientEngine.State.FAILED -> getString(R.string.client_state_failed)
        }

        val stats = if (connected) ClientSession.stats else null
        if (stats != null) {
            binding.statBitrate.text = Format.bitrate(stats.bitsPerSecond)
            binding.statBuffer.text = getString(R.string.client_stat_buffer_format, stats.bufferDepth, stats.bufferTarget)
            binding.statLoss.text = Format.percent(stats.lossRatio)
            binding.statReceived.text = Format.bytes(stats.totalBytes)
        } else {
            binding.statBitrate.text = "–"
            binding.statBuffer.text = "–"
            binding.statLoss.text = "–"
            binding.statReceived.text = "–"
        }

        if (ClientSession.errorSerial != seenErrorSerial) {
            seenErrorSerial = ClientSession.errorSerial
            ClientSession.lastError?.let {
                Snackbar.make(binding.root, it, Snackbar.LENGTH_LONG).show()
            }
        }
    }

    private companion object {
        const val UI_INTERVAL_MS = 500L
    }
}

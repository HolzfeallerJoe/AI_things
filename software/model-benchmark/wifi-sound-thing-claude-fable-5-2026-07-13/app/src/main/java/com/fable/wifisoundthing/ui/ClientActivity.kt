package com.fable.wifisoundthing.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.fable.wifisoundthing.R
import com.fable.wifisoundthing.client.ClientService
import com.fable.wifisoundthing.databinding.ActivityClientBinding
import com.fable.wifisoundthing.net.DiscoveryScanner
import com.fable.wifisoundthing.protocol.Wire
import com.fable.wifisoundthing.state.ClientPhase
import com.fable.wifisoundthing.state.ClientStateHolder
import com.fable.wifisoundthing.state.ClientUiState
import com.fable.wifisoundthing.util.Prefs
import com.google.android.material.snackbar.Snackbar
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ClientActivity : AppCompatActivity() {

    private lateinit var binding: ActivityClientBinding
    private lateinit var prefs: Prefs
    private lateinit var adapter: HostListAdapter
    private var pendingConnect: Pair<String, Int>? = null

    private val notificationLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) {
            // Connect regardless: the notification is helpful but not required.
            pendingConnect?.let { (host, port) -> doConnect(host, port) }
            pendingConnect = null
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityClientBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.toolbar.setNavigationOnClickListener { finish() }

        prefs = Prefs(this)
        binding.manualInput.setText(prefs.lastHostAddress)

        val presets = resources.getStringArray(R.array.buffer_presets)
        binding.bufferInput.setSimpleItems(presets)
        binding.bufferInput.setText(
            when (prefs.bufferPreset) {
                "low" -> presets[0]
                "safe" -> presets[2]
                else -> presets[1]
            },
            false,
        )
        binding.bufferInput.setOnItemClickListener { _, _, position, _ ->
            prefs.bufferPreset = when (position) {
                0 -> "low"
                2 -> "safe"
                else -> "normal"
            }
        }

        adapter = HostListAdapter { host ->
            prefs.lastHostAddress =
                if (host.port == Wire.DEFAULT_CONTROL_PORT) host.address
                else "${host.address}:${host.port}"
            binding.manualInput.setText(prefs.lastHostAddress)
            connect(host.address, host.port)
        }
        binding.hostList.adapter = adapter

        binding.connectButton.setOnClickListener {
            val text = binding.manualInput.text?.toString()?.trim().orEmpty()
            val parsed = parseAddress(text)
            if (parsed == null) {
                Snackbar.make(binding.root, R.string.error_bad_address, Snackbar.LENGTH_LONG).show()
            } else {
                prefs.lastHostAddress = text
                connect(parsed.first, parsed.second)
            }
        }
        binding.disconnectButton.setOnClickListener { ClientService.disconnect(this) }

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    ClientStateHolder.state.collect { render(it) }
                }
                launch { scanLoop() }
            }
        }
    }

    /** Repeatedly scans for hosts while the user is on the "not connected" screen. */
    private suspend fun scanLoop() {
        val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        val lock = wifi.createMulticastLock("wst:scan").apply { setReferenceCounted(false) }
        try {
            lock.acquire()
            while (true) {
                if (ClientStateHolder.state.value.phase == ClientPhase.IDLE) {
                    val hosts = withContext(Dispatchers.IO) { DiscoveryScanner.scan() }
                    if (!lifecycleScope.isActive) return
                    adapter.submit(hosts)
                    binding.scanEmpty.visibility =
                        if (hosts.isEmpty()) View.VISIBLE else View.GONE
                }
                delay(1_500)
            }
        } finally {
            try {
                lock.release()
            } catch (_: Exception) {
            }
        }
    }

    private fun connect(host: String, port: Int) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            pendingConnect = host to port
            notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            doConnect(host, port)
        }
    }

    private fun doConnect(host: String, port: Int) {
        ClientService.connect(this, host, port)
    }

    private fun parseAddress(text: String): Pair<String, Int>? {
        if (text.isEmpty()) return null
        val parts = text.split(":")
        return when (parts.size) {
            1 -> parts[0] to Wire.DEFAULT_CONTROL_PORT
            2 -> {
                val port = parts[1].toIntOrNull() ?: return null
                if (port !in 1..65535) return null
                parts[0] to port
            }
            else -> null
        }
    }

    private fun render(state: ClientUiState) {
        val idle = state.phase == ClientPhase.IDLE
        binding.connectGroup.visibility = if (idle) View.VISIBLE else View.GONE
        binding.statusCard.visibility = if (idle) View.GONE else View.VISIBLE
        binding.disconnectButton.isEnabled = !idle

        binding.phaseText.text = when (state.phase) {
            ClientPhase.IDLE -> getString(R.string.client_phase_idle)
            ClientPhase.CONNECTING -> getString(R.string.client_phase_connecting)
            ClientPhase.CONNECTED -> getString(R.string.client_phase_connected)
            ClientPhase.RECONNECTING -> getString(R.string.client_phase_reconnecting)
        }
        binding.hostValue.text = state.hostName
            ?.let { "$it (${state.hostAddress ?: "?"})" }
            ?: state.hostAddress ?: "–"
        binding.codecClientValue.text = state.codec.ifEmpty { "–" }
        binding.lossValue.text = String.format("%.1f %%", state.lossPercent)
        binding.bufferValue.text = getString(R.string.client_buffer_ms, state.bufferMs)
        binding.bitrateValue.text = getString(R.string.client_kbps, state.kbps)

        binding.clientErrorText.visibility = if (state.error != null) View.VISIBLE else View.GONE
        binding.clientErrorText.text = state.error.orEmpty()
    }
}

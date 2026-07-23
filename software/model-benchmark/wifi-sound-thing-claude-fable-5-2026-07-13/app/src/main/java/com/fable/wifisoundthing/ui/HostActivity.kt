package com.fable.wifisoundthing.ui

import android.Manifest
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
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
import com.fable.wifisoundthing.databinding.ActivityHostBinding
import com.fable.wifisoundthing.host.HostService
import com.fable.wifisoundthing.state.HostStateHolder
import com.fable.wifisoundthing.state.HostUiState
import com.fable.wifisoundthing.util.Prefs
import com.google.android.material.snackbar.Snackbar
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class HostActivity : AppCompatActivity() {

    private lateinit var binding: ActivityHostBinding
    private lateinit var prefs: Prefs
    private var latestState = HostUiState()

    private val projectionLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val data = result.data
            if (result.resultCode == RESULT_OK && data != null) {
                HostService.start(this, result.resultCode, data)
            } else {
                Snackbar.make(
                    binding.root,
                    R.string.error_projection_denied,
                    Snackbar.LENGTH_LONG,
                ).show()
            }
        }

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
            if (grants[Manifest.permission.RECORD_AUDIO] == true) {
                requestProjection()
            } else {
                Snackbar.make(
                    binding.root,
                    R.string.error_record_audio_denied,
                    Snackbar.LENGTH_LONG,
                ).show()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityHostBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.toolbar.setNavigationOnClickListener { finish() }

        prefs = Prefs(this)
        binding.nameInput.setText(prefs.deviceName)
        if (prefs.codecMode == "pcm") {
            binding.codecPcm.isChecked = true
        } else {
            binding.codecAuto.isChecked = true
        }

        binding.startButton.setOnClickListener {
            saveSettings()
            ensurePermissionsThenStart()
        }
        binding.stopButton.setOnClickListener { HostService.stop(this) }

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    HostStateHolder.state.collect { state ->
                        latestState = state
                        render(state)
                    }
                }
                launch {
                    while (true) {
                        renderUptime()
                        delay(1_000)
                    }
                }
            }
        }
    }

    private fun saveSettings() {
        val name = binding.nameInput.text?.toString()?.trim().orEmpty()
        if (name.isNotEmpty()) prefs.deviceName = name
        prefs.codecMode = if (binding.codecPcm.isChecked) "pcm" else "auto"
    }

    private fun ensurePermissionsThenStart() {
        val needed = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            needed.add(Manifest.permission.RECORD_AUDIO)
        }
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (needed.isEmpty()) {
            requestProjection()
        } else {
            permissionLauncher.launch(needed.toTypedArray())
        }
    }

    private fun requestProjection() {
        val manager = getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        projectionLauncher.launch(manager.createScreenCaptureIntent())
    }

    private fun render(state: HostUiState) {
        binding.startButton.isEnabled = !state.running
        binding.stopButton.isEnabled = state.running
        binding.settingsGroup.visibility = if (state.running) View.GONE else View.VISIBLE
        binding.statusCard.visibility = if (state.running) View.VISIBLE else View.GONE

        binding.statusText.text = if (state.running) {
            getString(R.string.host_status_broadcasting)
        } else {
            getString(R.string.host_status_idle)
        }

        if (state.running) {
            binding.addressValue.text = state.address
                ?.let { "$it:${state.controlPort}" }
                ?: getString(R.string.host_address_unknown)
            binding.codecValue.text = state.codec
            binding.clientsValue.text = if (state.clientNames.isEmpty()) {
                state.clientCount.toString()
            } else {
                "${state.clientCount} (${state.clientNames.joinToString()})"
            }
            binding.dataValue.text = formatBytes(state.bytesSent)
            binding.levelMeter.progress = state.levelPercent.coerceIn(0, 100)
            binding.silentHint.visibility = if (state.captureSilent) View.VISIBLE else View.GONE
        }

        binding.errorText.visibility = if (state.error != null) View.VISIBLE else View.GONE
        binding.errorText.text = state.error.orEmpty()

        renderUptime()
    }

    private fun renderUptime() {
        if (!latestState.running || latestState.startedAtMs == 0L) {
            binding.uptimeValue.text = "–"
            return
        }
        val seconds = (System.currentTimeMillis() - latestState.startedAtMs) / 1000
        binding.uptimeValue.text = String.format(
            "%d:%02d:%02d", seconds / 3600, (seconds % 3600) / 60, seconds % 60
        )
    }

    private fun formatBytes(bytes: Long): String = when {
        bytes >= 1_000_000_000 -> String.format("%.2f GB", bytes / 1_000_000_000.0)
        bytes >= 1_000_000 -> String.format("%.1f MB", bytes / 1_000_000.0)
        else -> String.format("%d kB", bytes / 1_000)
    }
}

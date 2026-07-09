package app.wifisoundthing.ui

import android.Manifest
import android.app.Activity
import android.content.Context
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.ArrayAdapter
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import android.content.pm.PackageManager
import app.wifisoundthing.R
import app.wifisoundthing.app.HostSession
import app.wifisoundthing.app.NetInfo
import app.wifisoundthing.app.Prefs
import app.wifisoundthing.core.Format
import app.wifisoundthing.databinding.ActivityHostBinding
import app.wifisoundthing.service.HostService
import com.google.android.material.snackbar.Snackbar

/** Host screen: start/stop the broadcast and monitor it (FR-3, FR-11, FR-12). */
class HostActivity : AppCompatActivity() {

    private lateinit var binding: ActivityHostBinding
    private lateinit var prefs: Prefs
    private val handler = Handler(Looper.getMainLooper())
    private var seenErrorSerial = 0L

    private val projectionLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val data = result.data
            if (result.resultCode == Activity.RESULT_OK && data != null) {
                HostService.start(this, result.resultCode, data, prefs.hostBitrate)
            } else {
                Snackbar.make(binding.root, R.string.host_error_consent_denied, Snackbar.LENGTH_LONG).show()
            }
        }

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
            if (grants[Manifest.permission.RECORD_AUDIO] == true) {
                requestProjection()
            } else {
                Snackbar.make(binding.root, R.string.host_error_mic_denied, Snackbar.LENGTH_LONG).show()
            }
        }

    private val uiUpdater = object : Runnable {
        override fun run() {
            refreshUi()
            handler.postDelayed(this, UI_INTERVAL_MS)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityHostBinding.inflate(layoutInflater)
        setContentView(binding.root)
        prefs = Prefs(this)
        seenErrorSerial = HostSession.errorSerial

        val labels = resources.getStringArray(R.array.bitrate_labels)
        binding.spinnerBitrate.setAdapter(ArrayAdapter(this, android.R.layout.simple_list_item_1, labels))
        val savedIndex = Prefs.BITRATE_OPTIONS.indexOf(prefs.hostBitrate).takeIf { it >= 0 } ?: 1
        binding.spinnerBitrate.setText(labels[savedIndex], false)
        binding.spinnerBitrate.setOnItemClickListener { _, _, position, _ ->
            prefs.hostBitrate = Prefs.BITRATE_OPTIONS[position]
        }

        binding.buttonToggle.setOnClickListener {
            if (HostSession.state == HostSession.State.RUNNING) {
                HostService.stop(this)
            } else {
                startFlow()
            }
        }
    }

    override fun onStart() {
        super.onStart()
        handler.post(uiUpdater)
    }

    override fun onStop() {
        handler.removeCallbacks(uiUpdater)
        super.onStop()
    }

    private fun startFlow() {
        val wanted = mutableListOf(Manifest.permission.RECORD_AUDIO)
        if (Build.VERSION.SDK_INT >= 33) wanted += Manifest.permission.POST_NOTIFICATIONS
        val missing = wanted.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        // POST_NOTIFICATIONS being denied must not block the feature.
        if (missing.contains(Manifest.permission.RECORD_AUDIO) || missing.size > 1) {
            permissionLauncher.launch(missing.toTypedArray())
        } else {
            requestProjection()
        }
    }

    private fun requestProjection() {
        val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        projectionLauncher.launch(manager.createScreenCaptureIntent())
    }

    private fun refreshUi() {
        val running = HostSession.state == HostSession.State.RUNNING

        binding.buttonToggle.text = getString(if (running) R.string.host_button_stop else R.string.host_button_start)
        binding.statusText.text = getString(if (running) R.string.host_status_running else R.string.host_status_idle)
        binding.statusDot.isActivated = running
        binding.spinnerBitrateLayout.isEnabled = !running

        val address = if (running) HostSession.displayAddress else NetInfo.displayAddress()
        binding.addressText.text = if (address != null) {
            getString(R.string.host_address_format, address, app.wifisoundthing.core.Protocol.DEFAULT_CONTROL_PORT)
        } else {
            getString(R.string.host_address_unknown)
        }

        if (running) {
            binding.statPeers.text = HostSession.clientCount.toString()
            binding.statUptime.text = Format.duration(System.currentTimeMillis() - HostSession.startedAtMs)
            binding.statSent.text = Format.bytes(HostSession.totalBytesSent)
            binding.statBitrate.text = Format.bitrate(HostSession.bitsPerSecond)
        } else {
            binding.statPeers.text = "–"
            binding.statUptime.text = "–"
            binding.statSent.text = "–"
            binding.statBitrate.text = "–"
        }

        if (HostSession.errorSerial != seenErrorSerial) {
            seenErrorSerial = HostSession.errorSerial
            HostSession.lastError?.let {
                Snackbar.make(binding.root, it, Snackbar.LENGTH_LONG).show()
            }
        }
    }

    private companion object {
        const val UI_INTERVAL_MS = 500L
    }
}

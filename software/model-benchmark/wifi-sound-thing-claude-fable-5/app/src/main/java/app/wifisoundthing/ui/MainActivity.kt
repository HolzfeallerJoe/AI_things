package app.wifisoundthing.ui

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import app.wifisoundthing.app.Prefs
import app.wifisoundthing.databinding.ActivityMainBinding

/** Role selection screen (FR-1): one app, Host or Client. */
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        val prefs = Prefs(this)

        binding.buttonHost.setOnClickListener {
            prefs.lastRole = "host"
            startActivity(Intent(this, HostActivity::class.java))
        }
        binding.buttonClient.setOnClickListener {
            prefs.lastRole = "client"
            startActivity(Intent(this, ClientActivity::class.java))
        }

        when (prefs.lastRole) {
            "host" -> binding.lastRoleHint.text = getString(app.wifisoundthing.R.string.main_last_role_host)
            "client" -> binding.lastRoleHint.text = getString(app.wifisoundthing.R.string.main_last_role_client)
            else -> binding.lastRoleHint.text = ""
        }
    }
}

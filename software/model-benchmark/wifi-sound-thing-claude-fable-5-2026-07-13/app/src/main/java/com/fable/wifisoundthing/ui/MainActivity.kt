package com.fable.wifisoundthing.ui

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.fable.wifisoundthing.databinding.ActivityMainBinding

/** Role chooser (FR-1): one app, the user picks Host or Client. */
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.hostCard.setOnClickListener {
            startActivity(Intent(this, HostActivity::class.java))
        }
        binding.clientCard.setOnClickListener {
            startActivity(Intent(this, ClientActivity::class.java))
        }
    }
}

package com.fable.wifisoundthing.ui

import android.annotation.SuppressLint
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.fable.wifisoundthing.databinding.ItemHostBinding
import com.fable.wifisoundthing.net.DiscoveredHost

class HostListAdapter(
    private val onClick: (DiscoveredHost) -> Unit,
) : RecyclerView.Adapter<HostListAdapter.ViewHolder>() {

    private val hosts = ArrayList<DiscoveredHost>()

    @SuppressLint("NotifyDataSetChanged") // lists have a handful of entries at most
    fun submit(newHosts: List<DiscoveredHost>) {
        if (newHosts == hosts) return
        hosts.clear()
        hosts.addAll(newHosts)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemHostBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val host = hosts[position]
        holder.binding.hostName.text = host.name
        holder.binding.hostAddress.text = "${host.address}:${host.port}"
        holder.binding.root.setOnClickListener { onClick(host) }
    }

    override fun getItemCount(): Int = hosts.size

    class ViewHolder(val binding: ItemHostBinding) : RecyclerView.ViewHolder(binding.root)
}

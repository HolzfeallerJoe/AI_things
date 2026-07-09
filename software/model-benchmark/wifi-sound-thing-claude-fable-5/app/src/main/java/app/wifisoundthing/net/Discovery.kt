package app.wifisoundthing.net

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.util.Log
import app.wifisoundthing.core.Protocol
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Zero-configuration host discovery via Android's Network Service Discovery
 * (mDNS/DNS-SD). The host advertises `_wifisoundthing._tcp.`; clients browse
 * for it. Manual address entry stays available as a fallback (FR-6).
 */
object Discovery {
    private const val TAG = "Discovery"

    /** Advertises the running host on the local network. */
    class Advertiser(context: Context, private val serviceName: String, private val port: Int) {
        private val nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
        private var listener: NsdManager.RegistrationListener? = null

        fun start() {
            val info = NsdServiceInfo().apply {
                serviceName = this@Advertiser.serviceName
                serviceType = Protocol.SERVICE_TYPE
                port = this@Advertiser.port
            }
            val l = object : NsdManager.RegistrationListener {
                override fun onServiceRegistered(info: NsdServiceInfo) {
                    Log.i(TAG, "Advertised as ${info.serviceName}")
                }

                override fun onRegistrationFailed(info: NsdServiceInfo, errorCode: Int) {
                    Log.w(TAG, "NSD registration failed: $errorCode (manual connect still works)")
                }

                override fun onServiceUnregistered(info: NsdServiceInfo) {}
                override fun onUnregistrationFailed(info: NsdServiceInfo, errorCode: Int) {}
            }
            listener = l
            nsdManager.registerService(info, NsdManager.PROTOCOL_DNS_SD, l)
        }

        fun stop() {
            listener?.let {
                try {
                    nsdManager.unregisterService(it)
                } catch (e: Exception) {
                    Log.w(TAG, "unregisterService: ${e.message}")
                }
            }
            listener = null
        }
    }

    class FoundHost(val serviceName: String, val hostAddress: String, val port: Int)

    /** Browses for hosts. Resolves services one at a time (NsdManager cannot resolve concurrently). */
    class Browser(context: Context, private val callback: Callback) {
        interface Callback {
            /** Called from NSD binder threads. */
            fun onHostFound(host: FoundHost)

            fun onHostLost(serviceName: String)
        }

        private val nsdManager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
        private var discoveryListener: NsdManager.DiscoveryListener? = null
        private val resolveQueue = ConcurrentLinkedQueue<NsdServiceInfo>()
        private val resolving = AtomicBoolean(false)
        @Volatile
        private var stopped = false

        fun start() {
            stopped = false
            val l = object : NsdManager.DiscoveryListener {
                override fun onDiscoveryStarted(serviceType: String) {}

                override fun onServiceFound(info: NsdServiceInfo) {
                    if (info.serviceType.trimEnd('.') == Protocol.SERVICE_TYPE.trimEnd('.')) {
                        resolveQueue.add(info)
                        resolveNext()
                    }
                }

                override fun onServiceLost(info: NsdServiceInfo) {
                    callback.onHostLost(info.serviceName)
                }

                override fun onDiscoveryStopped(serviceType: String) {}

                override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                    Log.w(TAG, "Discovery start failed: $errorCode")
                }

                override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
            }
            discoveryListener = l
            nsdManager.discoverServices(Protocol.SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, l)
        }

        private fun resolveNext() {
            if (stopped || !resolving.compareAndSet(false, true)) return
            val next = resolveQueue.poll()
            if (next == null) {
                resolving.set(false)
                return
            }
            @Suppress("DEPRECATION") // replacement requires API 34; minSdk is 29
            nsdManager.resolveService(
                next,
                object : NsdManager.ResolveListener {
                    override fun onServiceResolved(info: NsdServiceInfo) {
                        val address = info.host?.hostAddress
                        if (address != null && !stopped) {
                            callback.onHostFound(FoundHost(info.serviceName, address, info.port))
                        }
                        resolving.set(false)
                        resolveNext()
                    }

                    override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) {
                        Log.w(TAG, "Resolve failed for ${info.serviceName}: $errorCode")
                        resolving.set(false)
                        resolveNext()
                    }
                },
            )
        }

        fun stop() {
            stopped = true
            resolveQueue.clear()
            discoveryListener?.let {
                try {
                    nsdManager.stopServiceDiscovery(it)
                } catch (e: Exception) {
                    Log.w(TAG, "stopServiceDiscovery: ${e.message}")
                }
            }
            discoveryListener = null
        }
    }
}

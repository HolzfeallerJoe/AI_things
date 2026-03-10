package com.portblocker.app.network

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "PortBlocker")
class PortBlockerPlugin : Plugin() {
    private val stateListener: (BlockerState) -> Unit = { emitStatusChange(it) }

    override fun load() {
        super.load()
        PortBlockerRegistry.addStatusListener(stateListener)
    }

    @PluginMethod
    fun startBlocker(call: PluginCall) {
        val port = call.getInt("port")
        val protocol = call.getString("protocol") ?: "tcp"

        if (port == null || port < 1 || port > 65535) {
            call.reject("Invalid port number")
            return
        }

        try {
            if (protocol != "tcp" && protocol != "udp") {
                call.reject("Unsupported protocol: $protocol")
                return
            }

            val state = PortBlockerRegistry.startBlocker(port, protocol)
            PortBlockerForegroundService.sync(context)

            val result = JSObject()
            result.put("id", state.id)
            result.put("port", port)
            result.put("protocol", protocol)
            call.resolve(result)
        } catch (e: Exception) {
            call.reject("Failed to start blocker: ${e.message}")
        }
    }

    @PluginMethod
    fun pauseBlocker(call: PluginCall) {
        val id = call.getString("id") ?: run {
            call.reject("Missing blocker id")
            return
        }

        try {
            PortBlockerRegistry.pauseBlocker(id)
            PortBlockerForegroundService.sync(context)
        } catch (e: Exception) {
            call.reject("Failed to pause blocker: ${e.message}")
            return
        }
        call.resolve()
    }

    @PluginMethod
    fun resumeBlocker(call: PluginCall) {
        val id = call.getString("id") ?: run {
            call.reject("Missing blocker id")
            return
        }

        try {
            PortBlockerRegistry.resumeBlocker(id)
            PortBlockerForegroundService.sync(context)
        } catch (e: Exception) {
            call.reject("Failed to resume blocker: ${e.message}")
            return
        }
        call.resolve()
    }

    @PluginMethod
    fun stopBlocker(call: PluginCall) {
        val id = call.getString("id") ?: run {
            call.reject("Missing blocker id")
            return
        }

        try {
            PortBlockerRegistry.stopBlocker(id)
            PortBlockerForegroundService.sync(context)
        } catch (e: Exception) {
            call.reject("Failed to stop blocker: ${e.message}")
            return
        }

        call.resolve()
    }

    @PluginMethod
    fun getBlockers(call: PluginCall) {
        val arr = JSArray()
        for (state in PortBlockerRegistry.getBlockers()) {
            arr.put(stateToJson(state))
        }

        val result = JSObject()
        result.put("blockers", arr)
        call.resolve(result)
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        PortBlockerRegistry.removeStatusListener(stateListener)
    }

    private fun emitStatusChange(state: BlockerState) {
        val data = JSObject()
        data.put("id", state.id)
        data.put("port", state.port)
        data.put("protocol", state.protocol)
        data.put("status", state.status.name.lowercase())
        data.put("connectionsCount", state.connectionsCount)
        data.put("bytesReceived", state.bytesReceived)
        data.put("lastActivity", state.lastActivity?.toString())
        data.put("errorMessage", state.errorMessage)
        notifyListeners("blockerStatusChanged", data)
    }

    private fun stateToJson(state: BlockerState): JSObject {
        val obj = JSObject()
        obj.put("id", state.id)
        obj.put("port", state.port)
        obj.put("protocol", state.protocol)
        obj.put("status", state.status.name.lowercase())
        obj.put("connectionsCount", state.connectionsCount)
        obj.put("bytesReceived", state.bytesReceived)
        obj.put("lastActivity", state.lastActivity?.toString())
        obj.put("errorMessage", state.errorMessage)
        return obj
    }
}

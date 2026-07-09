package app.wifisoundthing.app

import app.wifisoundthing.net.ClientEngine

/**
 * In-process state shared between the foreground services and the activities.
 * Activities poll these on a short interval (simple and lifecycle-safe) and
 * additionally read [lastError] to surface problems in plain language (FR-12).
 */
object HostSession {
    enum class State { IDLE, RUNNING }

    @Volatile var state: State = State.IDLE
    @Volatile var startedAtMs: Long = 0
    @Volatile var clientCount: Int = 0
    @Volatile var totalBytesSent: Long = 0
    @Volatile var bitsPerSecond: Long = 0
    @Volatile var displayAddress: String? = null
    @Volatile var controlPort: Int = 0

    /** Monotonically increasing so the UI can detect and show new errors once. */
    @Volatile var errorSerial: Long = 0
    @Volatile var lastError: String? = null

    fun postError(message: String) {
        lastError = message
        errorSerial++
    }

    fun resetStats() {
        startedAtMs = 0
        clientCount = 0
        totalBytesSent = 0
        bitsPerSecond = 0
    }
}

object ClientSession {
    @Volatile var state: ClientEngine.State = ClientEngine.State.STOPPED
    @Volatile var stateDetail: String? = null
    @Volatile var hostLabel: String? = null
    @Volatile var stats: ClientEngine.Stats? = null

    @Volatile var errorSerial: Long = 0
    @Volatile var lastError: String? = null

    fun postError(message: String) {
        lastError = message
        errorSerial++
    }
}

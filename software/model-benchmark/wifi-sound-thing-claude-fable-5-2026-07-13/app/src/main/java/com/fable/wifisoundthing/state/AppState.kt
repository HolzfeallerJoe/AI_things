package com.fable.wifisoundthing.state

import com.fable.wifisoundthing.protocol.Wire
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update

/**
 * Process-wide observable state, written by the foreground services and rendered by the
 * activities. Kept as simple singletons because services and UI live in one process.
 */

data class HostUiState(
    val running: Boolean = false,
    val address: String? = null,
    val controlPort: Int = Wire.DEFAULT_CONTROL_PORT,
    val codec: String = "",
    val clientCount: Int = 0,
    val clientNames: List<String> = emptyList(),
    val startedAtMs: Long = 0L,
    val bytesSent: Long = 0L,
    val levelPercent: Int = 0,
    /** True when capture runs but only silence arrives (source app likely blocks capture). */
    val captureSilent: Boolean = false,
    /** Plain-language error for the user, or null. */
    val error: String? = null,
)

object HostStateHolder {
    private val _state = MutableStateFlow(HostUiState())
    val state: StateFlow<HostUiState> = _state
    fun update(transform: (HostUiState) -> HostUiState) = _state.update(transform)
    fun reset(error: String? = null) {
        _state.value = HostUiState(error = error)
    }
}

enum class ClientPhase { IDLE, CONNECTING, CONNECTED, RECONNECTING }

data class ClientUiState(
    val phase: ClientPhase = ClientPhase.IDLE,
    val hostName: String? = null,
    val hostAddress: String? = null,
    val codec: String = "",
    val lossPercent: Double = 0.0,
    val bufferMs: Int = 0,
    val kbps: Int = 0,
    val packetsReceived: Long = 0L,
    val error: String? = null,
)

object ClientStateHolder {
    private val _state = MutableStateFlow(ClientUiState())
    val state: StateFlow<ClientUiState> = _state
    fun update(transform: (ClientUiState) -> ClientUiState) = _state.update(transform)
    fun reset(error: String? = null) {
        _state.value = ClientUiState(error = error)
    }
}

package app.wifisoundthing.core

/**
 * Wire-protocol constants shared by host and client.
 *
 * Transport layout:
 *  - Control channel: TCP, framed messages (see [ControlMessage]).
 *  - Audio channel:   UDP, one encoded audio frame per datagram (see [AudioPacketCodec]).
 */
object Protocol {
    /** Bump when the wire format changes incompatibly. */
    const val VERSION: Int = 1

    /** Default TCP port the host listens on for control connections. */
    const val DEFAULT_CONTROL_PORT: Int = 46464

    /** mDNS/NSD service type used for host discovery. */
    const val SERVICE_TYPE: String = "_wifisoundthing._tcp."

    /** First two bytes of every UDP audio datagram: "WS". */
    const val MAGIC: Int = 0x5753

    /** Audio codec ids carried in [AudioConfig.codec]. */
    const val CODEC_AAC_LC: Int = 1

    /** Datagrams larger than this are rejected as garbage. */
    const val MAX_AUDIO_PAYLOAD: Int = 4096

    /** Control frames larger than this are rejected as garbage. */
    const val MAX_CONTROL_PAYLOAD: Int = 4096

    /** How often the client sends a PING on the control channel. */
    const val PING_INTERVAL_MS: Long = 2000

    /** Peer is considered dead when silent for this long. */
    const val PEER_TIMEOUT_MS: Long = 8000
}

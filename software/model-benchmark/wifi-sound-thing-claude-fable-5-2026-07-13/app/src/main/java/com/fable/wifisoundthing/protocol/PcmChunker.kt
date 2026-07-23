package com.fable.wifisoundthing.protocol

/**
 * Splits a block of PCM into datagram-sized chunks aligned to whole sample frames, so a
 * lost packet never desynchronizes the interleaved channel layout.
 */
object PcmChunker {
    fun chunk(
        data: ByteArray,
        length: Int = data.size,
        chunkBytes: Int = Wire.PCM_CHUNK_BYTES,
        frameBytes: Int = Wire.CHANNELS * Wire.BYTES_PER_SAMPLE,
    ): List<ByteArray> {
        require(chunkBytes >= frameBytes) { "chunk smaller than one sample frame" }
        val aligned = (chunkBytes / frameBytes) * frameBytes
        val out = ArrayList<ByteArray>((length + aligned - 1) / aligned)
        var pos = 0
        while (pos < length) {
            val size = minOf(aligned, length - pos)
            out.add(data.copyOfRange(pos, pos + size))
            pos += size
        }
        return out
    }
}

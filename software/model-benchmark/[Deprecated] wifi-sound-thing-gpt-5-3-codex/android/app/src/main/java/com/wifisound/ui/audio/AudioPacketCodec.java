package com.wifisound.ui.audio;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

final class AudioPacketCodec {
    static final int MAGIC = 0x57534131; // WSA1
    static final int HEADER_SIZE = 28;

    private AudioPacketCodec() {}

    static byte[] encode(
        int sequence,
        long timestampUs,
        int sampleRate,
        int channels,
        int frameSize,
        byte[] payload,
        int payloadLength
    ) {
        ByteBuffer buffer = ByteBuffer.allocate(HEADER_SIZE + payloadLength).order(ByteOrder.BIG_ENDIAN);
        buffer.putInt(MAGIC);
        buffer.putInt(sequence);
        buffer.putLong(timestampUs);
        buffer.putInt(sampleRate);
        buffer.putShort((short) channels);
        buffer.putShort((short) frameSize);
        buffer.putInt(payloadLength);
        buffer.put(payload, 0, payloadLength);
        return buffer.array();
    }

    static DecodedPacket decode(byte[] packet, int packetLength) {
        if (packetLength < HEADER_SIZE) {
            return null;
        }

        ByteBuffer buffer = ByteBuffer.wrap(packet, 0, packetLength).order(ByteOrder.BIG_ENDIAN);
        int magic = buffer.getInt();
        if (magic != MAGIC) {
            return null;
        }

        int sequence = buffer.getInt();
        long timestampUs = buffer.getLong();
        int sampleRate = buffer.getInt();
        int channels = buffer.getShort() & 0xFFFF;
        int frameSize = buffer.getShort() & 0xFFFF;
        int payloadLength = buffer.getInt();

        if (payloadLength < 1 || payloadLength > packetLength - HEADER_SIZE) {
            return null;
        }

        byte[] payload = new byte[payloadLength];
        buffer.get(payload, 0, payloadLength);
        return new DecodedPacket(sequence, timestampUs, sampleRate, channels, frameSize, payload);
    }

    static final class DecodedPacket {
        final int sequence;
        final long timestampUs;
        final int sampleRate;
        final int channels;
        final int frameSize;
        final byte[] payload;

        DecodedPacket(int sequence, long timestampUs, int sampleRate, int channels, int frameSize, byte[] payload) {
            this.sequence = sequence;
            this.timestampUs = timestampUs;
            this.sampleRate = sampleRate;
            this.channels = channels;
            this.frameSize = frameSize;
            this.payload = payload;
        }
    }
}

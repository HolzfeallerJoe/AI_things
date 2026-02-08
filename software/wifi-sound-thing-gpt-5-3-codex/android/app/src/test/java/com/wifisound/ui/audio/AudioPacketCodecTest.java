package com.wifisound.ui.audio;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class AudioPacketCodecTest {
    @Test
    public void encodeDecode_roundTrip() {
        byte[] payload = new byte[] { 1, 2, 3, 4, 5, 6 };

        byte[] packet = AudioPacketCodec.encode(
            12,
            456_000L,
            48_000,
            2,
            960,
            payload,
            payload.length
        );

        AudioPacketCodec.DecodedPacket decoded = AudioPacketCodec.decode(packet, packet.length);
        assertNotNull(decoded);
        assertEquals(12, decoded.sequence);
        assertEquals(456_000L, decoded.timestampUs);
        assertEquals(48_000, decoded.sampleRate);
        assertEquals(2, decoded.channels);
        assertEquals(960, decoded.frameSize);
        assertArrayEquals(payload, decoded.payload);
    }

    @Test
    public void decode_rejectsInvalidMagic() {
        byte[] payload = new byte[] { 10, 20, 30, 40 };
        byte[] packet = AudioPacketCodec.encode(
            1,
            1_000L,
            44_100,
            1,
            1024,
            payload,
            payload.length
        );

        packet[0] = 0x00;
        AudioPacketCodec.DecodedPacket decoded = AudioPacketCodec.decode(packet, packet.length);
        assertNull(decoded);
    }

    @Test
    public void decode_rejectsTruncatedPayload() {
        byte[] payload = new byte[] { 7, 8, 9, 10, 11, 12 };
        byte[] packet = AudioPacketCodec.encode(
            9,
            99_000L,
            48_000,
            2,
            480,
            payload,
            payload.length
        );

        AudioPacketCodec.DecodedPacket decoded = AudioPacketCodec.decode(packet, packet.length - 2);
        assertNull(decoded);
    }
}

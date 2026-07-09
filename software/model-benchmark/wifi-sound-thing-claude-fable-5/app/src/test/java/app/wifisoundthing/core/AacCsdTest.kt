package app.wifisoundthing.core

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

class AacCsdTest {

    @Test
    fun `48kHz stereo produces the canonical AAC-LC config`() {
        // objectType=2 (AAC-LC), freqIndex=3 (48000), channels=2 -> 0x11 0x90
        assertArrayEquals(byteArrayOf(0x11, 0x90.toByte()), AacCsd.audioSpecificConfig(48000, 2))
    }

    @Test
    fun `44_1kHz stereo produces the canonical config`() {
        // freqIndex=4 (44100) -> 0x12 0x10
        assertArrayEquals(byteArrayOf(0x12, 0x10), AacCsd.audioSpecificConfig(44100, 2))
    }

    @Test
    fun `48kHz mono produces the canonical config`() {
        // channels=1 -> 0x11 0x88
        assertArrayEquals(byteArrayOf(0x11, 0x88.toByte()), AacCsd.audioSpecificConfig(48000, 1))
    }

    @Test
    fun `frequency index table matches the MPEG-4 spec`() {
        assertEquals(3, AacCsd.frequencyIndex(48000))
        assertEquals(4, AacCsd.frequencyIndex(44100))
        assertEquals(8, AacCsd.frequencyIndex(16000))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `unsupported sample rate is refused`() {
        AacCsd.audioSpecificConfig(12345, 2)
    }
}

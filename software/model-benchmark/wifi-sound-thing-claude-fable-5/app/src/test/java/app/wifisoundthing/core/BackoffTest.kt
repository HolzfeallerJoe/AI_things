package app.wifisoundthing.core

import org.junit.Assert.assertEquals
import org.junit.Test

class BackoffTest {

    @Test
    fun `delays grow exponentially`() {
        assertEquals(500L, Backoff.delayMs(0))
        assertEquals(1000L, Backoff.delayMs(1))
        assertEquals(2000L, Backoff.delayMs(2))
        assertEquals(4000L, Backoff.delayMs(3))
        assertEquals(8000L, Backoff.delayMs(4))
    }

    @Test
    fun `delay is capped at the maximum`() {
        assertEquals(8000L, Backoff.delayMs(5))
        assertEquals(8000L, Backoff.delayMs(100))
        assertEquals(8000L, Backoff.delayMs(Int.MAX_VALUE))
    }

    @Test
    fun `negative attempts behave like the first attempt`() {
        assertEquals(500L, Backoff.delayMs(-3))
    }
}

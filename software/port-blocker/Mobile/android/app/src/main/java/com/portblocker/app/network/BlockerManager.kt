package com.portblocker.app.network

interface BlockerManager {
    fun start()
    fun pause()
    fun resume()
    fun stop()
}

const net = require('node:net')
const dgram = require('node:dgram')

const DEFAULT_TCP_PORT = 8898
const DEFAULT_UDP_PORT = 5678

function parseArgs(argv) {
    const positional = []
    const options = {
        durationMs: null,
        host: '0.0.0.0',
    }

    for (let index = 0; index < argv.length; index += 1) {
        const current = argv[index]

        if (current === '--duration-ms') {
            options.durationMs = Number(argv[index + 1])
            index += 1
            continue
        }

        if (current === '--host') {
            options.host = argv[index + 1] || options.host
            index += 1
            continue
        }

        if (current === '--help' || current === '-h') {
            options.help = true
            continue
        }

        positional.push(current)
    }

    return { positional, options }
}

function printHelp() {
    console.log(`Usage:
  node mock-port-blocker.js tcp [port] [--duration-ms 10000] [--host 0.0.0.0]
  node mock-port-blocker.js udp [port] [--duration-ms 10000] [--host 0.0.0.0]
  node mock-port-blocker.js both [tcpPort] [udpPort] [--duration-ms 10000] [--host 0.0.0.0]

Examples:
  node mock-port-blocker.js tcp
  node mock-port-blocker.js udp
  node mock-port-blocker.js both
  node mock-port-blocker.js tcp 38998 --duration-ms 5000`)
}

function assertValidPort(port, label) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid ${label} port: ${port}`)
    }
}

function startTcpBlocker(port, host) {
    return new Promise((resolve, reject) => {
        const server = net.createServer()

        server.on('error', reject)
        server.listen(port, host, () => {
            console.log(`[mock-port-blocker] TCP listener active on ${host}:${port} (pid ${process.pid})`)
            resolve({
                label: `TCP ${port}`,
                close: () =>
                    new Promise((closeResolve) => {
                        server.close(() => closeResolve())
                    }),
            })
        })
    })
}

function startUdpBlocker(port, host) {
    return new Promise((resolve, reject) => {
        const socket = dgram.createSocket('udp4')

        socket.on('error', reject)
        socket.bind(port, host, () => {
            console.log(`[mock-port-blocker] UDP listener active on ${host}:${port} (pid ${process.pid})`)
            resolve({
                label: `UDP ${port}`,
                close: () =>
                    new Promise((closeResolve) => {
                        socket.close(() => closeResolve())
                    }),
            })
        })
    })
}

async function main() {
    const { positional, options } = parseArgs(process.argv.slice(2))

    if (options.help || positional.length === 0) {
        printHelp()
        process.exit(options.help ? 0 : 1)
    }

    const mode = positional[0].toLowerCase()
    const tcpPort = positional[1] ? Number(positional[1]) : DEFAULT_TCP_PORT
    const udpPort =
        mode === 'both'
            ? positional[2]
                ? Number(positional[2])
                : DEFAULT_UDP_PORT
            : positional[1]
              ? Number(positional[1])
              : DEFAULT_UDP_PORT

    const blockers = []

    if (mode === 'tcp' || mode === 'both') {
        assertValidPort(tcpPort, 'TCP')
        blockers.push(await startTcpBlocker(tcpPort, options.host))
    }

    if (mode === 'udp' || mode === 'both') {
        assertValidPort(udpPort, 'UDP')
        blockers.push(await startUdpBlocker(udpPort, options.host))
    }

    if (blockers.length === 0) {
        throw new Error(`Unknown mode "${mode}". Use tcp, udp, or both.`)
    }

    console.log(
        `[mock-port-blocker] Blocking ${blockers.map((blocker) => blocker.label).join(', ')}. Press Ctrl+C to stop.`,
    )

    const shutdown = async () => {
        await Promise.allSettled(blockers.map((blocker) => blocker.close()))
        process.exit(0)
    }

    process.on('SIGINT', () => {
        void shutdown()
    })

    process.on('SIGTERM', () => {
        void shutdown()
    })

    if (options.durationMs !== null) {
        console.log(`[mock-port-blocker] Auto-exit in ${options.durationMs}ms.`)
        setTimeout(() => {
            void shutdown()
        }, options.durationMs)
    }
}

main().catch((error) => {
    console.error(`[mock-port-blocker] ${error.message}`)
    process.exit(1)
})

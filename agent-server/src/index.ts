import { createServer } from 'node:http'
import express from 'express'
import cors from 'cors'
import { WebSocketServer, WebSocket, type RawData } from 'ws'
import type { IncomingMessage } from 'node:http'
import { VALID_ACTIONS, type CommandResult, type CommandStatus, type SemanticSnapshot } from './types'
import {
    updateSnapshot,
    getSnapshot,
    getStatus,
    addCommand,
    updateCommandResult,
    setResultCallback,
} from './store'
import { getViewerHTML } from './viewer'

const PORT = Number.parseInt(process.env.PORT ?? '3100', 10)

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/', (_req, res) => res.type('html').send(getViewerHTML()))

app.get('/snapshot', (_req, res) => {
    const snapshot = getSnapshot()
    if (!snapshot) {
        return res.json({ error: 'No snapshot available', nodes: [], scenes: [], resolution: [0, 0], timestamp: 0 })
    }
    return res.json(snapshot)
})

app.get('/health', (_req, res) => res.json({ status: 'ok', ...getStatus() }))

app.post('/update', (req, res) => {
    if (!req.body?.timestamp) return res.status(400).json({ error: 'Invalid snapshot payload' })
    updateSnapshot(req.body as SemanticSnapshot)
    return res.json({ ok: true })
})

app.post('/interact', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    if (!body.action || !VALID_ACTIONS.includes(body.action as never)) {
        return res.status(400).json({
            error: `Invalid or missing action. Must be one of: ${VALID_ACTIONS.join(', ')}`,
        })
    }
    const command = addCommand(body)
    sendToGame({ type: 'command', data: command })
    return res.json({ commandId: command.id, status: 'queued' })
})

const httpServer = createServer(app)
const wss = new WebSocketServer({ server: httpServer })

let gameSocket: WebSocket | null = null
const testSockets = new Set<WebSocket>()

function sendToGame(msg: object): void {
    if (gameSocket?.readyState === WebSocket.OPEN) {
        gameSocket.send(JSON.stringify(msg))
    }
}

function broadcastToTests(msg: object): void {
    const payload = JSON.stringify(msg)
    for (const ws of testSockets) {
        if (ws.readyState === WebSocket.OPEN) ws.send(payload)
    }
}

setResultCallback((id, status, result) => {
    broadcastToTests({ type: 'command_result', id, status, result })
})

type GameWsMessage =
    | { type: 'snapshot'; data: SemanticSnapshot }
    | { type: 'result'; id: string; status: CommandStatus; result?: CommandResult }
    | { type: string }

function handleGameMessage(raw: string): void {
    let msg: GameWsMessage
    try {
        msg = JSON.parse(raw) as GameWsMessage
    } catch {
        return
    }

    if (msg.type === 'snapshot' && 'data' in msg && msg.data?.timestamp) {
        updateSnapshot(msg.data)
    } else if (msg.type === 'result' && 'id' in msg) {
        updateCommandResult(msg.id, msg.status, msg.result)
    }
}

wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const path = req.url ?? ''

    if (path === '/game') {
        gameSocket = ws
        console.log('  [WS] Game connected')
        ws.on('message', (data: RawData) => handleGameMessage(data.toString()))
        ws.on('close', () => {
            gameSocket = null
            console.log('  [WS] Game disconnected')
        })
        return
    }

    if (path === '/test') {
        testSockets.add(ws)
        console.log(`  [WS] Test client connected (total: ${testSockets.size})`)
        ws.on('close', () => {
            testSockets.delete(ws)
            console.log(`  [WS] Test client disconnected (total: ${testSockets.size})`)
        })
        return
    }

    ws.close(1008, 'Unknown path — use /game or /test')
})

httpServer.listen(PORT, () => {
    console.log('')
    console.log('  AI Agent Server')
    console.log('  ────────────────────────────────────────')
    console.log(`  Viewer:    http://localhost:${PORT}/`)
    console.log(`  Health:    http://localhost:${PORT}/health`)
    console.log(`  Game WS:   ws://localhost:${PORT}/game`)
    console.log(`  Test WS:   ws://localhost:${PORT}/test`)
    console.log('  ────────────────────────────────────────')
    console.log('')
    console.log('  Waiting for game WebSocket connection...')
    console.log('')
})

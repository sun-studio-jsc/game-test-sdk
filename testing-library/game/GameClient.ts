import WebSocket from 'ws'
import {
    COMMAND_STATUS,
    CommandStatus,
    type CommandResult,
    type GameClientConfig,
    type SemanticSnapshot,
} from './types'

const DEFAULT_CONFIG: GameClientConfig = {
    serverUrl: 'http://localhost:3100',
    commandTimeout: 10000,
    pollInterval: 100,
}

type PressCommand = { action: 'press'; target: string; options?: { duration?: number } }
type PressAtCommand = {
    action: 'pressAt'
    position: [number, number]
    options?: { duration?: number }
}
type DragCommand = {
    action: 'drag'
    target: string
    options: { dragTo: string } | { toPosition: [number, number] }
}
type TypeCommand = { action: 'type'; options: { text: string } }
type ExecuteCommand = { action: 'execute'; message: string; payload?: unknown }

export type Command = PressCommand | PressAtCommand | DragCommand | TypeCommand | ExecuteCommand

type PendingResult = {
    resolve: (r: CommandResult) => void
    reject: (e: Error) => void
    timer: ReturnType<typeof setTimeout>
}

export class GameClient {
    private readonly config: GameClientConfig
    private ws: WebSocket | null = null
    private readonly pending = new Map<string, PendingResult>()

    constructor(config?: Partial<GameClientConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config }
    }

    async connect(): Promise<void> {
        await this.waitForGame()
        this.openWebSocket()
    }

    async disconnect(): Promise<void> {
        this.ws?.close()
        this.ws = null
        this.pending.clear()
    }

    async getSnapshot(): Promise<SemanticSnapshot> {
        const response = await this.fetchOrThrow(`${this.config.serverUrl}/snapshot`)
        const data = await response.json()
        if (data.error) throw new Error(`Snapshot error: ${data.error}`)
        return data as SemanticSnapshot
    }

    async sendCommand(cmd: Command): Promise<CommandResult> {
        const response = await this.fetchOrThrow(`${this.config.serverUrl}/interact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cmd),
        })

        const responseData = await response.json()
        const { commandId } = responseData as { commandId: string }

        return new Promise<CommandResult>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(commandId)
                reject(new Error(`Command ${JSON.stringify(cmd)} timed out after ${this.config.commandTimeout}ms`))
            }, this.config.commandTimeout)

            this.pending.set(commandId, { resolve, reject, timer })
        })
    }

    private async waitForGame(): Promise<void> {
        const MAX_RETRIES = 3
        const RETRY_DELAY = 1000

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            const response = await this.fetchOrThrow(`${this.config.serverUrl}/health`)
            const data = (await response.json()) as { status: string; hasData: boolean }

            if (data.hasData) return

            if (attempt < MAX_RETRIES) await this.sleep(RETRY_DELAY)
        }

        throw new Error(`Game has no snapshot data after ${MAX_RETRIES} retries`)
    }

    private openWebSocket(): void {
        const wsUrl = this.config.serverUrl.replace(/^http/, 'ws') + '/test'
        this.ws = new WebSocket(wsUrl)

        this.ws.on('message', (data: Buffer | string) => this.handleMessage(data.toString()))
        this.ws.on('error', (err: Error) => console.error('[GameClient] WS error:', err.message))
    }

    private handleMessage(raw: string): void {
        const msg = JSON.parse(raw) as { type: string; id: string; status: CommandStatus; result?: { error?: string } }

        if (msg.type !== 'command_result') return

        const entry = this.pending.get(msg.id)
        if (!entry) return

        clearTimeout(entry.timer)
        this.pending.delete(msg.id)

        const result: CommandResult = { commandId: msg.id, status: msg.status, result: msg.result }

        if (msg.status === COMMAND_STATUS.COMPLETED) {
            entry.resolve(result)
        } else {
            entry.reject(new Error(msg.result?.error ?? 'Command failed'))
        }
    }

    private async fetchOrThrow(url: string, init?: RequestInit): Promise<Response> {
        let response: Response
        try {
            response = await fetch(url, init)
        } catch {
            throw new Error(`Server unreachable at ${this.config.serverUrl}`)
        }
        if (!response.ok) throw new Error(`Server returned ${response.status}`)
        return response
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}

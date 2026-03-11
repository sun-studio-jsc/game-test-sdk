import { CommandProcessor } from './CommandProcessor'
import { CanvasInputAdapter } from '../adapters/CanvasInputAdapter'
import type { INodeExtractor } from '../interfaces/INodeExtractor'
import type { ISceneProvider } from '../interfaces/ISceneProvider'
import type { IInputAdapter } from '../interfaces/IInputAdapter'
import type { GameEngineAdapterConfig, SemanticNode, SemanticSnapshot } from './types'

const WS_RECONNECT_DELAY_MS = 3000

export class GameEngineAdapter {
    private config: GameEngineAdapterConfig | null = null
    private snapshot: SemanticSnapshot | null = null
    private commandProcessor: CommandProcessor | null = null

    private ws: WebSocket | null = null
    private isWsReady: boolean = false
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null

    private extractor: INodeExtractor | null = null
    private sceneProvider: ISceneProvider | null = null
    private inputAdapter: IInputAdapter | null = null

    /**
     * Configure the agent with engine-specific adapters.
     * Must be called before the agent can extract snapshots or process commands.
     */
    configure(config: GameEngineAdapterConfig): void {
        if (!config.sceneProvider) {
            throw new Error('GameEngineAdapter requires a sceneProvider')
        }
        if (!config.extractor) {
            throw new Error('GameEngineAdapter requires an extractor')
        }

        this.config = config
        this.sceneProvider = config.sceneProvider
        this.extractor = config.extractor

        if (config.inputAdapter) {
            this.inputAdapter = config.inputAdapter
        } else if (config.canvas) {
            this.inputAdapter = new CanvasInputAdapter(config.canvas)
        }

        if (this.inputAdapter) {
            this.commandProcessor = new CommandProcessor(
                this.inputAdapter,
                () => this.snapshot?.nodes ?? [],
                (msg) => this.wsSend(msg),
                config.handler
            )
        }

        this.connectWebSocket()
    }

    getSnapshot(): SemanticSnapshot | null {
        return this.snapshot
    }

    forceSnapshot(): SemanticSnapshot {
        this.extractSnapshot()
        return this.snapshot!
    }

    /**
     * Call this from your engine's render loop / frame tick.
     * Extracts a snapshot and optionally pushes it to the testing server.
     */
    onFrame(): void {
        if (!this.config?.enabled) return
        this.extractSnapshot()
        if (this.config.autoPush) {
            this.pushSnapshot()
        }
    }

    destroy(): void {
        this.disconnectWebSocket()
        this.commandProcessor = null
        this.snapshot = null
        this.config = null
        this.extractor = null
        this.sceneProvider = null
        this.inputAdapter = null
    }

    private extractSnapshot(): void {
        if (!this.sceneProvider || !this.extractor) return

        const activeScenes = this.sceneProvider.getActiveScenes()
        const allNodes: SemanticNode[] = []
        const sceneKeys: string[] = []

        for (const sceneInfo of activeScenes) {
            sceneKeys.push(sceneInfo.key)

            this.extractor.beginScene(sceneInfo.scene, sceneInfo.key)

            for (const child of sceneInfo.children) {
                this.traverseObject(child, sceneInfo.key, allNodes)
            }
        }

        const resolution = this.sceneProvider.getResolution()
        this.snapshot = {
            timestamp: Date.now(),
            scenes: sceneKeys,
            resolution,
            nodes: allNodes,
        }
    }

    private traverseObject(obj: unknown, sceneKey: string, collector: SemanticNode[]): void {
        if (!this.extractor?.shouldInclude(obj)) return

        const data = this.extractor?.extract(obj, sceneKey)
        const node: SemanticNode = { ...data, scene: sceneKey }

        const childNodes: SemanticNode[] = []
        for (const child of this.extractor.getChildren(obj)) {
            this.traverseObject(child, sceneKey, childNodes)
        }
        if (childNodes.length > 0) node.children = childNodes

        collector.push(node)
    }

    private pushSnapshot(): void {
        if (!this.snapshot) return
        this.wsSend({ type: 'snapshot', data: this.snapshot })
    }

    private connectWebSocket(): void {
        if (!this.config) return
        if (typeof WebSocket === 'undefined') return // Node.js test environment

        const wsUrl = this.config.serverUrl.replace(/^http/, 'ws') + '/game'
        try {
            this.ws = new WebSocket(wsUrl)
        } catch {
            this.scheduleReconnect()
            return
        }

        this.ws.onopen = () => {
            this.isWsReady = true
        }

        this.ws.onmessage = (event: MessageEvent) => {
            this.handleServerMessage(event.data as string)
        }

        this.ws.onclose = () => {
            this.isWsReady = false
            this.scheduleReconnect()
        }

        this.ws.onerror = () => {
            this.isWsReady = false
        }
    }

    private handleServerMessage(raw: string): void {
        const msg = this.tryParseJson(raw)
        if (msg?.type !== 'command' || !msg.data) return
        this.commandProcessor?.handleCommand(msg.data as Command)
    }

    private tryParseJson(raw: string): { type: string; data?: unknown } | null {
        try {
            return JSON.parse(raw) as { type: string; data?: unknown }
        } catch {
            return null
        }
    }

    private wsSend(msg: object): void {
        if (!this.ws || !this.isWsReady) return
        this.ws.send(JSON.stringify(msg))
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer !== null) return
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.connectWebSocket()
        }, WS_RECONNECT_DELAY_MS)
    }

    private disconnectWebSocket(): void {
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = null
        }
        this.ws?.close()
        this.ws = null
        this.isWsReady = false
    }
}

// Private import used only within this file
type Command = import('./CommandProcessor').Command

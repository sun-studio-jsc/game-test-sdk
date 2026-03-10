import type { INodeExtractor } from '../interfaces/INodeExtractor'
import type { ISceneProvider } from '../interfaces/ISceneProvider'
import type { IInputAdapter } from '../interfaces/IInputAdapter'

export interface ExtractedNodeData {
    id: string
    role: string
    type: string
    className: string
    bounds: [number, number, number, number]
    label?: string
    interactable?: boolean
    state?: Record<string, unknown>
    texture?: string
    origin?: [number, number]
    visible?: boolean
    active?: boolean
    alpha?: number
    depth?: number
    scale?: [number, number]
    angle?: number

    /**
     * Custom game-specific data attached to game objects.
     * Convention: engine adapters read a `_props` data key from objects.
     * @example { health: 100, gemType: 'ruby' }
     */
    props?: Record<string, unknown>
}

export interface SemanticNode extends ExtractedNodeData {
    /** The scene key this node belongs to, set during tree traversal. */
    scene: string
    children?: SemanticNode[]
}

export interface SemanticSnapshot {
    timestamp: number
    scenes: string[]
    resolution: [number, number]
    nodes: SemanticNode[]
}

export type CustomHandler = (message: string, payload?: unknown) => void | Promise<void>

export interface GameAgentConfig {
    /** Whether the agent is active. Default: true */
    enabled: boolean
    /** Testing server WebSocket URL. Default: 'http://localhost:3100' */
    serverUrl: string
    /** Push snapshot every frame. Default: true */
    autoPush: boolean
    /** Engine-specific scene provider (REQUIRED) */
    sceneProvider: ISceneProvider
    /** Engine-specific node extractor (REQUIRED) */
    extractor: INodeExtractor
    /**
     * Input adapter for simulating user interactions.
     * Default: CanvasInputAdapter if a canvas is provided.
     */
    inputAdapter?: IInputAdapter
    /**
     * The canvas element used for input simulation.
     * Required if inputAdapter is not provided.
     * The built-in CanvasInputAdapter will be created from this.
     */
    canvas?: HTMLCanvasElement
    /**
     * Register custom command handlers that tests can invoke via `execute(name, payload)`.
     * @example
     * handler: (message, payload) => {
     *   if (message === 'setPlayer') gameCore.setPlayerData(payload)
     * }
     */
    handler?: CustomHandler
}

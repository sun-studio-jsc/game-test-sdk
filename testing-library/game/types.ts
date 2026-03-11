export interface SemanticNode {
    id: string
    role: string
    label?: string
    type: string
    className: string
    scene: string
    bounds: [number, number, number, number]
    origin?: [number, number]
    visible?: boolean
    active?: boolean
    alpha?: number
    depth?: number
    scale?: [number, number]
    angle?: number
    texture?: string
    interactable?: boolean
    state?: Record<string, unknown>
    children?: SemanticNode[]
}

export interface SemanticSnapshot {
    timestamp: number
    scenes: string[]
    resolution: [number, number]
    nodes: SemanticNode[]
}

export const COMMAND_STATUS = {
    QUEUED: 'queued',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
} as const
export type CommandStatus = (typeof COMMAND_STATUS)[keyof typeof COMMAND_STATUS]

export interface CommandResult {
    commandId: string
    status: CommandStatus
    result?: {
        snapshot?: SemanticSnapshot
        error?: string
        resolvedBounds?: [number, number, number, number]
    }
}

export interface NodeSelector {
    id?: string
    role?: string
    label?: string
    scene?: string
    className?: string
    interactable?: boolean
    texture?: string
}

export interface GameClientConfig {
    serverUrl: string
    commandTimeout: number
    pollInterval: number
}

export interface WaitOptions {
    timeout?: number
    interval?: number
    state?: 'visible' | 'hidden'
}

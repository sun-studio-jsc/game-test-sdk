export interface SemanticNode {
    id: string
    role?: string
    type?: string
    className?: string
    label?: string
    bounds: [number, number, number, number]
    interactable?: boolean
    alpha?: number
    depth?: number
    scale?: [number, number]
    origin?: [number, number]
    texture?: string
    scene?: string
    state?: Record<string, unknown>
    children?: SemanticNode[]
}

export interface SemanticSnapshot {
    timestamp: number
    scenes: string[]
    resolution: [number, number]
    nodes: SemanticNode[]
}

export const VALID_ACTIONS = ['press', 'pressAt', 'drag', 'execute'] as const
export type ValidAction = (typeof VALID_ACTIONS)[number]

export type CommandStatus = 'queued' | 'processing' | 'completed' | 'failed'

export type CommandResult = {
    snapshot?: SemanticSnapshot
    error?: string
    resolvedBounds?: [number, number, number, number]
}

type BaseCommand = {
    id: string
    status: CommandStatus
    result?: CommandResult
    createdAt: number
}

type PressCommand = BaseCommand & {
    action: 'press'
    target: string
    options?: { duration?: number }
}

type PressAtCommand = BaseCommand & {
    action: 'pressAt'
    position: [number, number]
    options?: { duration?: number }
}

type DragCommand = BaseCommand & {
    action: 'drag'
    target: string
    options: { dragTo: string } | { toPosition: [number, number] }
}

type ExecuteCommand = BaseCommand & {
    action: 'execute'
    message: string
    payload?: unknown
}

export type Command = PressCommand | PressAtCommand | DragCommand | ExecuteCommand

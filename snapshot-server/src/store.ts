import { randomUUID } from 'node:crypto'
import type { Command, CommandResult, CommandStatus, SemanticSnapshot } from './types'

let latestSnapshot: SemanticSnapshot | null = null
let lastReceivedAt: number | null = null

export function updateSnapshot(snapshot: SemanticSnapshot): void {
    latestSnapshot = snapshot
    lastReceivedAt = Date.now()
}

export function getSnapshot(): SemanticSnapshot | null {
    return latestSnapshot
}

export function getStatus(): { hasData: boolean; lastReceivedAt: number | null; nodeCount: number } {
    return {
        hasData: latestSnapshot !== null,
        lastReceivedAt,
        nodeCount: latestSnapshot ? countNodes(latestSnapshot.nodes) : 0,
    }
}

function countNodes(nodes: SemanticSnapshot['nodes']): number {
    let count = 0
    for (const node of nodes) {
        count++
        if (node.children?.length) count += countNodes(node.children)
    }
    return count
}

const commandMap = new Map<string, Command>()

type ResultCallback = (id: string, status: CommandStatus, result?: CommandResult) => void
let onResultUpdate: ResultCallback | null = null

export function setResultCallback(cb: ResultCallback): void {
    onResultUpdate = cb
}

export function addCommand(body: Record<string, unknown>): Command {
    const command = {
        ...body,
        id: randomUUID(),
        status: 'queued',
        createdAt: Date.now(),
    } as Command
    commandMap.set(command.id, command)
    return command
}

export function updateCommandResult(id: string, status: CommandStatus, result?: CommandResult): void {
    const cmd = commandMap.get(id)
    if (!cmd) return
    cmd.status = status
    if (result !== undefined) cmd.result = result
    onResultUpdate?.(id, status, result)
}

export function getCommandResult(id: string): Command | null {
    return commandMap.get(id) ?? null
}

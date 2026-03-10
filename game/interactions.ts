import type { GameClient } from './GameClient'
import type { CommandResult } from './types'

export type Target = string | { x: number; y: number }

export async function press(
    client: GameClient,
    target: Target,
    duration?: number
): Promise<CommandResult> {
    const durationOpts = duration !== undefined ? { options: { duration } } : {}
    if (typeof target === 'string') {
        return client.sendCommand({ action: 'press', target, ...durationOpts })
    }
    return client.sendCommand({
        action: 'pressAt',
        position: [target.x, target.y],
        ...durationOpts,
    })
}

export async function drag(
    client: GameClient,
    source: string,
    dest: string | { x: number; y: number }
): Promise<CommandResult> {
    const options =
        typeof dest === 'string'
            ? { dragTo: dest }
            : { toPosition: [dest.x, dest.y] as [number, number] }
    return client.sendCommand({ action: 'drag', target: source, options })
}

export async function execute(
    client: GameClient,
    message: string,
    payload?: unknown
): Promise<CommandResult> {
    return client.sendCommand({ action: 'execute', message, payload })
}

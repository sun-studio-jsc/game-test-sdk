import type { SemanticNode, CustomHandler } from './types'
import type { IInputAdapter } from '../interfaces/IInputAdapter'

type CommandStatus = 'completed' | 'failed'

type CommandResult = {
    error?: string
    resolvedBounds?: [number, number, number, number]
}

type BaseCommand = {
    id: string
    status: 'queued' | 'processing' | 'completed' | 'failed'
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

type SendFn = (msg: object) => void

export class CommandProcessor {
    private static readonly POST_ACTION_DELAY_MS = 100

    private readonly input: IInputAdapter
    private readonly getSnapshot: () => SemanticNode[]
    private readonly send: SendFn
    private readonly handler?: CustomHandler

    private readonly queue: Command[] = []
    private isProcessing: boolean = false

    constructor(
        input: IInputAdapter,
        getSnapshot: () => SemanticNode[],
        send: SendFn,
        handler?: CustomHandler
    ) {
        this.input = input
        this.getSnapshot = getSnapshot
        this.send = send
        this.handler = handler
    }

    handleCommand(cmd: Command): void {
        this.queue.push(cmd)
        this.drain()
    }

    private drain(): void {
        if (this.isProcessing || this.queue.length === 0) return

        this.isProcessing = true
        const cmd = this.queue.shift()!

        this.executeCommand(cmd)
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : String(err)
                this.reportResult(cmd.id, 'failed', { error: message })
            })
            .finally(() => {
                this.isProcessing = false
                this.drain()
            })
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    private reportResult(id: string, status: CommandStatus, result?: CommandResult): void {
        this.send({ type: 'result', id, status, result })
    }

    private async executeCommand(cmd: Command): Promise<void> {
        switch (cmd.action) {
            case 'press':
                return this.executePress(cmd)
            case 'pressAt':
                return this.executePressAt(cmd)
            case 'drag':
                return this.executeDrag(cmd)
            case 'execute':
                return this.executeCustom(cmd)
            default: {
                const action = (cmd as BaseCommand & { action: string }).action
                this.reportResult((cmd as BaseCommand).id, 'failed', {
                    error: `Unknown action: ${action}`,
                })
            }
        }
    }

    private async executePress(cmd: PressCommand): Promise<void> {
        const center = this.resolveTarget(cmd.target)
        if (!center) {
            this.reportResult(cmd.id, 'failed', { error: `Target not found: ${cmd.target}` })
            return
        }
        await this.input.press(center[0], center[1], cmd.options?.duration)
        await this.delay(CommandProcessor.POST_ACTION_DELAY_MS)
        this.reportResult(cmd.id, 'completed')
    }

    private async executePressAt(cmd: PressAtCommand): Promise<void> {
        const [x, y] = cmd.position ?? [0, 0]
        if (typeof x !== 'number' || typeof y !== 'number') {
            this.reportResult(cmd.id, 'failed', {
                error: 'pressAt requires position as [x, y] array',
            })
            return
        }
        await this.input.press(x, y, cmd.options?.duration)
        await this.delay(CommandProcessor.POST_ACTION_DELAY_MS)
        this.reportResult(cmd.id, 'completed')
    }

    private async executeDrag(cmd: DragCommand): Promise<void> {
        const from = this.resolveTarget(cmd.target)
        if (!from) {
            this.reportResult(cmd.id, 'failed', { error: `Drag source not found: ${cmd.target}` })
            return
        }
        const to = this.resolveDestination(cmd)
        if (!to) {
            this.reportResult(cmd.id, 'failed', {
                error: 'Drag destination not found: provide dragTo ID or options.toPosition',
            })
            return
        }
        await this.input.drag(from[0], from[1], to[0], to[1])
        await this.delay(CommandProcessor.POST_ACTION_DELAY_MS)
        this.reportResult(cmd.id, 'completed')
    }

    private async executeCustom(cmd: ExecuteCommand): Promise<void> {
        if (!this.handler) {
            this.reportResult(cmd.id, 'failed', { error: 'No handler registered' })
            return
        }

        try {
            await this.handler(cmd.message, cmd.payload)
            this.reportResult(cmd.id, 'completed')
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err)
            this.reportResult(cmd.id, 'failed', { error: `Handler threw: ${message}` })
        }
    }

    private resolveDestination(cmd: DragCommand): [number, number] | null {
        if ('dragTo' in cmd.options) return this.resolveTarget(cmd.options.dragTo)
        if ('toPosition' in cmd.options)
            return [cmd.options.toPosition[0], cmd.options.toPosition[1]]
        return null
    }

    private resolveTarget(targetId?: string): [number, number] | null {
        if (!targetId) return null
        const node = this.findNodeById(this.getSnapshot(), targetId)
        if (!node) return null
        const [x, y, w, h] = node.bounds
        return [x + w / 2, y + h / 2]
    }

    private findNodeById(nodes: SemanticNode[], id: string): SemanticNode | null {
        for (const node of nodes) {
            if (node.id === id) return node
            if (node.children?.length) {
                const found = this.findNodeById(node.children, id)
                if (found) return found
            }
        }
        return null
    }
}

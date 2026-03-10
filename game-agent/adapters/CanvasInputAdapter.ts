import type { IInputAdapter } from '../interfaces/IInputAdapter'

const DEFAULT_PRESS_DURATION_MS = 100
const DRAG_STEPS = 10
const DRAG_STEP_DELAY_MS = 16

export class CanvasInputAdapter implements IInputAdapter {
    private readonly canvas: HTMLCanvasElement

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas
    }

    async press(x: number, y: number, duration: number = DEFAULT_PRESS_DURATION_MS): Promise<void> {
        const { clientX, clientY } = this.toClient(x, y)

        this.dispatch('mousemove', clientX, clientY, true)
        this.dispatch('mousedown', clientX, clientY, true)
        await this.delay(duration)
        this.dispatch('mouseup', clientX, clientY, false)
    }

    async drag(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
        const from = this.toClient(fromX, fromY)
        const to = this.toClient(toX, toY)

        this.dispatch('mousedown', from.clientX, from.clientY, true)

        for (let i = 1; i <= DRAG_STEPS; i++) {
            const t = i / DRAG_STEPS
            const cx = from.clientX + (to.clientX - from.clientX) * t
            const cy = from.clientY + (to.clientY - from.clientY) * t
            this.dispatch('mousemove', cx, cy, true)
            await this.delay(DRAG_STEP_DELAY_MS)
        }

        this.dispatch('mouseup', to.clientX, to.clientY, false)
    }

    private toClient(x: number, y: number): { clientX: number; clientY: number } {
        const rect = this.canvas.getBoundingClientRect()
        const scaleX = rect.width / this.canvas.width
        const scaleY = rect.height / this.canvas.height

        return {
            clientX: rect.left + x * scaleX,
            clientY: rect.top + y * scaleY,
        }
    }

    private dispatch(type: string, clientX: number, clientY: number, isDown: boolean): void {
        const event = new MouseEvent(type, {
            clientX,
            clientY,
            screenX: clientX,
            screenY: clientY,
            bubbles: true,
            cancelable: true,
            button: 0,
            buttons: isDown ? 1 : 0,
        })

        const pageX = clientX + (globalThis.scrollX || 0)
        const pageY = clientY + (globalThis.scrollY || 0)

        Object.defineProperty(event, 'pageX', { value: pageX, writable: false })
        Object.defineProperty(event, 'pageY', { value: pageY, writable: false })

        this.canvas.dispatchEvent(event)
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}

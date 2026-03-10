/**
 * Adapter interface for simulating user input.
 *
 * The built-in CanvasInputAdapter works for any canvas-based engine
 * (Phaser, PixiJS, Cocos2d-JS, BabylonJS).
 *
 * Implement this for non-canvas engines or when you need custom input handling.
 */
export interface IInputAdapter {
    /**
     * Simulate a press (tap/click) at game coordinates.
     * @param x Game-space X coordinate
     * @param y Game-space Y coordinate
     * @param duration Hold duration in ms (default ~100ms)
     */
    press(x: number, y: number, duration?: number): Promise<void>

    /**
     * Simulate a drag from one game coordinate to another.
     * @param fromX Source X
     * @param fromY Source Y
     * @param toX Destination X
     * @param toY Destination Y
     */
    drag(fromX: number, fromY: number, toX: number, toY: number): Promise<void>
}

import type { ExtractedNodeData } from '../core/types'

/**
 * Adapter interface that abstracts all engine-specific object introspection.
 *
 * Implement this interface to add support for any game engine:
 *   - Phaser 3 → PhaserNodeExtractor (included in game-agent-sdk)
 *   - PixiJS → PixiNodeExtractor (custom)
 *   - Cocos Creator → CocosNodeExtractor (custom)
 *   - BabylonJS → BabylonNodeExtractor (custom)
 */
export interface INodeExtractor {
    /**
     * Called once before traversing a scene's objects.
     * Cache any per-scene context your extractor needs
     * (e.g. the active camera, canvas size, etc.).
     */
    beginScene(scene: unknown, sceneKey: string): void

    /**
     * Return false to skip this object and all its descendants.
     * Typically used to cull invisible or zero-alpha objects.
     */
    shouldInclude(obj: unknown): boolean

    /**
     * Extract all semantic data from a single game object.
     * Does NOT include children — the agent handles tree construction
     * by calling getChildren() separately.
     */
    extract(obj: unknown, sceneKey: string): ExtractedNodeData

    /**
     * Return the direct children of this object that should be traversed.
     * Return an empty array for leaf nodes.
     */
    getChildren(obj: unknown): unknown[]
}

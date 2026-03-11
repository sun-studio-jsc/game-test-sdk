/**
 * Describes one active scene to be traversed.
 */
export interface SceneInfo {
    /** Unique scene identifier (e.g. "GAME_SCENE", "HUD_SCENE") */
    key: string
    /** The engine-specific scene object, passed to INodeExtractor.beginScene() */
    scene: unknown
    /** Top-level children of this scene's display list */
    children: unknown[]
}

/**
 * Adapter interface that abstracts engine-specific scene graph access.
 *
 * Implement this for each engine:
 *   - Phaser 3 → PhaserSceneProvider (uses game.scene.getScenes())
 *   - PixiJS → PixiSceneProvider (uses app.stage.children)
 *   - Cocos → CocosSceneProvider (uses director.getScene())
 */
export interface ISceneProvider {
    /**
     * Return all currently active/visible scenes.
     * Called once per frame during snapshot extraction.
     */
    getActiveScenes(): SceneInfo[]

    /**
     * Return the current render resolution [width, height].
     * Used to populate SemanticSnapshot.resolution.
     */
    getResolution(): [number, number]
}

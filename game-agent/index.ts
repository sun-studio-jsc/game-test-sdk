// Core
export { GameAgent } from './core/GameAgent'
export { CommandProcessor } from './core/CommandProcessor'
export type { Command } from './core/CommandProcessor'

// Types
export type {
    ExtractedNodeData,
    SemanticNode,
    SemanticSnapshot,
    CustomHandler,
    GameAgentConfig,
} from './core/types'

// Interfaces
export type { INodeExtractor } from './interfaces/INodeExtractor'
export type { ISceneProvider, SceneInfo } from './interfaces/ISceneProvider'
export type { IInputAdapter } from './interfaces/IInputAdapter'

// Adapters
export { CanvasInputAdapter } from './adapters/CanvasInputAdapter'

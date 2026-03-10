import type { SemanticNode, NodeSelector } from './types'
import type { GameClient } from './GameClient'

function matchesSelector(node: SemanticNode, selector: NodeSelector): boolean {
    if (selector.id !== undefined && node.id !== selector.id) return false
    if (selector.role !== undefined && node.role !== selector.role) return false
    if (selector.scene !== undefined && node.scene !== selector.scene) return false
    if (selector.className !== undefined && node.className !== selector.className) return false
    if (selector.interactable !== undefined && node.interactable !== selector.interactable)
        return false

    if (selector.label !== undefined) {
        if (node.label === undefined) return false
        if (node.label.toLowerCase() !== selector.label.toLowerCase()) return false
    }

    if (selector.texture !== undefined) {
        if (node.texture === undefined) return false
        if (node.texture.toLowerCase() !== selector.texture.toLowerCase()) return false
    }

    return true
}

function collectMatches(nodes: SemanticNode[], selector: NodeSelector): SemanticNode[] {
    const results: SemanticNode[] = []
    for (const node of nodes) {
        if (matchesSelector(node, selector)) results.push(node)
        if (node.children) results.push(...collectMatches(node.children, selector))
    }
    return results
}

export async function find(
    client: GameClient,
    selector: NodeSelector
): Promise<SemanticNode | null> {
    const snapshot = await client.getSnapshot()
    const matches = collectMatches(snapshot.nodes, selector)
    return matches.length === 0 ? null : matches[0]
}

export async function findAll(client: GameClient, selector: NodeSelector): Promise<SemanticNode[]> {
    const snapshot = await client.getSnapshot()
    return collectMatches(snapshot.nodes, selector)
}

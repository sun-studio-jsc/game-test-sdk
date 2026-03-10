import type { GameClient } from './GameClient'
import type { NodeSelector, SemanticNode } from './types'

function matchesProperty<K extends keyof NodeSelector>(
    node: SemanticNode,
    selector: NodeSelector,
    key: K
): boolean {
    if (selector[key] === undefined) return true
    return node[key] === selector[key]
}

function matchesStringProperty(
    nodeValue: string | undefined,
    selectorValue: string | undefined
): boolean {
    if (selectorValue === undefined) return true
    if (nodeValue === undefined) return false
    return nodeValue.toLowerCase().includes(selectorValue.toLowerCase())
}

function matchesSelector(node: SemanticNode, selector: NodeSelector): boolean {
    if (!matchesProperty(node, selector, 'id')) return false
    if (!matchesProperty(node, selector, 'role')) return false
    if (!matchesProperty(node, selector, 'scene')) return false
    if (!matchesProperty(node, selector, 'className')) return false
    if (!matchesProperty(node, selector, 'interactable')) return false
    if (!matchesStringProperty(node.label, selector.label)) return false
    if (!matchesStringProperty(node.texture, selector.texture)) return false
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

function findOne(nodes: SemanticNode[], selector: NodeSelector): SemanticNode {
    const matches = collectMatches(nodes, selector)
    if (matches.length === 0) {
        throw new Error(`No node found matching ${JSON.stringify(selector)}`)
    }
    return matches[0]
}

export async function assert(
    client: GameClient,
    selector: NodeSelector,
    options: { state: 'visible' | 'hidden' }
): Promise<void> {
    const snapshot = await client.getSnapshot()
    const matches = collectMatches(snapshot.nodes, selector)
    const selectorStr = JSON.stringify(selector)

    if (options.state === 'visible' && matches.length === 0) {
        throw new Error(`Expected node matching ${selectorStr} to be visible, but it was not found`)
    }
    if (options.state === 'hidden' && matches.length > 0) {
        throw new Error(
            `Expected node matching ${selectorStr} to be gone, but found ${matches.length} match(es)`
        )
    }
}

export async function assertScene(client: GameClient, sceneKey: string): Promise<void> {
    const snapshot = await client.getSnapshot()
    if (!snapshot.scenes.includes(sceneKey)) {
        throw new Error(
            `Expected scene '${sceneKey}' to be active, but active scenes are: [${snapshot.scenes.join(', ')}]`
        )
    }
}

export async function assertLayout(
    client: GameClient,
    selectorA: NodeSelector,
    constraints: { above?: NodeSelector; noOverlapWith?: NodeSelector[] }
): Promise<void> {
    const snapshot = await client.getSnapshot()
    const nodeA = findOne(snapshot.nodes, selectorA)

    if (constraints.above) {
        const nodeB = findOne(snapshot.nodes, constraints.above)
        const [, ay] = nodeA.bounds
        const [, by] = nodeB.bounds
        if (ay >= by) {
            throw new Error(`Expected '${nodeA.id}' (y=${ay}) to be above '${nodeB.id}' (y=${by})`)
        }
    }

    if (constraints.noOverlapWith) {
        for (const sel of constraints.noOverlapWith) {
            const nodeB = findOne(snapshot.nodes, sel)
            const [ax, ay, aw, ah] = nodeA.bounds
            const [bx, by, bw, bh] = nodeB.bounds
            const overlaps = ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
            if (overlaps) {
                throw new Error(
                    `Elements '${nodeA.id}' and '${nodeB.id}' overlap: bounds [${ax},${ay},${aw},${ah}] and [${bx},${by},${bw},${bh}]`
                )
            }
        }
    }
}

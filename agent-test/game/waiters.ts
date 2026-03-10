import type { GameClient } from './GameClient'
import type { NodeSelector, SemanticNode, WaitOptions } from './types'

const DEFAULT_TIMEOUT = 5000
const DEFAULT_INTERVAL = 200

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

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

export async function waitFor(
    client: GameClient,
    selector: NodeSelector,
    options?: WaitOptions
): Promise<SemanticNode | null> {
    const isHidden = options?.state === 'hidden'
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT
    const interval = options?.interval ?? DEFAULT_INTERVAL
    const deadline = Date.now() + timeout

    while (Date.now() < deadline) {
        const snapshot = await client.getSnapshot()
        const matches = collectMatches(snapshot.nodes, selector)

        if (isHidden && matches.length === 0) return null
        if (!isHidden && matches.length > 0) return matches[0]

        await sleep(interval)
    }

    const selectorStr = JSON.stringify(selector)
    throw new Error(
        isHidden
            ? `Timed out waiting for node matching ${selectorStr} to disappear after ${timeout}ms`
            : `Timed out waiting for node matching ${selectorStr} after ${timeout}ms`
    )
}

export async function waitForScene(
    client: GameClient,
    sceneKey: string,
    options?: WaitOptions
): Promise<void> {
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT
    const interval = options?.interval ?? DEFAULT_INTERVAL
    const deadline = Date.now() + timeout

    while (Date.now() < deadline) {
        const snapshot = await client.getSnapshot()
        if (snapshot.scenes.includes(sceneKey)) return
        await sleep(interval)
    }

    throw new Error(`Timed out waiting for scene '${sceneKey}' after ${timeout}ms`)
}

export async function waitForStable(client: GameClient, options?: WaitOptions): Promise<void> {
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT
    const interval = options?.interval ?? DEFAULT_INTERVAL
    const deadline = Date.now() + timeout

    let previousTimestamp: number | null = null

    while (Date.now() < deadline) {
        const snapshot = await client.getSnapshot()

        if (previousTimestamp !== null && snapshot.timestamp === previousTimestamp) return

        previousTimestamp = snapshot.timestamp
        await sleep(interval)
    }

    throw new Error(`Timed out waiting for snapshot to stabilize after ${timeout}ms`)
}

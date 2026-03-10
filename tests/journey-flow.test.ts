import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { game, browser } from '../sdk'
import { press, waitFor, waitForScene, find, execute, sleep } from '../sdk'
import type { SemanticNode } from '../sdk'
import { collectByClass, buildBoardGrid, findDraggableHitboxes, tryPlaceOnePiece, waitForGlobalInputEnabled } from './utils'

const SCENE_GAME = 'GAME_SCENE'
const SCENE_JOURNEY = 'JOURNEY_SCENE'

const BTN_JOURNEY = 'JOURNEY_BUTTON'
const BTN_CITY_BUILDER_CLOSE = 'CITY_BUILDER_CLOSE_BUTTON'
const BTN_BUILD_CITY = 'BUILD_CITY_BUTTON'
const BTN_RESCUE_NO_THANKS = 'RESCUE_NO_THANKS'
const BTN_REPLAY = 'REPLAY_BUTTON'
const BTN_CONTINUE = 'CONTINUE_BUTTON'

const EXECUTE = {
    setPlayerData: 'setPlayerData',
    setFooterPieces: 'setFooterPieces',
    setJourneyCollectionNearWin: 'setJourneyCollectionNearWin',
    setRainbowData: 'setRainbowData',
} as const

const RAINBOW_BLOCK_COUNT = 30
const MAX_PLACEMENT_MOVES = 200
const LOOP_WAIT_MS = 50
const NETWORK_TIMEOUT = 20_000

const SINGLE_3X3 = 's3--n-3:3/c,c,c,c,c,c,c,c,c'
const LOSE_PIECES_FEN = `3~${Array(30).fill(SINGLE_3X3).join(';')}`

const GEM_FENS = ['dc', 'dg', 'dp', 'dd', 'dr', 'dy'] as const

function buildWinPiecesFen(gemFens: string[]): string {
    const pieces = Array.from({ length: 30 }, (_, i) => `s1--n-1:1/${gemFens[i % gemFens.length]}*`)
    return `3~${pieces.join(';')}`
}

async function navigateToJourney(): Promise<void> {
    await waitForScene(game, SCENE_GAME)

    await press(game, 'GP_SETTING')
    await waitFor(game, { id: 'SETTING_HOME' })
    await press(game, 'SETTING_HOME')

    await waitForGlobalInputEnabled(game)
    const welComeBackClaimButton = await find(game, { id: 'WELCOME_BACK_SCREEN' })
    if (welComeBackClaimButton) {
        await waitFor(game, { id: 'welcome-back-claim-button' })
        await press(game, 'welcome-back-claim-button', 40)
    }

    await waitFor(game, { id: 'welcome-back-claim-button' }, { state: 'hidden' })
    await waitFor(game, { id: BTN_JOURNEY })
    await press(game, BTN_JOURNEY, 40)

    await waitForGlobalInputEnabled(game)

    const time = Date.now()
    const TIMEOUT = 10_500
    while (Date.now() - time < TIMEOUT) {
        const buildBtn = await find(game, { id: BTN_BUILD_CITY })
        if (buildBtn?.alpha === 1) {
            await press(game, BTN_BUILD_CITY, 30)
            continue
        }
        break
    }

    await waitFor(game, { id: BTN_CITY_BUILDER_CLOSE })
    await press(game, BTN_JOURNEY, 40)

    await waitForScene(game, SCENE_JOURNEY)
}

// ─── Game-state setup helpers ──────────────────────────────────────────────────

async function setupNearLose(): Promise<void> {
    await execute(game, EXECUTE.setFooterPieces, { fen: LOSE_PIECES_FEN })
}

async function setupNearWin(): Promise<void> {
    await execute(game, EXECUTE.setJourneyCollectionNearWin)

    const gemFens = Object.values(GEM_FENS)
    await execute(game, EXECUTE.setFooterPieces, { fen: buildWinPiecesFen(gemFens) })
}

// ─── Play simulation ───────────────────────────────────────────────────────────

async function simulatePlayUntil(targetId: string): Promise<boolean> {
    let moveCount = 0

    while (moveCount < MAX_PLACEMENT_MOVES) {
        const snapshot = await game.getSnapshot()

        const handledRescueNoThanks = await find(game, { id: targetId })
        if (handledRescueNoThanks?.alpha === 1) {
            return true
        }

        const boardNode = await find(game, { className: 'Board' })
        if (!boardNode) {
            console.warn('[Journey] Board node not found in snapshot')
            await sleep(LOOP_WAIT_MS)
            continue
        }

        const grid = buildBoardGrid(boardNode)
        if (!grid) {
            console.warn('[Journey] Could not build board grid from Cell nodes')
            await sleep(LOOP_WAIT_MS)
            continue
        }

        const pieces = collectByClass(snapshot.nodes, 'Piece').filter(
            (p) => p.bounds[2] > 0 && p.bounds[3] > 0
        )
        const hitboxes = findDraggableHitboxes(snapshot.nodes)

        console.log(`[Journey] Move ${moveCount} | pieces=${pieces.length} hitboxes=${hitboxes.length}`)

        await tryPlaceOnePiece(game, grid, pieces, hitboxes)
        moveCount++
        await sleep(LOOP_WAIT_MS)
    }

    const finalBtn = await find(game, { id: targetId })
    return finalBtn?.alpha === 1
}

// ─── Shared lifecycle ──────────────────────────────────────────────────────────

async function connectAndReset(): Promise<void> {
    await browser.connect()
    await game.connect()
    await execute(game, EXECUTE.setPlayerData, { isUserNew: false })
    await browser.reload()
}

async function disconnectAll(): Promise<void> {
    await game.disconnect()
    await browser.disconnect()
}


// ─── Lose flow (with rainbow) ─────────────────────────────────────────────────

describe('Adventure Level - Lose Flow (with Rainbow)', () => {
    beforeAll(connectAndReset, NETWORK_TIMEOUT)
    afterAll(disconnectAll)

    it(
        'pre-filled rainbow + 3×3 blocks → game-over fires naturally → rescue No Thanks → Replay',
        async () => {
            await execute(game, EXECUTE.setRainbowData, { rainbowBlockCount: RAINBOW_BLOCK_COUNT })

            await navigateToJourney()

            await setupNearLose()

            const rescueAppeared = await simulatePlayUntil(BTN_RESCUE_NO_THANKS)
            expect(rescueAppeared).toBe(true)

            await waitForGlobalInputEnabled(game)

            await press(game, BTN_RESCUE_NO_THANKS, 40)

            await waitFor(game, { id: BTN_REPLAY }, { timeout: 15_000 })
            await press(game, BTN_REPLAY)

            await waitForScene(game, SCENE_JOURNEY, { timeout: 20_000 })
            expect((await game.getSnapshot()).scenes).toContain(SCENE_JOURNEY)
        },
        90_000
    )
})

// ─── Win flow (with rainbow) ──────────────────────────────────────────────────

describe('Adventure Level - Win Flow (with Rainbow)', () => {
    beforeAll(connectAndReset, NETWORK_TIMEOUT)
    afterAll(disconnectAll)

    it(
        'pre-filled rainbow + gem pieces → win → city builder skips Hold to fill → Next Level directly',
        async () => {
            await execute(game, EXECUTE.setRainbowData, { rainbowBlockCount: RAINBOW_BLOCK_COUNT })

            await navigateToJourney()

            await setupNearWin()

            const winAppeared = await simulatePlayUntil(BTN_CONTINUE)
            expect(winAppeared).toBe(true)

            await waitForGlobalInputEnabled(game)
            await press(game, BTN_CONTINUE)

            await waitFor(game, { id: BTN_BUILD_CITY }, { timeout: 15_000 })

            const time = Date.now()
            const TIMEOUT = 10_500
            while (Date.now() - time < TIMEOUT) {
                const buildBtn = await find(game, { id: BTN_BUILD_CITY })
                if (buildBtn?.alpha === 1) {
                    await press(game, BTN_BUILD_CITY, 30)
                    continue
                }
                break
            }

            await waitFor(game, { id: BTN_JOURNEY }, { timeout: 15_000 })
            await press(game, BTN_JOURNEY)

            await waitForScene(game, SCENE_JOURNEY, { timeout: 20_000 })
            expect((await game.getSnapshot()).scenes).toContain(SCENE_JOURNEY)
        },
        120_000
    )
})


// ─── Lose flow ────────────────────────────────────────────────────────────────

describe('Adventure Level - Lose Flow', () => {
    beforeAll(connectAndReset, NETWORK_TIMEOUT)
    afterAll(disconnectAll)

    it(
        'fills board with 3×3 blocks → game-over fires naturally → rescue No Thanks → Replay',
        async () => {
            await navigateToJourney()

            await setupNearLose()

            const rescueAppeared = await simulatePlayUntil(BTN_RESCUE_NO_THANKS)
            expect(rescueAppeared).toBe(true)

            await waitForGlobalInputEnabled(game)

            await press(game, BTN_RESCUE_NO_THANKS, 40)

            await waitFor(game, { id: BTN_REPLAY }, { timeout: 15_000 })
            await press(game, BTN_REPLAY)

            await waitForScene(game, SCENE_JOURNEY, { timeout: 20_000 })
            expect((await game.getSnapshot()).scenes).toContain(SCENE_JOURNEY)
        },
        90_000
    )
})

// ─── Win flow ─────────────────────────────────────────────────────────────────

describe('Adventure Level - Win Flow', () => {
    beforeAll(connectAndReset, NETWORK_TIMEOUT)
    afterAll(disconnectAll)

    it(
        'places 1×1 gem pieces → rows clear → gems collected → win fires naturally → Next → next level',
        async () => {
            await navigateToJourney()

            await setupNearWin()

            const winAppeared = await simulatePlayUntil(BTN_CONTINUE)
            expect(winAppeared).toBe(true)

            await waitForGlobalInputEnabled(game)
            await press(game, BTN_CONTINUE)

            await waitFor(game, { id: BTN_BUILD_CITY }, { timeout: 15_000 })

            const time = Date.now()
            const TIMEOUT = 10_500
            while (Date.now() - time < TIMEOUT) {
                const buildBtn = await find(game, { id: BTN_BUILD_CITY })
                if (buildBtn?.alpha === 1) {
                    await press(game, BTN_BUILD_CITY, 30)
                    continue
                }
                break
            }

            await waitFor(game, { id: BTN_JOURNEY }, { timeout: 15_000 })
            await press(game, BTN_JOURNEY)

            await waitForScene(game, SCENE_JOURNEY, { timeout: 20_000 })
            expect((await game.getSnapshot()).scenes).toContain(SCENE_JOURNEY)
        },
        120_000
    )
})

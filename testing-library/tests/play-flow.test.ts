import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { game, browser } from '../sdk'
import { press, drag, waitFor, waitForScene, find, sleep, execute } from '../sdk'
import type { SemanticNode } from '../sdk'
import {
    collectByClass,
    buildBoardGrid,
    extractBoardOccupancy,
    getPieceShape,
    findValidPlacement,
    findDraggableHitboxes,
    closestHitboxToPiece,
    pieceDropTarget,
    tryPlaceOnePiece,
} from './utils'
import type { BoardGrid } from './utils'
import fs from 'fs'
import path from 'path'
const logFile = path.join(__dirname, 'play-flow-stats.json')

const TARGET_SCORE = 10000
const MAX_MOVES = 500
const GAME_SCORE_ID = 'MAIN_SCORE_BLOCK'
const LOOP_WAIT_MS = 50

async function readCurrentScore(): Promise<number> {
    const scoreBlock = await find(game, { id: GAME_SCORE_ID })
    if (!scoreBlock) return 0
    const textNode = scoreBlock.children?.find(
        (c) => c.role === 'text' && /^\d+$/.test(c.label ?? '')
    )
    return textNode?.label ? Number.parseInt(textNode.label, 10) : 0
}

const AD_CLOSE_TIMEOUT_MS = 30_000

async function handleAdContent(): Promise<boolean> {
    const isAdVisible = await browser.isElementVisible('#ad-content')
    if (!isAdVisible) return false

    console.log('[Play Flow] Ad interstitial detected — waiting for close button...')
    await browser.waitForElement('#close-btn', { state: 'visible', timeout: AD_CLOSE_TIMEOUT_MS })
    await browser.pressElement('#close-btn')
    await browser.waitForElement('#ad-content', { state: 'hidden', timeout: 5000 })
    console.log('[Play Flow] Ad dismissed')
    return true
}

async function handleKnownPopups(nodes: SemanticNode[]): Promise<boolean> {
    const rescueSure = await find(game, { id: 'RESCUE_NO_THANKS' })
    if (!rescueSure || rescueSure?.alpha !== 1) return false

    await press(game, 'RESCUE_NO_THANKS', 50)
    await waitFor(game, { id: 'RESCUE_NO_THANKS' }, { state: 'hidden', timeout: 15000 })
    return true
}

async function handleNewGame(nodes: SemanticNode[]): Promise<boolean> {
    const skipAnimationZone = await find(game, { className: 'SkipAnimationZoneFullscreen' })
    if (!skipAnimationZone || skipAnimationZone?.active) return false

    const continueButton = await find(game, { id: 'CONTINUE_BUTTON' })
    if (continueButton?.alpha !== 1) return false

    await press(game, 'CONTINUE_BUTTON', 50)
    await sleep(500)
    return true
}


export const EXECUTE_FUNCTIONS = {
    setPlayerData: 'setPlayerData',
    setBoard: 'setBoard',
} as const

describe('Play Flow - Reach 1000 Score', () => {
    beforeAll(async () => {
        await browser.connect()
        await game.connect()

        await execute(game, EXECUTE_FUNCTIONS.setPlayerData, {
            isUserNew: false,
        })

        await browser.reload()
    })

    afterAll(async () => {
        await game.disconnect()
        await browser.disconnect()
    })

    it('should play until reaching 10000 score', async () => {
        let score = 0
        let moveCount = 0
        let playTimes = 0

        console.log('[Play Flow] Setting player data and board...')

        while (score < TARGET_SCORE && moveCount < MAX_MOVES) {
            const snapshot = await game.getSnapshot()

            score = await readCurrentScore()
            console.log(`[Play Flow] Score: ${score} | Move: ${moveCount}`)

            if (score >= TARGET_SCORE) break

            const handledAd = await handleAdContent()
            if (handledAd) {
                await sleep(LOOP_WAIT_MS)
                continue
            }

            const handledPopup = await handleKnownPopups(snapshot.nodes)
            if (handledPopup) {
                let logs = []
                if (fs.existsSync(logFile)) {
                    logs = JSON.parse(fs.readFileSync(logFile, 'utf-8'))
                }

                let avgScore = (logs.reduce((acc: number, log: any) => acc + log.score, 0) + score) / (logs.length + 1)
                playTimes++
                const logData = {
                    score: score,
                    avgScore: avgScore,
                    playTimes: logs.length + 1,
                    moveCount: moveCount,
                    timestamp: new Date().toISOString()
                }
                console.log(`[Logger] Avg Score: ${logData.avgScore} | Play Times: ${logData.playTimes}`)


                logs.push(logData)
                fs.writeFileSync(logFile, JSON.stringify(logs, null, 2))

                score = 0
                moveCount = 0
                await sleep(LOOP_WAIT_MS)
                continue
            }

            const handledNewGame = await handleNewGame(snapshot.nodes)
            if (handledNewGame) {
                score = 0
                moveCount = 0
                await sleep(LOOP_WAIT_MS)
                continue
            }

            const boardNode = await find(game, { className: 'Board' })
            if (!boardNode) {
                console.warn('[Play Flow] Board node not found in snapshot')
                await sleep(LOOP_WAIT_MS)
                continue
            }

            const grid = buildBoardGrid(boardNode)
            if (!grid) {
                console.warn('[Play Flow] Could not build board grid from Cell nodes')
                await sleep(LOOP_WAIT_MS)
                continue
            }

            const pieces = collectByClass(snapshot.nodes, 'Piece').filter(
                (p) => p.bounds[2] > 0 && p.bounds[3] > 0
            )
            const hitboxes = findDraggableHitboxes(snapshot.nodes)

            console.log(`[Play Flow] ${pieces.length} piece(s), ${hitboxes.length} hitbox(es)`)

            await tryPlaceOnePiece(game, grid, pieces, hitboxes)
            moveCount++
            await sleep(LOOP_WAIT_MS)
        }

        expect(score).toBeGreaterThanOrEqual(TARGET_SCORE)
    }, 6000000)
})

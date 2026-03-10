import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { game } from '../sdk'
import { press, drag, waitFor, find, sleep, findAll } from '../sdk'
import type { SemanticNode } from '../sdk'

const TARGET_SCORE = 1000
const MAX_MOVES = 500
const EMPTY_CELL_TEXTURE = 'gems/gem_transparent'
const GAME_SCORE_ID = 'MAIN_SCORE_BLOCK'
const PLACEMENT_WAIT_MS = 500
const LOOP_WAIT_MS = 100

const PIECE_SHAPE_MAP: Record<string, boolean[][]> = {
    l: [
        [true, false],
        [true, false],
        [true, true],
    ],
    l_1: [[true]],
    l_3: [
        [true, true, true],
        [true, false, false],
        [true, false, false],
    ],
    line_2: [[true], [true]],
    line_3: [[true], [true], [true]],
    line_4: [[true], [true], [true], [true]],
    line_5: [[true], [true], [true], [true], [true]],
    square_1: [[true]],
    square_2: [
        [true, true],
        [true, true],
    ],
    square_3: [
        [true, true, true],
        [true, true, true],
        [true, true, true],
    ],
    triangle: [
        [true, false],
        [true, true],
    ],
    trapezoid: [
        [false, true, true],
        [true, true, false],
    ],
}

function collectByClass(nodes: SemanticNode[], className: string): SemanticNode[] {
    const results: SemanticNode[] = []
    for (const node of nodes) {
        if (node.className === className) results.push(node)
        if (node.children) results.push(...collectByClass(node.children, className))
    }
    return results
}
interface BoardGrid {
    cells: SemanticNode[]
    colXs: number[]
    rowYs: number[]
    cellW: number
    cellH: number
}

function buildBoardGrid(boardNode: SemanticNode): BoardGrid | null {
    const cells = collectByClass(boardNode.children ?? [], 'Cell')
    if (cells.length === 0) return null

    const colXs = [...new Set(cells.map((c) => c.bounds[0]))].sort((a, b) => a - b)
    const rowYs = [...new Set(cells.map((c) => c.bounds[1]))].sort((a, b) => a - b)
    if (colXs.length < 2 || rowYs.length < 2) return null

    return { cells, colXs, rowYs, cellW: colXs[1] - colXs[0], cellH: rowYs[1] - rowYs[0] }
}

function isBoardCellOccupied(cell: SemanticNode): boolean {
    return (cell.children ?? []).some(
        (child) =>
            child.role === 'image' &&
            child.texture !== undefined &&
            !child.texture.includes(EMPTY_CELL_TEXTURE)
    )
}

function extractBoardOccupancy(grid: BoardGrid): boolean[][] {
    const matrix: boolean[][] = Array.from(
        { length: grid.rowYs.length },
        () => new Array(grid.colXs.length).fill(false) as boolean[]
    )
    for (const cell of grid.cells) {
        const col = grid.colXs.indexOf(cell.bounds[0])
        const row = grid.rowYs.indexOf(cell.bounds[1])
        if (row >= 0 && col >= 0) matrix[row][col] = isBoardCellOccupied(cell)
    }
    return matrix
}

function pieceDropTarget(
    grid: BoardGrid,
    startRow: number,
    startCol: number,
    shape: boolean[][]
): [number, number] {
    const shapeRows = shape.length
    const shapeCols = shape[0]?.length ?? 1
    const x = grid.colXs[startCol] + (shapeCols * grid.cellW) / 2
    const y = grid.rowYs[startRow] + shapeRows * grid.cellH
    return [x, y]
}

function extractPieceShape(piece: SemanticNode): boolean[][] | null {
    const cells = collectByClass(piece.children ?? [], 'Cell')
    if (cells.length === 0) return null

    const xs = cells.map((c) => c.bounds[0])
    const ys = cells.map((c) => c.bounds[1])
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)

    const sortedXs = [...new Set(xs)].sort((a, b) => a - b)
    const sortedYs = [...new Set(ys)].sort((a, b) => a - b)

    const fallbackSpacing = sortedYs.length > 1 ? sortedYs[1] - sortedYs[0] : 1
    const spacingX = sortedXs.length > 1 ? sortedXs[1] - sortedXs[0] : fallbackSpacing
    const spacingY = sortedYs.length > 1 ? sortedYs[1] - sortedYs[0] : spacingX

    const maxCol = Math.round((Math.max(...xs) - minX) / spacingX)
    const maxRow = Math.round((Math.max(...ys) - minY) / spacingY)

    const matrix: boolean[][] = Array.from(
        { length: maxRow + 1 },
        () => new Array(maxCol + 1).fill(false) as boolean[]
    )
    for (const cell of cells) {
        const col = Math.round((cell.bounds[0] - minX) / spacingX)
        const row = Math.round((cell.bounds[1] - minY) / spacingY)
        matrix[row][col] = true
    }
    return matrix
}

function getPieceShape(piece: SemanticNode): boolean[][] {
    const dynamic = extractPieceShape(piece)
    if (dynamic) return dynamic

    const role = piece.role ?? piece.type
    if (role && PIECE_SHAPE_MAP[role]) return PIECE_SHAPE_MAP[role]

    return [[true]]
}

function fitsAt(
    boardOcc: boolean[][],
    shape: boolean[][],
    startRow: number,
    startCol: number
): boolean {
    const totalRows = boardOcc.length
    const totalCols = boardOcc[0]?.length ?? 0
    for (let pr = 0; pr < shape.length; pr++) {
        for (let pc = 0; pc < (shape[pr]?.length ?? 0); pc++) {
            if (!shape[pr][pc]) continue
            const r = startRow + pr
            const c = startCol + pc
            if (r >= totalRows || c >= totalCols) return false
            if (boardOcc[r][c]) return false
        }
    }
    return true
}

function findValidPlacement(
    boardOcc: boolean[][],
    shape: boolean[][]
): { row: number; col: number } | null {
    const totalRows = boardOcc.length
    const totalCols = boardOcc[0]?.length ?? 0
    const pieceRows = shape.length
    const pieceCols = shape[0]?.length ?? 0
    for (let row = 0; row <= totalRows - pieceRows; row++) {
        for (let col = 0; col <= totalCols - pieceCols; col++) {
            if (fitsAt(boardOcc, shape, row, col)) return { row, col }
        }
    }
    return null
}

function findDraggableHitboxes(nodes: SemanticNode[]): SemanticNode[] {
    return nodes.filter((n) => n.state?.draggable === true && n.interactable === true)
}

function closestHitboxToPiece(piece: SemanticNode, hitboxes: SemanticNode[]): SemanticNode | null {
    if (hitboxes.length === 0) return null
    const [px, py, pw, ph] = piece.bounds
    const pcx = px + pw / 2
    const pcy = py + ph / 2

    return hitboxes.reduce<SemanticNode | null>((closest, h) => {
        const [hx, hy, hw, hh] = h.bounds
        const dist = Math.hypot(hx + hw / 2 - pcx, hy + hh / 2 - pcy)
        if (!closest) return h
        const [cx, cy, cw, ch] = closest.bounds
        const closestDist = Math.hypot(cx + cw / 2 - pcx, cy + ch / 2 - pcy)
        return dist < closestDist ? h : closest
    }, null)
}

function readCurrentScore(nodes: SemanticNode[]): number {
    const scoreBlock = nodes.find((n) => n.id === GAME_SCORE_ID)
    if (!scoreBlock) return 0
    const textNode = scoreBlock.children?.find(
        (c) => c.role === 'text' && /^\d+$/.test(c.label ?? '')
    )
    return textNode?.label ? Number.parseInt(textNode.label, 10) : 0
}

async function handleKnownPopups(nodes: SemanticNode[]): Promise<boolean> {
    if (await find(game, { id: 'GAME_OVER_PLAY' })) {
        await press(game, 'GAME_OVER_PLAY')
        await waitFor(game, { id: GAME_SCORE_ID }, { timeout: 15000 })
        return true
    }
    if (await find(game, { id: 'RESCUE_NO_THANKS' })) {
        await press(game, 'RESCUE_NO_THANKS')
        await waitFor(game, { id: 'RESCUE_NO_THANKS' }, { state: 'hidden', timeout: 15000 })
        return true
    }
    return false
}

async function handleNewGame(nodes: SemanticNode[]): Promise<boolean> {
    const skipAnimationZone = await find(game, { className: 'SkipAnimationZoneFullscreen' })
    if (!skipAnimationZone || skipAnimationZone?.active) return false

    const continueButton = await find(game, { id: 'CONTINUE_BUTTON' })
    if (continueButton?.alpha !== 1) return false

    await waitFor(game, { id: 'CONTINUE_BUTTON' })
    await press(game, 'CONTINUE_BUTTON', 50)
    return true
}

async function tryPlaceOnePiece(
    grid: BoardGrid,
    pieces: SemanticNode[],
    hitboxes: SemanticNode[]
): Promise<boolean> {
    const boardOcc = extractBoardOccupancy(grid)

    for (const piece of pieces) {
        const role = piece.role ?? piece.type
        const shape = getPieceShape(piece)
        const placement = findValidPlacement(boardOcc, shape)

        console.log(
            `[Play Flow] Piece role="${role}" shape=${JSON.stringify(shape)} → placement`,
            placement
        )
        if (!placement) {
            console.warn(`[Play Flow] No valid placement for piece role="${role}"`)
            continue
        }

        const hitbox = closestHitboxToPiece(piece, hitboxes)
        if (!hitbox) {
            console.warn(`[Play Flow] No hitbox found for piece ${piece.id}`)
            continue
        }

        const [toX, toY] = pieceDropTarget(grid, placement.row, placement.col, shape)
        await drag(game, hitbox.id, { x: toX, y: toY })
        console.log(
            `[Play Flow] Placed "${role}" via hitbox=${hitbox.id}` +
                ` → board[${placement.row},${placement.col}] cursor=(${toX},${toY})`
        )
        await sleep(PLACEMENT_WAIT_MS)
        return true
    }
    return false
}

describe('Play Flow - Reach 1000 Score', () => {
    beforeAll(async () => {
        await game.connect()
    })

    afterAll(async () => {
        await game.disconnect()
    })

    it('should show tournament result screen', async () => {
        // open settings screen
        await press(game, 'GP_SETTING')

        await waitFor(game, { id: 'SETTING_CLOSE' })

        // open devtools
        if (
            (await find(game, { id: 'music_icon' }))?.texture ===
            'default-resources/setting-screen/icn_music_on'
        ) {
            await press(game, 'SETTING_MUSIC', 40)
            await sleep(50)
        }
        if (
            (await find(game, { id: 'sound_icon' }))?.texture ===
            'default-resources/setting-screen/icn_sound_on'
        ) {
            await press(game, 'SETTING_SOUND', 40)
            await sleep(50)
        }

        const sequence = '121213214231'

        for (const digit of sequence) {
            if (digit === '1' || digit === '2') {
                await press(game, 'SETTING_MUSIC', 40)
                await sleep(50)
            } else if (digit === '3' || digit === '4') {
                await press(game, 'SETTING_SOUND', 40)
                await sleep(50)
            }
        }

        const devtoolsOverlay = await find(game, { id: 'DEVTOOLS_OVERLAY_SCENE' })
        expect(devtoolsOverlay).toBeDefined()

        // back to home
        await press(game, 'SETTING_HOME')

        await waitFor(game, { id: 'CLASSIC_BUTTON' })
        await sleep(500)

        // open tournaments screen
        await press(game, 'DB_TOURNAMENTS')
        await waitFor(game, { id: 'TOURNAMENT_LEADERBOARD_SCREEN' })
        await sleep(500)

        // enter tournament
        await press(game, 'TOURNAMENT_JOIN_BUTTON')
        await waitFor(game, { id: 'GP_SETTING' })
        await sleep(500)

        // play all pieces in footer
        const boardNode = (await find(game, { className: 'Board' }))!
        expect(boardNode).toBeDefined()

        const grid = buildBoardGrid(boardNode)!
        expect(grid).toBeDefined()

        console.log(`[Play Flow] grid`, grid)

        for (let i = 0; i < 3; i++) {
            const nodes = await findAll(game, { className: 'Piece' })
            const pieces = collectByClass(nodes, 'Piece').filter(
                (p) => p.bounds[2] > 0 && p.bounds[3] > 0
            )
            const hitboxes = findDraggableHitboxes(nodes)
            console.log(`[Play Flow] ${pieces.length} piece(s), ${hitboxes.length} hitbox(es)`)
            await tryPlaceOnePiece(grid, pieces, hitboxes)
            await sleep(500)
        }

        const tournamelPanel = await find(game, { label: 'Tournament' })
        expect(tournamelPanel).toBeDefined()

        await press(game, tournamelPanel!.id, 50)
        await sleep(500)

        const instantLose = await find(game, { label: 'Instant Lose' })
        expect(instantLose).toBeDefined()

        await press(game, instantLose!.id, 50)
        await sleep(500)

        await waitFor(game, { id: 'RESCUE_NO_THANKS' })
        await sleep(100)
        await press(game, 'RESCUE_NO_THANKS', 50)
        await press(game, 'RESCUE_NO_THANKS', 50)

        const tournamentResultScreen = await find(game, { id: 'TOURNAMENT_RESULT_SCREEN' })
        expect(tournamentResultScreen).toBeDefined()

        // // continue to next tournament
        // await press(game, 'TOURNAMENT_RESULT_CONTINUE')
        // await waitFor(game, { id: 'TOURNAMENT_LEADERBOARD_SCREEN' })
        // await sleep(500)

        // // enter tournament
        // await press(game, 'TOURNAMENT_JOIN_BUTTON')
    }, 600000)
})

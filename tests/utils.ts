import type { GameClient } from '../sdk'
import type { SemanticNode } from '../sdk'
import { drag } from '../sdk'

const EMPTY_CELL_TEXTURE = 'gems/gem_transparent'
const PLACEMENT_WAIT_MS = 200

export interface BoardGrid {
    cells: SemanticNode[]
    colXs: number[]
    rowYs: number[]
    cellW: number
    cellH: number
}

export function collectByClass(nodes: SemanticNode[], className: string): SemanticNode[] {
    const results: SemanticNode[] = []
    for (const node of nodes) {
        if (node.className === className) results.push(node)
        if (node.children) results.push(...collectByClass(node.children, className))
    }
    return results
}

export function buildBoardGrid(boardNode: SemanticNode): BoardGrid | null {
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

export function extractBoardOccupancy(grid: BoardGrid): boolean[][] {
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

export const PIECE_SHAPE_MAP: Record<string, boolean[][]> = {
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

export function extractPieceShape(piece: SemanticNode): boolean[][] | null {
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

export function getPieceShape(piece: SemanticNode): boolean[][] {
    const dynamic = extractPieceShape(piece)
    if (dynamic) return dynamic

    const role = piece.role ?? piece.type
    if (role && PIECE_SHAPE_MAP[role]) return PIECE_SHAPE_MAP[role]

    return [[true]]
}

export function fitsAt(
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

export function findValidPlacement(
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

export function pieceDropTarget(
    grid: BoardGrid,
    startRow: number,
    startCol: number,
    shape: boolean[][]
): [number, number] {
    const shapeCols = shape[0]?.length ?? 1
    const shapeRows = shape.length
    const x = grid.colXs[startCol] + (shapeCols * grid.cellW) / 2
    const y = grid.rowYs[startRow] + shapeRows * grid.cellH
    return [x, y]
}

export function findDraggableHitboxes(nodes: SemanticNode[]): SemanticNode[] {
    return nodes.filter((n) => n.state?.draggable === true && n.interactable === true)
}

export function closestHitboxToPiece(
    piece: SemanticNode,
    hitboxes: SemanticNode[]
): SemanticNode | null {
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

export async function tryPlaceOnePiece(
    client: GameClient,
    grid: BoardGrid,
    pieces: SemanticNode[],
    hitboxes: SemanticNode[]
): Promise<boolean> {
    const boardOcc = extractBoardOccupancy(grid)

    for (const piece of pieces) {
        const role = piece.role ?? piece.type
        const shape = getPieceShape(piece)
        const placement = findValidPlacement(boardOcc, shape)

        console.log(`[Placement] Piece role="${role}" → placement`, placement)
        if (!placement) {
            console.warn(`[Placement] No valid placement for piece role="${role}"`)
            continue
        }

        const hitbox = closestHitboxToPiece(piece, hitboxes)
        if (!hitbox) {
            console.warn(`[Placement] No hitbox found for piece ${piece.id}`)
            continue
        }

        const [toX, toY] = pieceDropTarget(grid, placement.row, placement.col, shape)
        await drag(client, hitbox.id, { x: toX, y: toY })
        console.log(
            `[Placement] Placed "${role}" via hitbox=${hitbox.id}` +
                ` → board[${placement.row},${placement.col}] cursor=(${toX},${toY})`
        )
        await new Promise((r) => setTimeout(r, PLACEMENT_WAIT_MS))
        return true
    }
    return false
}

export async function waitForGlobalInputEnabled(client: GameClient, timeout: number = 10000): Promise<boolean> {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
        const snapshot = await client.getSnapshot()
        const hasZone = snapshot.nodes.some(
            (n) => n.scene === 'GLOBAL_SCENE' && n.role === 'zone'
        )
        if (!hasZone) return true
        await new Promise((r) => setTimeout(r, 100))
    }
    return false
}

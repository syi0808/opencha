import { BITMAP_FONT, GLYPH_HEIGHT, GLYPH_WIDTH, type GlyphRows } from './bitmap-font'
import { SeededRandom } from './random'

const GLYPH_SCALE_X = 6
const GLYPH_SCALE_Y = 4
const EXPANDED_GLYPH_WIDTH = GLYPH_WIDTH * GLYPH_SCALE_X
const EXPANDED_GLYPH_HEIGHT = GLYPH_HEIGHT * GLYPH_SCALE_Y

export const ASCII_ART_CELL_ADVANCE_X = 3
export const ASCII_ART_CELL_ADVANCE_Y = 6
export const ASCII_ART_SYMBOL_WIDTH = 3
export const ASCII_ART_SYMBOL_HEIGHT = 5

export interface AsciiArtFont {
  name: string
  gapColumns: number
  renderGlyph: (glyph: GlyphRows) => string[]
}

export interface AsciiCodeArt {
  fontName: string
  rows: string[]
  columns: number
  rowCount: number
  widthPx: number
  heightPx: number
}

interface ExpandedCellContext {
  bit: boolean
  row: number
  col: number
  subRow: number
  subCol: number
  expandedRow: number
  expandedCol: number
  edge: boolean
  neighborCount: number
  index: number
}

export const ASCII_ART_SYMBOL_PALETTE = [
  '!',
  '?',
  '@',
  '#',
  '$',
  '%',
  '&',
  '*',
  '+',
  '=',
  '-',
  '.',
  ',',
  ':',
  ';',
  '/',
  '\\',
  '|',
  '_',
  '~',
  '^',
  '<',
  '>',
  '[',
  ']',
  '{',
  '}',
  '(',
  ')',
  'x',
  'X'
] as const

const DENSE_SYMBOLS = ['@', '#', '$', '%', '&', 'X'] as const
const HATCH_SYMBOLS = ['/', '\\', '|', 'x', 'X', '=', '+', '-'] as const
const OUTLINE_SYMBOLS = ['#', '+', '%', '&', '[', ']', '{', '}'] as const
const DENSITY_SYMBOLS = [
  '.',
  ',',
  ':',
  ';',
  '-',
  '=',
  '+',
  '*',
  'x',
  'X',
  '%',
  '&',
  '$',
  '#',
  '@'
] as const
const WEAVE_SYMBOLS = ['|', '/', '\\', '-', '=', '+', 'x', 'X', '<', '>', '^', '~'] as const
const SPARK_SYMBOLS = ['.', ',', ':', ';', '!', '?', '*', '+', 'x', 'X', '%', '#', '@'] as const
const SHARD_SYMBOLS = ['<', '>', '^', '~', '/', '\\', '[', ']', '{', '}', '(', ')'] as const
const STATIC_SYMBOLS = ['.', ',', ':', ';', '!', '?', '*', '+', '=', '-', '_'] as const

export const ASCII_ART_FONTS: readonly AsciiArtFont[] = [
  {
    name: 'solid-block',
    gapColumns: 2,
    renderGlyph: renderSolidGlyph
  },
  {
    name: 'scanline-hatch',
    gapColumns: 2,
    renderGlyph: renderHatchGlyph
  },
  {
    name: 'poster-outline',
    gapColumns: 2,
    renderGlyph: renderOutlineGlyph
  },
  {
    name: 'drop-shadow',
    gapColumns: 2,
    renderGlyph: renderShadowGlyph
  },
  {
    name: 'density-ramp',
    gapColumns: 2,
    renderGlyph: renderDensityGlyph
  },
  {
    name: 'wire-weave',
    gapColumns: 2,
    renderGlyph: renderWireGlyph
  },
  {
    name: 'spark-noise',
    gapColumns: 2,
    renderGlyph: renderSparkGlyph
  },
  {
    name: 'angle-shards',
    gapColumns: 2,
    renderGlyph: renderAngleGlyph
  },
  {
    name: 'signal-static',
    gapColumns: 2,
    renderGlyph: renderStaticGlyph
  }
]

export function selectAsciiArtFont(seed: string, codeIndex: number): AsciiArtFont {
  const random = new SeededRandom(`${seed}:ascii-art-font:${codeIndex}`)
  return random.pick(ASCII_ART_FONTS)
}

export function renderAsciiCodeArt(code: string, font: AsciiArtFont): AsciiCodeArt {
  const glyphRows = [...code].map((char) => {
    const glyph = BITMAP_FONT[char]
    return glyph ? font.renderGlyph(glyph) : blankGlyphRows()
  })
  const rowCount = Math.max(0, ...glyphRows.map((rows) => rows.length))
  const rows = Array.from({ length: rowCount }, (_, row) =>
    glyphRows
      .map((rows) => rows[row] ?? ''.padEnd(EXPANDED_GLYPH_WIDTH, ' '))
      .join(' '.repeat(font.gapColumns))
  )
  const columns = Math.max(0, ...rows.map((row) => row.length))
  const normalizedRows = rows.map((row) => row.padEnd(columns, ' '))

  return {
    fontName: font.name,
    rows: normalizedRows,
    columns,
    rowCount,
    widthPx: columns > 0 ? (columns - 1) * ASCII_ART_CELL_ADVANCE_X + ASCII_ART_SYMBOL_WIDTH : 0,
    heightPx:
      rowCount > 0 ? (rowCount - 1) * ASCII_ART_CELL_ADVANCE_Y + ASCII_ART_SYMBOL_HEIGHT : 0
  }
}

export function hasAsciiArtGlyph(char: string): boolean {
  return BITMAP_FONT[char] !== undefined
}

function renderSolidGlyph(glyph: GlyphRows): string[] {
  return renderExpandedGlyph(glyph, (cell) => {
    if (!cell.bit) return ' '
    return denseSymbol(cell.index + cell.subRow + cell.subCol)
  })
}

function renderHatchGlyph(glyph: GlyphRows): string[] {
  return renderExpandedGlyph(glyph, (cell) => {
    if (!cell.bit) return ' '
    return hatchSymbol(cell.row * 13 + cell.col * 7 + cell.subRow * 3 + cell.subCol)
  })
}

function renderOutlineGlyph(glyph: GlyphRows): string[] {
  return renderExpandedGlyph(glyph, (cell) => {
    if (!cell.bit) return ' '

    const localEdge =
      cell.edge ||
      cell.subRow === 0 ||
      cell.subRow === GLYPH_SCALE_Y - 1 ||
      cell.subCol === 0 ||
      cell.subCol === GLYPH_SCALE_X - 1

    if (!localEdge && (cell.row + cell.col) % 3 === 0) {
      return densitySymbol(cell.index)
    }

    return outlineSymbol(cell.index + cell.subRow * 2 + cell.subCol)
  })
}

function renderShadowGlyph(glyph: GlyphRows): string[] {
  return renderExpandedGlyph(glyph, (cell) => {
    if (cell.bit) {
      return denseSymbol(cell.index + cell.neighborCount)
    }

    if (hasExpandedBit(glyph, cell.expandedRow - 2, cell.expandedCol - 2)) {
      return cell.index % 3 === 0 ? '~' : ':'
    }

    return ' '
  })
}

function renderDensityGlyph(glyph: GlyphRows): string[] {
  return renderExpandedGlyph(glyph, (cell) => {
    if (cell.bit) {
      return densitySymbol(cell.neighborCount * 5 + cell.row * 3 + cell.col + cell.subRow + cell.subCol)
    }

    if (cell.neighborCount > 0 && (cell.expandedRow + cell.expandedCol) % 5 === 0) {
      return fringeSymbol(cell.index)
    }

    return ' '
  })
}

function renderWireGlyph(glyph: GlyphRows): string[] {
  return renderExpandedGlyph(glyph, (cell) => {
    if (!cell.bit) return ' '

    if (cell.edge || cell.subRow === 0 || cell.subCol === 1) {
      return cell.subCol === 1 && !cell.edge
        ? wireSymbol(glyph, cell.row, cell.col)
        : weaveSymbol(cell.index)
    }

    return densitySymbol(cell.index + cell.neighborCount)
  })
}

function renderSparkGlyph(glyph: GlyphRows): string[] {
  return renderExpandedGlyph(glyph, (cell) => {
    if (cell.bit) {
      return sparkSymbol(cell.index + cell.neighborCount + cell.subCol)
    }

    if (cell.neighborCount >= 3 && (cell.index + cell.subRow) % 7 === 0) {
      return sparkSymbol(cell.index)
    }

    return ' '
  })
}

function renderAngleGlyph(glyph: GlyphRows): string[] {
  return renderExpandedGlyph(glyph, (cell) => {
    if (cell.bit) {
      if (cell.edge || (cell.subRow + cell.subCol) % 2 === 0) {
        return shardSymbol(cell.index + cell.subRow * 2)
      }

      return densitySymbol(cell.neighborCount + cell.index)
    }

    if (cell.neighborCount > 1 && (cell.expandedRow * 2 + cell.expandedCol) % 11 === 0) {
      return staticSymbol(cell.index)
    }

    return ' '
  })
}

function renderStaticGlyph(glyph: GlyphRows): string[] {
  return renderExpandedGlyph(glyph, (cell) => {
    if (cell.bit) {
      return cell.index % 4 === 0
        ? staticSymbol(cell.index + cell.neighborCount)
        : densitySymbol(cell.index + cell.neighborCount * 2)
    }

    if (cell.neighborCount >= 2 && (cell.expandedRow + cell.expandedCol * 3) % 6 === 0) {
      return staticSymbol(cell.index + cell.neighborCount)
    }

    return ' '
  })
}

function renderExpandedGlyph(
  glyph: GlyphRows,
  renderCell: (cell: ExpandedCellContext) => string
): string[] {
  return Array.from({ length: EXPANDED_GLYPH_HEIGHT }, (_unused, expandedRow) => {
    const row = Math.floor(expandedRow / GLYPH_SCALE_Y)
    const subRow = expandedRow % GLYPH_SCALE_Y

    return Array.from({ length: EXPANDED_GLYPH_WIDTH }, (_unusedCell, expandedCol) => {
      const col = Math.floor(expandedCol / GLYPH_SCALE_X)
      const subCol = expandedCol % GLYPH_SCALE_X
      const bit = glyph[row]?.[col] === '1'
      const cell = renderCell({
        bit,
        row,
        col,
        subRow,
        subCol,
        expandedRow,
        expandedCol,
        edge: bit && isEdgePixel(glyph, row, col),
        neighborCount: countOnNeighbors(glyph, row, col),
        index: expandedRow * EXPANDED_GLYPH_WIDTH + expandedCol
      })

      return cell[0] ?? ' '
    }).join('')
  })
}

function hasExpandedBit(glyph: GlyphRows, expandedRow: number, expandedCol: number): boolean {
  if (
    expandedRow < 0 ||
    expandedRow >= EXPANDED_GLYPH_HEIGHT ||
    expandedCol < 0 ||
    expandedCol >= EXPANDED_GLYPH_WIDTH
  ) {
    return false
  }

  const row = Math.floor(expandedRow / GLYPH_SCALE_Y)
  const col = Math.floor(expandedCol / GLYPH_SCALE_X)
  return glyph[row]?.[col] === '1'
}

function isEdgePixel(glyph: GlyphRows, row: number, col: number): boolean {
  return (
    row === 0 ||
    row === GLYPH_HEIGHT - 1 ||
    col === 0 ||
    col === GLYPH_WIDTH - 1 ||
    glyph[row - 1]?.[col] !== '1' ||
    glyph[row + 1]?.[col] !== '1' ||
    glyph[row]?.[col - 1] !== '1' ||
    glyph[row]?.[col + 1] !== '1'
  )
}

function countOnNeighbors(glyph: GlyphRows, row: number, col: number): number {
  let count = 0

  for (let y = row - 1; y <= row + 1; y++) {
    for (let x = col - 1; x <= col + 1; x++) {
      if (y === row && x === col) continue
      if (glyph[y]?.[x] === '1') count += 1
    }
  }

  return count
}

function pickSymbol(symbols: readonly string[], index: number): string {
  const normalized = ((index % symbols.length) + symbols.length) % symbols.length
  return symbols[normalized] ?? symbols[0] ?? '?'
}

function denseSymbol(index: number): string {
  return pickSymbol(DENSE_SYMBOLS, index)
}

function hatchSymbol(index: number): string {
  return pickSymbol(HATCH_SYMBOLS, index)
}

function outlineSymbol(index: number): string {
  return pickSymbol(OUTLINE_SYMBOLS, index)
}

function densitySymbol(index: number): string {
  return pickSymbol(DENSITY_SYMBOLS, index)
}

function weaveSymbol(index: number): string {
  return pickSymbol(WEAVE_SYMBOLS, index)
}

function fringeSymbol(index: number): string {
  return index % 2 === 0 ? '.' : ':'
}

function sparkSymbol(index: number): string {
  return pickSymbol(SPARK_SYMBOLS, index)
}

function shardSymbol(index: number): string {
  return pickSymbol(SHARD_SYMBOLS, index)
}

function staticSymbol(index: number): string {
  return pickSymbol(STATIC_SYMBOLS, index)
}

function wireSymbol(glyph: GlyphRows, row: number, col: number): string {
  const up = glyph[row - 1]?.[col] === '1'
  const down = glyph[row + 1]?.[col] === '1'
  const left = glyph[row]?.[col - 1] === '1'
  const right = glyph[row]?.[col + 1] === '1'

  if ((up || down) && (left || right)) return '+'
  if (up || down) return '|'
  if (left || right) return '-'
  return weaveSymbol(row + col)
}

function blankGlyphRows(): string[] {
  return Array.from({ length: EXPANDED_GLYPH_HEIGHT }, () =>
    ''.padEnd(EXPANDED_GLYPH_WIDTH, ' ')
  )
}

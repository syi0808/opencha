import { BITMAP_FONT, GLYPH_HEIGHT, GLYPH_WIDTH, type GlyphRows } from './bitmap-font'
import { SeededRandom } from './random'

export const ASCII_ART_CELL_ADVANCE_X = 5
export const ASCII_ART_CELL_ADVANCE_Y = 10
export const ASCII_ART_SYMBOL_WIDTH = 6
export const ASCII_ART_SYMBOL_HEIGHT = 10

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

const DENSE_SYMBOLS = ['@', '#', '$', 'X'] as const
const HATCH_SYMBOLS = ['/', '\\', 'x', '='] as const

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
    gapColumns: 3,
    renderGlyph: renderOutlineGlyph
  },
  {
    name: 'drop-shadow',
    gapColumns: 2,
    renderGlyph: renderShadowGlyph
  }
]

export function selectAsciiArtFont(seed: string, codeIndex: number): AsciiArtFont {
  const random = new SeededRandom(`${seed}:ascii-art-font:${codeIndex}`)
  return random.pick(ASCII_ART_FONTS)
}

export function renderAsciiCodeArt(code: string, font: AsciiArtFont): AsciiCodeArt {
  const glyphRows = [...code].map((char) => {
    const glyph = BITMAP_FONT[char]
    return glyph ? font.renderGlyph(glyph) : blankGlyphRows(GLYPH_HEIGHT)
  })
  const rowCount = Math.max(0, ...glyphRows.map((rows) => rows.length))
  const rows = Array.from({ length: rowCount }, (_, row) =>
    glyphRows
      .map((rows) => rows[row] ?? ''.padEnd(GLYPH_WIDTH * 2, ' '))
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
  return glyph.map((bits, row) =>
    bits
      .split('')
      .map((bit, col) => (bit === '1' ? repeatSymbol(denseSymbol(row + col)) : '  '))
      .join('')
  )
}

function renderHatchGlyph(glyph: GlyphRows): string[] {
  return glyph.map((bits, row) =>
    bits
      .split('')
      .map((bit, col) => (bit === '1' ? repeatSymbol(hatchSymbol(row * 2 + col)) : '  '))
      .join('')
  )
}

function renderOutlineGlyph(glyph: GlyphRows): string[] {
  return glyph.map((bits, row) =>
    bits
      .split('')
      .map((bit, col) => {
        if (bit !== '1') return '  '
        const edge = isEdgePixel(glyph, row, col)
        return edge ? (row + col) % 2 === 0 ? '#+' : '+#' : '  '
      })
      .join('')
  )
}

function renderShadowGlyph(glyph: GlyphRows): string[] {
  return Array.from({ length: GLYPH_HEIGHT + 1 }, (_, row) =>
    Array.from({ length: GLYPH_WIDTH }, (_unused, col) => {
      if (glyph[row]?.[col] === '1') {
        return repeatSymbol(denseSymbol(row + col))
      }

      if (row > 0 && glyph[row - 1]?.[Math.max(0, col - 1)] === '1') {
        return '::'
      }

      return '  '
    }).join('')
  )
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

function repeatSymbol(symbol: string): string {
  return symbol + symbol
}

function denseSymbol(index: number): string {
  return DENSE_SYMBOLS[index % DENSE_SYMBOLS.length] as string
}

function hatchSymbol(index: number): string {
  return HATCH_SYMBOLS[index % HATCH_SYMBOLS.length] as string
}

function blankGlyphRows(rowCount: number): string[] {
  return Array.from({ length: rowCount }, () => ''.padEnd(GLYPH_WIDTH * 2, ' '))
}

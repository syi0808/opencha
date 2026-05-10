import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype, { type Font, type PathCommand } from 'opentype.js'
import { SeededRandom } from './random'

export const ASCII_ART_CELL_ADVANCE_X = 3
export const ASCII_ART_CELL_ADVANCE_Y = 6
export const ASCII_ART_SYMBOL_WIDTH = 3
export const ASCII_ART_SYMBOL_HEIGHT = 5

const FONT_SIZE_PX = 44
const FONT_TRACKING_PX = -1
const RASTER_PADDING_PX = 2
const CURVE_SEGMENTS = 14
const COVERAGE_SAMPLES = [
  [0.17, 0.17],
  [0.5, 0.17],
  [0.83, 0.17],
  [0.17, 0.5],
  [0.5, 0.5],
  [0.83, 0.5],
  [0.17, 0.83],
  [0.5, 0.83],
  [0.83, 0.83]
] as const

export interface AsciiArtFont {
  name: string
  family: string
  filename: string
  fontSize: number
  tracking: number
}

export interface AsciiCodeArt {
  fontName: string
  rows: string[]
  columns: number
  rowCount: number
  widthPx: number
  heightPx: number
}

interface Point {
  x: number
  y: number
}

interface Segment {
  a: Point
  b: Point
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
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

const DENSITY_RAMP = [' ', '.', ':', ';', '+', '=', 'x', 'X', '$', '@'] as const

export const ASCII_ART_FONTS: readonly AsciiArtFont[] = [
  {
    name: 'noto-sans-bold',
    family: 'Noto Sans Bold',
    filename: 'NotoSans-Bold.ttf',
    fontSize: FONT_SIZE_PX,
    tracking: FONT_TRACKING_PX
  },
  {
    name: 'noto-serif-bold',
    family: 'Noto Serif Bold',
    filename: 'NotoSerif-Bold.ttf',
    fontSize: FONT_SIZE_PX,
    tracking: FONT_TRACKING_PX
  },
  {
    name: 'anton-regular',
    family: 'Anton',
    filename: 'Anton-Regular.ttf',
    fontSize: FONT_SIZE_PX,
    tracking: FONT_TRACKING_PX
  },
  {
    name: 'oswald-bold',
    family: 'Oswald Bold',
    filename: 'Oswald-Bold.ttf',
    fontSize: FONT_SIZE_PX,
    tracking: FONT_TRACKING_PX
  }
]

const fontCache = new Map<string, Font>()

export function selectAsciiArtFont(seed: string, codeIndex: number): AsciiArtFont {
  const random = new SeededRandom(`${seed}:ascii-art-font:${codeIndex}`)
  return random.pick(ASCII_ART_FONTS)
}

export function renderAsciiCodeArt(code: string, font: AsciiArtFont): AsciiCodeArt {
  const rows = renderTtfAsciiRows(code, font)
  const columns = Math.max(0, ...rows.map((row) => row.length))
  const normalizedRows = rows.map((row) => row.padEnd(columns, ' '))
  const rowCount = normalizedRows.length

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
  return ASCII_ART_FONTS.some((font) => loadFont(font).charToGlyph(char).advanceWidth > 0)
}

function renderTtfAsciiRows(text: string, fontConfig: AsciiArtFont): string[] {
  if (text.length === 0) return [' ']

  const font = loadFont(fontConfig)
  const contours = textToContours(text, font, fontConfig)
  if (contours.length === 0) return [' ']

  const segments = contoursToSegments(contours)
  if (segments.length === 0) return [' ']

  const bounds = padBounds(boundsForContours(contours), RASTER_PADDING_PX)
  const width = Math.max(1, Math.ceil(bounds.maxX - bounds.minX))
  const height = Math.max(1, Math.ceil(bounds.maxY - bounds.minY))
  const rows: string[] = []

  for (let y = 0; y < height; y++) {
    let row = ''

    for (let x = 0; x < width; x++) {
      const coverage = cellCoverage(bounds.minX + x, bounds.minY + y, segments)
      row += densitySymbol(coverage)
    }

    rows.push(row)
  }

  return cropEmptyColumns(cropEmptyRows(rows))
}

function loadFont(fontConfig: AsciiArtFont): Font {
  const cached = fontCache.get(fontConfig.filename)
  if (cached) return cached

  const bytes = readFileSync(resolveFontPath(fontConfig.filename))
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const font = opentype.parse(buffer)
  fontCache.set(fontConfig.filename, font)
  return font
}

function resolveFontPath(filename: string): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    join(moduleDir, 'fonts', filename),
    join(moduleDir, '..', 'src', 'challenge', 'fonts', filename),
    join(process.env.GITHUB_ACTION_PATH ?? process.cwd(), 'src', 'challenge', 'fonts', filename)
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  return candidates[0] as string
}

function textToContours(text: string, font: Font, fontConfig: AsciiArtFont): Point[][] {
  const scale = fontConfig.fontSize / font.unitsPerEm
  const baseline = Math.ceil(font.ascender * scale) + RASTER_PADDING_PX
  const contours: Point[][] = []
  let cursorX = RASTER_PADDING_PX

  for (const char of text) {
    const glyph = font.charToGlyph(char)
    const path = glyph.getPath(cursorX, baseline, fontConfig.fontSize)
    contours.push(...flattenPath(path.commands))
    cursorX += glyph.advanceWidth * scale + fontConfig.tracking
  }

  return contours.filter((contour) => contour.length > 2)
}

function flattenPath(commands: readonly PathCommand[]): Point[][] {
  const contours: Point[][] = []
  let current: Point[] = []
  let cursor: Point | null = null
  let contourStart: Point | null = null

  for (const command of commands) {
    switch (command.type) {
      case 'M':
        if (current.length > 1) contours.push(current)
        cursor = { x: command.x, y: command.y }
        contourStart = cursor
        current = [cursor]
        break
      case 'L': {
        const next = { x: command.x, y: command.y }
        current.push(next)
        cursor = next
        break
      }
      case 'C': {
        if (!cursor) break
        for (let step = 1; step <= CURVE_SEGMENTS; step++) {
          current.push(cubicPoint(cursor, command, step / CURVE_SEGMENTS))
        }
        cursor = { x: command.x, y: command.y }
        break
      }
      case 'Q': {
        if (!cursor) break
        for (let step = 1; step <= CURVE_SEGMENTS; step++) {
          current.push(quadraticPoint(cursor, command, step / CURVE_SEGMENTS))
        }
        cursor = { x: command.x, y: command.y }
        break
      }
      case 'Z':
        if (contourStart) current.push(contourStart)
        if (current.length > 1) contours.push(current)
        current = []
        cursor = null
        contourStart = null
        break
    }
  }

  if (current.length > 1) contours.push(current)
  return contours
}

function cubicPoint(
  start: Point,
  command: Extract<PathCommand, { type: 'C' }>,
  t: number
): Point {
  const inverse = 1 - t
  const a = inverse * inverse * inverse
  const b = 3 * inverse * inverse * t
  const c = 3 * inverse * t * t
  const d = t * t * t

  return {
    x: a * start.x + b * command.x1 + c * command.x2 + d * command.x,
    y: a * start.y + b * command.y1 + c * command.y2 + d * command.y
  }
}

function quadraticPoint(
  start: Point,
  command: Extract<PathCommand, { type: 'Q' }>,
  t: number
): Point {
  const inverse = 1 - t
  const a = inverse * inverse
  const b = 2 * inverse * t
  const c = t * t

  return {
    x: a * start.x + b * command.x1 + c * command.x,
    y: a * start.y + b * command.y1 + c * command.y
  }
}

function contoursToSegments(contours: readonly Point[][]): Segment[] {
  const segments: Segment[] = []

  for (const contour of contours) {
    for (let index = 0; index + 1 < contour.length; index++) {
      const a = contour[index] as Point
      const b = contour[index + 1] as Point
      if (a.x !== b.x || a.y !== b.y) {
        segments.push({ a, b })
      }
    }
  }

  return segments
}

function boundsForContours(contours: readonly Point[][]): Bounds {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const contour of contours) {
    for (const point of contour) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    }
  }

  return { minX, minY, maxX, maxY }
}

function padBounds(bounds: Bounds, padding: number): Bounds {
  return {
    minX: Math.floor(bounds.minX) - padding,
    minY: Math.floor(bounds.minY) - padding,
    maxX: Math.ceil(bounds.maxX) + padding,
    maxY: Math.ceil(bounds.maxY) + padding
  }
}

function cellCoverage(x: number, y: number, segments: readonly Segment[]): number {
  let hits = 0

  for (const [offsetX, offsetY] of COVERAGE_SAMPLES) {
    if (isPointInside(x + offsetX, y + offsetY, segments)) {
      hits += 1
    }
  }

  return hits / COVERAGE_SAMPLES.length
}

function isPointInside(x: number, y: number, segments: readonly Segment[]): boolean {
  let inside = false

  for (const segment of segments) {
    const { a, b } = segment
    const crosses = (a.y > y) !== (b.y > y)
    if (!crosses) continue

    const intersectionX = ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
    if (intersectionX > x) {
      inside = !inside
    }
  }

  return inside
}

function densitySymbol(coverage: number): string {
  if (coverage <= 0) return ' '
  const index = Math.max(1, Math.ceil(coverage * (DENSITY_RAMP.length - 1)))
  return DENSITY_RAMP[index] ?? '@'
}

function cropEmptyRows(rows: readonly string[]): string[] {
  let top = 0
  while (top < rows.length && rows[top]?.trim() === '') top += 1

  let bottom = rows.length
  while (bottom > top && rows[bottom - 1]?.trim() === '') bottom -= 1

  return top < bottom ? rows.slice(top, bottom) : [' ']
}

function cropEmptyColumns(rows: readonly string[]): string[] {
  let left = Number.POSITIVE_INFINITY
  let right = 0

  for (const row of rows) {
    const first = row.search(/\S/)
    if (first === -1) continue

    left = Math.min(left, first)
    right = Math.max(right, row.search(/\s*$/))
  }

  if (!Number.isFinite(left) || right <= left) return [' ']
  return rows.map((row) => row.slice(left, right))
}

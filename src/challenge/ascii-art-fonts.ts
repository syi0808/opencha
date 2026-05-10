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
const MIXED_FONT_SIZE_VARIANTS = [38, 40, 42, 44, 46] as const
const MIXED_ROTATION_DEGREES = [-7, -5, -3, 0, 3, 5, 7] as const
const MIXED_TRACKING_PX = 4
const RASTER_PADDING_PX = 2
const CURVE_SEGMENTS = 14
const COVERAGE_THRESHOLD = 0.22
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

export interface RenderAsciiCodeArtOptions {
  seed?: string
  codeIndex?: number
}

export interface AsciiCharacterStyle {
  char: string
  fontName: string
  fontSize: number
  rotationDegrees: number
  advancePx: number
}

export interface AsciiCodeArt {
  fontName: string
  characterStyles: AsciiCharacterStyle[]
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

interface CharacterRenderStyle {
  char: string
  fontConfig: AsciiArtFont
  font: Font
  fontSize: number
  rotationDegrees: number
  tracking: number
}

interface RenderedTextContours {
  contours: Point[][]
  characterStyles: AsciiCharacterStyle[]
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

const DENSITY_RAMP = [' ', '.', ':', ';', '+', 'x', 'X'] as const

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

export function renderAsciiCodeArt(
  code: string,
  font: AsciiArtFont,
  options: RenderAsciiCodeArtOptions = {}
): AsciiCodeArt {
  const { rows, characterStyles } = renderTtfAsciiRows(code, font, options)
  const columns = Math.max(0, ...rows.map((row) => row.length))
  const normalizedRows = rows.map((row) => row.padEnd(columns, ' '))
  const rowCount = normalizedRows.length
  const fontNames = new Set(characterStyles.map((style) => style.fontName))

  return {
    fontName: fontNames.size === 1 ? (characterStyles[0]?.fontName ?? font.name) : 'mixed-character-ttf',
    characterStyles,
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

function renderTtfAsciiRows(
  text: string,
  fontConfig: AsciiArtFont,
  options: RenderAsciiCodeArtOptions
): { rows: string[]; characterStyles: AsciiCharacterStyle[] } {
  if (text.length === 0) {
    return {
      rows: [' '],
      characterStyles: []
    }
  }

  const { contours, characterStyles } = textToContours(text, fontConfig, options)
  if (contours.length === 0) {
    return {
      rows: [' '],
      characterStyles
    }
  }

  const segments = contoursToSegments(contours)
  if (segments.length === 0) {
    return {
      rows: [' '],
      characterStyles
    }
  }

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

  return {
    rows: cropEmptyColumns(cropEmptyRows(rows)),
    characterStyles
  }
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

function textToContours(
  text: string,
  fallbackFontConfig: AsciiArtFont,
  options: RenderAsciiCodeArtOptions
): RenderedTextContours {
  const renderStyles = selectCharacterRenderStyles(text, fallbackFontConfig, options)
  const maxAscender = Math.max(
    0,
    ...renderStyles.map((style) => style.font.ascender * (style.fontSize / style.font.unitsPerEm))
  )
  const baseline = Math.ceil(maxAscender) + RASTER_PADDING_PX
  const contours: Point[][] = []
  const characterStyles: AsciiCharacterStyle[] = []
  let cursorX = RASTER_PADDING_PX

  for (const style of renderStyles) {
    const glyph = style.font.charToGlyph(style.char)
    const scale = style.fontSize / style.font.unitsPerEm
    const path = glyph.getPath(cursorX, baseline, style.fontSize)
    const glyphContours = rotateContours(
      flattenPath(path.commands).filter((contour) => contour.length > 2),
      style.rotationDegrees
    )
    const advancePx = glyph.advanceWidth * scale + style.tracking

    contours.push(...glyphContours)
    characterStyles.push({
      char: style.char,
      fontName: style.fontConfig.name,
      fontSize: style.fontSize,
      rotationDegrees: style.rotationDegrees,
      advancePx: roundToTenth(advancePx)
    })
    cursorX += advancePx
  }

  return {
    contours: contours.filter((contour) => contour.length > 2),
    characterStyles
  }
}

function selectCharacterRenderStyles(
  text: string,
  fallbackFontConfig: AsciiArtFont,
  options: RenderAsciiCodeArtOptions
): CharacterRenderStyle[] {
  const shouldMixCharacters = options.seed !== undefined || options.codeIndex !== undefined

  if (!shouldMixCharacters) {
    return [...text].map((char) => ({
      char,
      fontConfig: fallbackFontConfig,
      font: loadFont(fallbackFontConfig),
      fontSize: fallbackFontConfig.fontSize,
      rotationDegrees: 0,
      tracking: fallbackFontConfig.tracking
    }))
  }

  const seed = options.seed ?? `${fallbackFontConfig.name}:${text}`
  const codeIndex = options.codeIndex ?? 0
  const fallbackFontIndex = Math.max(
    0,
    ASCII_ART_FONTS.findIndex((font) => font.name === fallbackFontConfig.name)
  )

  const styles = [...text].map((char, charIndex) => {
    const random = new SeededRandom(`${seed}:ascii-art-character:${codeIndex}:${text}:${charIndex}`)
    const fontConfig =
      ASCII_ART_FONTS[
        (fallbackFontIndex + charIndex + random.nextInt(ASCII_ART_FONTS.length)) %
          ASCII_ART_FONTS.length
      ] ?? fallbackFontConfig
    const fontSize =
      MIXED_FONT_SIZE_VARIANTS[
        (charIndex + random.nextInt(MIXED_FONT_SIZE_VARIANTS.length)) %
          MIXED_FONT_SIZE_VARIANTS.length
      ] ?? FONT_SIZE_PX
    const rotationDegrees =
      MIXED_ROTATION_DEGREES[
        (charIndex + random.nextInt(MIXED_ROTATION_DEGREES.length)) %
          MIXED_ROTATION_DEGREES.length
      ] ?? 0

    return {
      char,
      fontConfig,
      font: loadFont(fontConfig),
      fontSize,
      rotationDegrees,
      tracking: MIXED_TRACKING_PX
    }
  })

  return enforceMixedCharacterStyles(styles)
}

function enforceMixedCharacterStyles(styles: CharacterRenderStyle[]): CharacterRenderStyle[] {
  if (styles.length <= 1) return styles

  const adjusted = [...styles]

  if (new Set(adjusted.map((style) => style.fontConfig.name)).size === 1) {
    const lastIndex = adjusted.length - 1
    const last = adjusted[lastIndex] as CharacterRenderStyle
    const nextFontConfig = nextAsciiArtFont(last.fontConfig)
    adjusted[lastIndex] = {
      ...last,
      fontConfig: nextFontConfig,
      font: loadFont(nextFontConfig)
    }
  }

  if (new Set(adjusted.map((style) => style.fontSize)).size === 1) {
    const lastIndex = adjusted.length - 1
    const last = adjusted[lastIndex] as CharacterRenderStyle
    adjusted[lastIndex] = {
      ...last,
      fontSize: nextFontSize(last.fontSize)
    }
  }

  if (new Set(adjusted.map((style) => style.rotationDegrees)).size === 1) {
    const lastIndex = adjusted.length - 1
    const last = adjusted[lastIndex] as CharacterRenderStyle
    adjusted[lastIndex] = {
      ...last,
      rotationDegrees: nextRotationDegrees(last.rotationDegrees)
    }
  }

  return enforceDistinctStyleSignatures(adjusted)
}

function enforceDistinctStyleSignatures(styles: CharacterRenderStyle[]): CharacterRenderStyle[] {
  const seen = new Set<string>()

  return styles.map((style, charIndex) => {
    let candidate = style
    let attempts = 0
    const maxAttempts =
      ASCII_ART_FONTS.length * MIXED_FONT_SIZE_VARIANTS.length * MIXED_ROTATION_DEGREES.length

    while (seen.has(characterStyleSignature(candidate)) && attempts < maxAttempts) {
      const fontConfig =
        ASCII_ART_FONTS[
          (asciiArtFontIndex(candidate.fontConfig) + charIndex + attempts + 1) %
            ASCII_ART_FONTS.length
        ] ?? candidate.fontConfig

      candidate = {
        ...candidate,
        fontConfig,
        font: loadFont(fontConfig),
        fontSize:
          MIXED_FONT_SIZE_VARIANTS[
            (fontSizeIndex(candidate.fontSize) + attempts + 1) % MIXED_FONT_SIZE_VARIANTS.length
          ] ?? candidate.fontSize,
        rotationDegrees:
          MIXED_ROTATION_DEGREES[
            (rotationDegreesIndex(candidate.rotationDegrees) + attempts + 1) %
              MIXED_ROTATION_DEGREES.length
          ] ?? candidate.rotationDegrees
      }
      attempts += 1
    }

    seen.add(characterStyleSignature(candidate))
    return candidate
  })
}

function characterStyleSignature(style: CharacterRenderStyle): string {
  return `${style.fontConfig.name}:${style.fontSize}:${style.rotationDegrees}`
}

function nextAsciiArtFont(fontConfig: AsciiArtFont): AsciiArtFont {
  return ASCII_ART_FONTS[(asciiArtFontIndex(fontConfig) + 1) % ASCII_ART_FONTS.length] ?? fontConfig
}

function nextFontSize(fontSize: number): number {
  return MIXED_FONT_SIZE_VARIANTS[(fontSizeIndex(fontSize) + 1) % MIXED_FONT_SIZE_VARIANTS.length] ?? fontSize
}

function nextRotationDegrees(rotationDegrees: number): number {
  return (
    MIXED_ROTATION_DEGREES[
      (rotationDegreesIndex(rotationDegrees) + 1) % MIXED_ROTATION_DEGREES.length
    ] ?? rotationDegrees
  )
}

function asciiArtFontIndex(fontConfig: AsciiArtFont): number {
  return Math.max(
    0,
    ASCII_ART_FONTS.findIndex((font) => font.name === fontConfig.name)
  )
}

function fontSizeIndex(fontSize: number): number {
  return Math.max(
    0,
    MIXED_FONT_SIZE_VARIANTS.findIndex((candidate) => candidate === fontSize)
  )
}

function rotationDegreesIndex(rotationDegrees: number): number {
  return Math.max(
    0,
    MIXED_ROTATION_DEGREES.findIndex((candidate) => candidate === rotationDegrees)
  )
}

function rotateContours(contours: readonly Point[][], degrees: number): Point[][] {
  if (degrees === 0 || contours.length === 0) return contours.map((contour) => [...contour])

  const bounds = boundsForContours(contours)
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  const radians = (degrees * Math.PI) / 180
  const sin = Math.sin(radians)
  const cos = Math.cos(radians)

  return contours.map((contour) =>
    contour.map((point) => {
      const x = point.x - centerX
      const y = point.y - centerY

      return {
        x: centerX + x * cos - y * sin,
        y: centerY + x * sin + y * cos
      }
    })
  )
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10
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
  if (coverage <= COVERAGE_THRESHOLD) return ' '

  const normalized = (coverage - COVERAGE_THRESHOLD) / (1 - COVERAGE_THRESHOLD)
  const index = Math.max(1, Math.ceil(normalized * (DENSITY_RAMP.length - 1)))
  return DENSITY_RAMP[index] ?? 'X'
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

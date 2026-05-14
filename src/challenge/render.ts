import {
  ASCII_ART_CELL_ADVANCE_X,
  ASCII_ART_CELL_ADVANCE_Y,
  ASCII_ART_CHARACTER_COLORS,
  type AsciiArtFont,
  type RgbaColor,
  type AsciiCodeArt,
  renderAsciiCodeArt,
  selectAsciiArtFont
} from './ascii-art-fonts'
import { SeededRandom } from './random'
import { temporalPointerSymbolAngleDegrees } from './temporal-pointer'
import {
  temporalPointerGridCharacterAnchorRatio,
  temporalPointerGridReadableCharacterRatio
} from './temporal-grid-layout'
import {
  TEMPORAL_POINTER_CHALLENGE_VERSION,
  TEMPORAL_POINTER_GRID_SLOTS,
  type ChallengeDisplayModel,
  type LegacySlideDisplayModel,
  type TemporalPointerDisplayModel,
  type TemporalPointerGridSlot,
  type TemporalPointerFrameCue
} from './types'

export interface Frame {
  width: number
  height: number
  rgba: Uint8Array
  delayMs: number
}

export type ChallengeRenderAssetSlot = 'challenge' | 'center' | TemporalPointerGridSlot

export interface ChallengeRenderAsset {
  slot: ChallengeRenderAssetSlot
  filenamePart: string
  frames: Frame[]
}

export const FRAME_WIDTH = 528
export const FRAME_HEIGHT = 528
export const FRAME_DELAY_MS = 90
export const CODE_HOLD_FRAMES = 5
export const TEMPORAL_DIRECTION_CELL_LOOP_FRAMES = 12

const BACKGROUND = [240, 239, 234, 255] as const
const TEXT = ASCII_ART_CHARACTER_COLORS[0] as RgbaColor
const MUTED = [110, 116, 122, 255] as const
const NOISE = [176, 170, 160, 255] as const
const DUST = [211, 205, 196, 255] as const
const TEMPORAL_SYMBOL_MIN_CONTRAST_RATIO = 4.5
const TEMPORAL_WHEEL_SYMBOL_COLORS = ASCII_ART_CHARACTER_COLORS.filter(
  (color) => contrastRatio(color, BACKGROUND) >= TEMPORAL_SYMBOL_MIN_CONTRAST_RATIO
)

const POINTER_CENTER_X = Math.round(FRAME_WIDTH / 2)
const POINTER_CENTER_Y = Math.round(FRAME_HEIGHT / 2)
const WHEEL_RADIUS_X = 232
const WHEEL_RADIUS_Y = 232
const WHEEL_LABEL_FONT_SIZE_VARIANTS = [16, 17, 18] as const
const WHEEL_LABEL_TRACKING = -2
const WHEEL_SYMBOL_JITTER_X_PX = [-3, -2, -1, 0, 1, 2, 3] as const
const WHEEL_SYMBOL_JITTER_Y_PX = [-1, 0, 1] as const
const WHEEL_SYMBOL_ROTATION_DEGREES = [-7, -5, -3, 0, 3, 5, 7] as const
const WHEEL_SYMBOL_SCALE_Y = [0.8, 0.84, 0.88] as const
const GRID_LABEL_FONT_SIZE_VARIANTS = [22, 24, 26] as const
const GRID_SYMBOL_ROTATION_DEGREES = [-5, -3, 0, 3, 5] as const
const GRID_SYMBOL_SCALE_Y = [0.88, 0.92, 0.96, 1] as const
const TEMPORAL_GRID_ANCHOR_RADIUS = 3
const TEMPORAL_GRID_READABLE_MARGIN = 12
const POINTER_INSET = 18
const POINTER_ARROWHEAD_LENGTH = 16
const TEMPORAL_TIMELINE_BORDER_INSET = 10
const TEMPORAL_TIMELINE_BORDER_THICKNESS = 3

const TINY_ASCII_FONT: Record<string, readonly string[]> = {
  '!': ['010', '010', '010', '000', '010'],
  '?': ['111', '001', '011', '000', '010'],
  '#': ['111', '111', '111', '111', '111'],
  '@': ['111', '101', '101', '100', '111'],
  '$': ['111', '110', '111', '011', '111'],
  X: ['101', '101', '010', '101', '101'],
  x: ['000', '101', '010', '101', '000'],
  '%': ['101', '001', '010', '100', '101'],
  '&': ['010', '101', '010', '101', '011'],
  '*': ['101', '010', '111', '010', '101'],
  '+': ['000', '010', '111', '010', '000'],
  ',': ['000', '000', '000', '010', '100'],
  '=': ['000', '111', '000', '111', '000'],
  ':': ['000', '010', '000', '010', '000'],
  ';': ['000', '010', '000', '010', '100'],
  '.': ['000', '000', '000', '000', '010'],
  '-': ['000', '000', '111', '000', '000'],
  '/': ['001', '001', '010', '100', '100'],
  '\\': ['100', '100', '010', '001', '001'],
  '|': ['010', '010', '010', '010', '010'],
  '_': ['000', '000', '000', '000', '111'],
  '~': ['000', '011', '110', '000', '000'],
  '^': ['010', '101', '000', '000', '000'],
  '<': ['001', '010', '100', '010', '001'],
  '>': ['100', '010', '001', '010', '100'],
  '[': ['110', '100', '100', '100', '110'],
  ']': ['011', '001', '001', '001', '011'],
  '{': ['011', '010', '110', '010', '011'],
  '}': ['110', '010', '011', '010', '110'],
  '(': ['010', '100', '100', '100', '010'],
  ')': ['010', '001', '001', '001', '010']
}

const DUST_SYMBOLS = ['+', '=', '/', '\\', '|', '_'] as const
const TEMPORAL_SYMBOL_DECOY_STROKES = ['|', '/', '\\', '_', '-', '+', '=', '(', ')', '[', ']'] as const
export const TEMPORAL_SYMBOL_REAL_STROKE_DROPOUT_RATIO = 0.18
export const TEMPORAL_SYMBOL_MIN_VISIBLE_RATIO = 0.7
const TEMPORAL_SYMBOL_MASK_PERIOD = 9
const TEMPORAL_SYMBOL_MIN_CELLS_FOR_INTERFERENCE = 8
const TINY_SCALE = 1
const TINY_GLYPH_WIDTH = 3
const TINY_GLYPH_HEIGHT = 5

const enum SlideDirection {
  Left = 'left',
  Right = 'right',
  Up = 'up',
  Down = 'down'
}

export function renderChallengeFrames(challenge: ChallengeDisplayModel): Frame[] {
  if (challenge.version === TEMPORAL_POINTER_CHALLENGE_VERSION) {
    return renderTemporalPointerFrames(challenge)
  }

  return renderLegacySlideChallengeFrames(challenge)
}

export function renderChallengeAssets(challenge: ChallengeDisplayModel): ChallengeRenderAsset[] {
  if (challenge.version !== TEMPORAL_POINTER_CHALLENGE_VERSION) {
    return [{ slot: 'challenge', filenamePart: 'challenge', frames: renderLegacySlideChallengeFrames(challenge) }]
  }

  return [
    { slot: 'center', filenamePart: 'center', frames: renderTemporalPointerFrames(challenge) },
    ...TEMPORAL_POINTER_GRID_SLOTS.map((slot, symbolIndex) => ({
      slot,
      filenamePart: slot.toLowerCase(),
      frames: renderTemporalDirectionCellFrames(challenge, symbolIndex)
    }))
  ]
}

function renderLegacySlideChallengeFrames(challenge: LegacySlideDisplayModel): Frame[] {
  const frames: Frame[] = []
  const codeArt = challenge.codes.map((code, codeIndex) =>
    renderAsciiCodeArt(code, selectAsciiArtFont(challenge.seed, codeIndex), {
      seed: challenge.seed,
      codeIndex
    })
  )

  for (let codeIndex = 0; codeIndex < challenge.codes.length; codeIndex++) {
    const art = codeArt[codeIndex] as AsciiCodeArt

    for (let holdIndex = 0; holdIndex < CODE_HOLD_FRAMES; holdIndex++) {
      frames.push(renderHoldFrame(challenge, art, codeIndex, holdIndex))
    }

    if (codeIndex + 1 < challenge.codes.length) {
      const nextArt = codeArt[codeIndex + 1] as AsciiCodeArt

      for (let frameIndex = 0; frameIndex < challenge.params.animationFrames; frameIndex++) {
        frames.push(renderTransitionFrame(challenge, art, nextArt, codeIndex, frameIndex))
      }
    }
  }

  return frames
}

function renderTemporalPointerFrames(challenge: TemporalPointerDisplayModel): Frame[] {
  return challenge.timeline.map((cue) => renderTemporalPointerFrame(challenge, cue))
}

function renderTemporalPointerFrame(
  challenge: TemporalPointerDisplayModel,
  cue: TemporalPointerFrameCue
): Frame {
  const rgba = new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT * 4)
  const random = new SeededRandom(`${challenge.seed}:temporal-frame:${cue.frameIndex}`)
  prepareCanvas(rgba, random)

  drawTemporalPointer(rgba, cue.pointerAngleDegrees)
  drawTemporalHub(rgba)
  drawTemporalTimelineBorder(rgba, cue.frameIndex, challenge.timeline.length)

  return {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    rgba,
    delayMs: challenge.params.frameDelayMs
  }
}

function renderTemporalDirectionCellFrames(
  challenge: TemporalPointerDisplayModel,
  symbolIndex: number
): Frame[] {
  const symbol = challenge.wheelSymbols[symbolIndex]
  if (!symbol) return []

  const characters = [...symbol].map((character, characterIndex) => {
    const style = temporalGridSymbolStyle(challenge.seed, symbolIndex, characterIndex)
    return {
      art: renderAsciiCodeArt(character, style.font, {
        seed: challenge.seed,
        codeIndex: symbolIndex * 8 + characterIndex
      }),
      characterIndex,
      characterCount: symbol.length,
      style
    }
  })

  return Array.from({ length: TEMPORAL_DIRECTION_CELL_LOOP_FRAMES }, (_unused, frameIndex) =>
    renderTemporalDirectionCellFrame(challenge, characters, symbolIndex, frameIndex)
  )
}

interface TemporalGridCharacterRender {
  art: AsciiCodeArt
  characterIndex: number
  characterCount: number
  style: TemporalWheelSymbolStyle
}

function renderTemporalDirectionCellFrame(
  challenge: TemporalPointerDisplayModel,
  characters: readonly TemporalGridCharacterRender[],
  symbolIndex: number,
  frameIndex: number
): Frame {
  const rgba = new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT * 4)
  const random = new SeededRandom(`${challenge.seed}:temporal-cell:${symbolIndex}:${frameIndex}`)
  prepareCanvas(rgba, random)

  for (const character of characters) {
    const interferenceIndex = symbolIndex * 8 + character.characterIndex
    const frameArt = temporalSymbolArtForFrame(character.art, challenge, interferenceIndex, frameIndex)
    const target = temporalGridCharacterTargetPoint(
      symbolIndex,
      character.characterIndex,
      character.characterCount
    )
    const base = temporalGridReadableCharacterPosition(
      frameArt,
      symbolIndex,
      character.characterIndex,
      character.characterCount
    )
    const readableCenter = {
      x: Math.round(base.x + character.style.offsetX + frameArt.widthPx / 2),
      y: Math.round(base.y + character.style.offsetY + frameArt.heightPx / 2)
    }

    if (pointDistance(target, readableCenter) > 8) {
      drawLine(rgba, target.x, target.y, readableCenter.x, readableCenter.y, DUST)
      drawTemporalTargetAnchor(rgba, target.x, target.y)
    }
    drawAsciiArtRowsTransformed(rgba, frameArt, base.x, base.y, TEXT, character.style)
  }

  drawObstruction(rgba, random)

  return {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    rgba,
    delayMs: challenge.params.frameDelayMs
  }
}

export function hasTinyAsciiGlyph(symbol: string): boolean {
  return TINY_ASCII_FONT[symbol] !== undefined
}

function renderHoldFrame(
  challenge: LegacySlideDisplayModel,
  art: AsciiCodeArt,
  codeIndex: number,
  holdIndex: number
): Frame {
  const rgba = new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT * 4)
  const random = new SeededRandom(`${challenge.seed}:hold:${codeIndex}:${holdIndex}`)
  prepareCanvas(rgba, random)

  const pulse = Math.sin((holdIndex / CODE_HOLD_FRAMES) * Math.PI * 2)
  const base = centerPosition(art)
  const x = base.x + Math.round(pulse * 2) + random.nextInt(3) - 1
  const y = base.y + random.nextInt(3) - 1

  drawAsciiArtRows(rgba, art, x, y, TEXT)
  drawObstruction(rgba, random)

  return {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    rgba,
    delayMs: FRAME_DELAY_MS
  }
}

function renderTransitionFrame(
  challenge: LegacySlideDisplayModel,
  sourceArt: AsciiCodeArt,
  targetArt: AsciiCodeArt,
  transitionIndex: number,
  frameIndex: number
): Frame {
  const rgba = new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT * 4)
  const random = new SeededRandom(`${challenge.seed}:transition:${transitionIndex}:${frameIndex}`)
  prepareCanvas(rgba, random)

  const progress = easeInOut(frameIndex / Math.max(1, challenge.params.animationFrames - 1))
  const direction = slideDirection(challenge.seed, transitionIndex)
  const sourceBase = centerPosition(sourceArt)
  const targetBase = centerPosition(targetArt)
  const distance =
    direction === SlideDirection.Left || direction === SlideDirection.Right
      ? Math.max(sourceArt.widthPx, targetArt.widthPx) + 64
      : Math.max(sourceArt.heightPx, targetArt.heightPx) + 36
  const offset = Math.round(progress * distance)
  const source = { x: sourceBase.x, y: sourceBase.y }
  const target = { x: targetBase.x, y: targetBase.y }

  switch (direction) {
    case SlideDirection.Left:
      source.x -= offset
      target.x += distance - offset
      break
    case SlideDirection.Right:
      source.x += offset
      target.x -= distance - offset
      break
    case SlideDirection.Up:
      source.y -= offset
      target.y += distance - offset
      break
    case SlideDirection.Down:
      source.y += offset
      target.y -= distance - offset
      break
  }

  drawAsciiArtRows(rgba, sourceArt, source.x, source.y, TEXT)
  drawAsciiArtRows(rgba, targetArt, target.x, target.y, TEXT)
  drawObstruction(rgba, random)

  return {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    rgba,
    delayMs: FRAME_DELAY_MS
  }
}

interface TemporalWheelSymbolStyle {
  font: AsciiArtFont
  offsetX: number
  offsetY: number
  rotationDegrees: number
  scaleY: number
  color?: RgbaColor
}

function temporalWheelSymbolStyle(seed: string, symbolIndex: number): TemporalWheelSymbolStyle {
  const random = new SeededRandom(`${seed}:temporal-wheel-symbol-style:${symbolIndex}`)
  const selected = selectAsciiArtFont(seed, symbolIndex)
  const fontSize = WHEEL_LABEL_FONT_SIZE_VARIANTS[random.nextInt(WHEEL_LABEL_FONT_SIZE_VARIANTS.length)] as number

  return {
    font: {
      ...selected,
      name: `${selected.name}-wheel`,
      fontSize,
      tracking: WHEEL_LABEL_TRACKING
    },
    offsetX: WHEEL_SYMBOL_JITTER_X_PX[random.nextInt(WHEEL_SYMBOL_JITTER_X_PX.length)] as number,
    offsetY: WHEEL_SYMBOL_JITTER_Y_PX[random.nextInt(WHEEL_SYMBOL_JITTER_Y_PX.length)] as number,
    rotationDegrees: WHEEL_SYMBOL_ROTATION_DEGREES[
      random.nextInt(WHEEL_SYMBOL_ROTATION_DEGREES.length)
    ] as number,
    scaleY: WHEEL_SYMBOL_SCALE_Y[random.nextInt(WHEEL_SYMBOL_SCALE_Y.length)] as number,
    color: selectTemporalWheelColor(random)
  }
}

function temporalGridSymbolStyle(seed: string, symbolIndex: number, characterIndex: number): TemporalWheelSymbolStyle {
  const random = new SeededRandom(`${seed}:temporal-grid-symbol-style:${symbolIndex}:${characterIndex}`)
  const selected = selectAsciiArtFont(seed, symbolIndex * 8 + characterIndex)
  const fontSize = GRID_LABEL_FONT_SIZE_VARIANTS[random.nextInt(GRID_LABEL_FONT_SIZE_VARIANTS.length)] as number

  return {
    font: {
      ...selected,
      name: `${selected.name}-grid`,
      fontSize,
      tracking: selected.tracking
    },
    offsetX: 0,
    offsetY: 0,
    rotationDegrees: GRID_SYMBOL_ROTATION_DEGREES[
      random.nextInt(GRID_SYMBOL_ROTATION_DEGREES.length)
    ] as number,
    scaleY: GRID_SYMBOL_SCALE_Y[random.nextInt(GRID_SYMBOL_SCALE_Y.length)] as number
  }
}

function selectTemporalWheelColor(random: SeededRandom): RgbaColor {
  return TEMPORAL_WHEEL_SYMBOL_COLORS[random.nextInt(TEMPORAL_WHEEL_SYMBOL_COLORS.length)] ?? TEXT
}

function drawTemporalWheel(
  rgba: Uint8Array,
  challenge: TemporalPointerDisplayModel,
  symbolArt: readonly AsciiCodeArt[],
  symbolStyles: readonly TemporalWheelSymbolStyle[],
  frameIndex: number
): void {
  for (let symbolIndex = 0; symbolIndex < challenge.wheelSymbols.length; symbolIndex++) {
    const art = symbolArt[symbolIndex]
    const style = symbolStyles[symbolIndex]
    if (!art || !style) continue

    const position = wheelSymbolPosition(symbolIndex, challenge.wheelSymbols.length, art)
    const frameArt = temporalSymbolArtForFrame(art, challenge, symbolIndex, frameIndex)
    drawAsciiArtRowsTransformed(rgba, frameArt, position.x, position.y, TEXT, style)
  }
}

interface TemporalArtCell {
  row: number
  col: number
  characterIndex: number
}

export function temporalSymbolArtForFrame(
  art: AsciiCodeArt,
  challenge: TemporalPointerDisplayModel,
  symbolIndex: number,
  frameIndex: number
): AsciiCodeArt {
  if (art.columns === 0 || art.rowCount === 0) return art

  const rows = art.rows.map((row) => [...row.padEnd(art.columns, ' ')])
  const characterCells = art.characterCells.map((row) =>
    Array.from({ length: art.columns }, (_unused, col) => row[col] ?? -1)
  )
  const visibleCells = collectTemporalArtCells(rows, characterCells)
  if (visibleCells.length < TEMPORAL_SYMBOL_MIN_CELLS_FOR_INTERFERENCE) {
    return {
      ...art,
      rows: rows.map((row) => row.join('')),
      characterCells
    }
  }

  const minVisibleCells = Math.ceil(visibleCells.length * TEMPORAL_SYMBOL_MIN_VISIBLE_RATIO)
  applyTemporalStrokeDropout(rows, visibleCells, challenge.seed, symbolIndex, frameIndex, minVisibleCells)
  applyTemporalDecoyStrokes(rows, characterCells, visibleCells, challenge.seed, symbolIndex, frameIndex)
  applyTemporalMovingAsciiMask(rows, minVisibleCells, symbolIndex, frameIndex)

  return {
    ...art,
    rows: rows.map((row) => row.join('')),
    characterCells
  }
}

function collectTemporalArtCells(rows: readonly (readonly string[])[], characterCells: readonly (readonly number[])[]): TemporalArtCell[] {
  const cells: TemporalArtCell[] = []

  for (let row = 0; row < rows.length; row++) {
    const symbols = rows[row]
    if (!symbols) continue

    for (let col = 0; col < symbols.length; col++) {
      const symbol = symbols[col]
      if (!symbol || symbol === ' ') continue
      cells.push({
        row,
        col,
        characterIndex: characterCells[row]?.[col] ?? -1
      })
    }
  }

  return cells
}

function applyTemporalStrokeDropout(
  rows: string[][],
  visibleCells: readonly TemporalArtCell[],
  seed: string,
  symbolIndex: number,
  frameIndex: number,
  minVisibleCells: number
): void {
  const maxDropoutCells = Math.floor(visibleCells.length * TEMPORAL_SYMBOL_REAL_STROKE_DROPOUT_RATIO)
  const dropoutCells = Math.min(maxDropoutCells, Math.max(0, visibleCells.length - minVisibleCells))
  if (dropoutCells <= 0) return

  let cleared = 0

  for (const cell of visibleCells) {
    if (cleared >= dropoutCells) break
    if (temporalCellScore(seed, symbolIndex, frameIndex, 'dropout', cell) > TEMPORAL_SYMBOL_REAL_STROKE_DROPOUT_RATIO) {
      continue
    }

    rows[cell.row]![cell.col] = ' '
    cleared += 1
  }
}

function applyTemporalDecoyStrokes(
  rows: string[][],
  characterCells: number[][],
  sourceCells: readonly TemporalArtCell[],
  seed: string,
  symbolIndex: number,
  frameIndex: number
): void {
  const random = new SeededRandom(`${seed}:temporal-symbol-interference:${symbolIndex}:${frameIndex}:decoys`)
  const decoyCount = 1 + random.nextInt(2)
  const offsets = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
    { row: -1, col: -1 },
    { row: -1, col: 1 },
    { row: 1, col: -1 },
    { row: 1, col: 1 }
  ] as const
  let placed = 0
  const maxAttempts = Math.max(16, sourceCells.length * 3)

  for (let attempt = 0; attempt < maxAttempts && placed < decoyCount; attempt++) {
    const source = sourceCells[random.nextInt(sourceCells.length)] as TemporalArtCell
    const offset = offsets[random.nextInt(offsets.length)] as (typeof offsets)[number]
    const row = source.row + offset.row
    const col = source.col + offset.col
    if (row < 0 || row >= rows.length || col < 0 || col >= rows[row]!.length) continue
    if (rows[row]![col] !== ' ') continue

    rows[row]![col] = TEMPORAL_SYMBOL_DECOY_STROKES[random.nextInt(TEMPORAL_SYMBOL_DECOY_STROKES.length)] as string
    characterCells[row]![col] = source.characterIndex
    placed += 1
  }
}

function applyTemporalMovingAsciiMask(
  rows: string[][],
  minVisibleCells: number,
  symbolIndex: number,
  frameIndex: number
): void {
  const visibleCells = collectTemporalArtCells(rows, [])
  const clearBudget = Math.max(0, visibleCells.length - minVisibleCells)
  if (clearBudget <= 0) return

  const stripePhase = (frameIndex + symbolIndex * 3) % TEMPORAL_SYMBOL_MASK_PERIOD
  let cleared = 0

  for (const cell of visibleCells) {
    if (cleared >= clearBudget) break
    if ((cell.row + cell.col) % TEMPORAL_SYMBOL_MASK_PERIOD !== stripePhase) continue

    rows[cell.row]![cell.col] = ' '
    cleared += 1
  }
}

function temporalCellScore(
  seed: string,
  symbolIndex: number,
  frameIndex: number,
  phase: string,
  cell: TemporalArtCell
): number {
  return normalizedHash(
    `${seed}:temporal-symbol-interference:${phase}:${symbolIndex}:${frameIndex}:${cell.row}:${cell.col}`
  )
}

function normalizedHash(value: string): number {
  let hash = 2166136261

  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0) / 0x100000000
}

function contrastRatio(
  foreground: readonly [number, number, number, number],
  background: readonly [number, number, number, number]
): number {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

function relativeLuminance(color: readonly [number, number, number, number]): number {
  const [red, green, blue] = color
  const [r, g, b] = [red, green, blue].map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function drawTemporalPointer(rgba: Uint8Array, angleDegrees: number): void {
  const radians = degreesToRadians(angleDegrees)
  const radius = ellipseRadiusAtAngle(radians) - POINTER_INSET
  const tipX = POINTER_CENTER_X + Math.cos(radians) * radius
  const tipY = POINTER_CENTER_Y + Math.sin(radians) * radius

  drawLine(rgba, POINTER_CENTER_X, POINTER_CENTER_Y, Math.round(tipX), Math.round(tipY), TEXT)

  for (const offset of [-0.72, 0.72]) {
    const headAngle = radians + Math.PI + offset
    drawLine(
      rgba,
      Math.round(tipX),
      Math.round(tipY),
      Math.round(tipX + Math.cos(headAngle) * POINTER_ARROWHEAD_LENGTH),
      Math.round(tipY + Math.sin(headAngle) * POINTER_ARROWHEAD_LENGTH),
      TEXT
    )
  }
}

function drawTemporalHub(rgba: Uint8Array): void {
  fillCircle(rgba, POINTER_CENTER_X, POINTER_CENTER_Y, 7, DUST)
  fillCircle(rgba, POINTER_CENTER_X, POINTER_CENTER_Y, 3, MUTED)
}

function drawTemporalTimelineBorder(rgba: Uint8Array, frameIndex: number, frameCount: number): void {
  const left = TEMPORAL_TIMELINE_BORDER_INSET
  const top = TEMPORAL_TIMELINE_BORDER_INSET
  const right = FRAME_WIDTH - TEMPORAL_TIMELINE_BORDER_INSET - 1
  const bottom = FRAME_HEIGHT - TEMPORAL_TIMELINE_BORDER_INSET - 1
  const perimeter = 2 * ((right - left) + (bottom - top))
  const progress = frameIndex / Math.max(1, frameCount - 1)
  const activeLength = Math.round(perimeter * (1 - progress))

  for (let offset = 0; offset < TEMPORAL_TIMELINE_BORDER_THICKNESS; offset++) {
    drawTimelineBorderLength(rgba, left + offset, top + offset, right - offset, bottom - offset, activeLength, TEXT)
  }
}

function drawTemporalTargetAnchor(rgba: Uint8Array, centerX: number, centerY: number): void {
  fillCircle(rgba, centerX, centerY, TEMPORAL_GRID_ANCHOR_RADIUS, DUST)
  drawLine(rgba, centerX - 5, centerY, centerX - 2, centerY, MUTED)
  drawLine(rgba, centerX + 2, centerY, centerX + 5, centerY, MUTED)
  drawLine(rgba, centerX, centerY - 5, centerX, centerY - 2, MUTED)
  drawLine(rgba, centerX, centerY + 2, centerX, centerY + 5, MUTED)
}

function wheelSymbolPosition(
  symbolIndex: number,
  symbolCount: number,
  art: AsciiCodeArt
): { x: number; y: number; centerX: number; centerY: number } {
  const radians = degreesToRadians(temporalPointerSymbolAngleDegrees(symbolIndex, symbolCount))
  const centerX = Math.round(POINTER_CENTER_X + Math.cos(radians) * WHEEL_RADIUS_X)
  const centerY = Math.round(POINTER_CENTER_Y + Math.sin(radians) * WHEEL_RADIUS_Y)

  return {
    x: Math.round(centerX - art.widthPx / 2),
    y: Math.round(centerY - art.heightPx / 2),
    centerX,
    centerY
  }
}

function ellipseRadiusAtAngle(radians: number): number {
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return 1 / Math.sqrt((cos * cos) / (WHEEL_RADIUS_X * WHEEL_RADIUS_X) + (sin * sin) / (WHEEL_RADIUS_Y * WHEEL_RADIUS_Y))
}

function prepareCanvas(rgba: Uint8Array, random: SeededRandom): void {
  fill(rgba, BACKGROUND)
  drawDustField(rgba, random)
  drawLines(rgba, random)
}

function fill(rgba: Uint8Array, color: readonly [number, number, number, number]): void {
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = color[0]
    rgba[i + 1] = color[1]
    rgba[i + 2] = color[2]
    rgba[i + 3] = color[3]
  }
}

function drawDustField(rgba: Uint8Array, random: SeededRandom): void {
  for (let i = 0; i < 120; i++) {
    setPixel(
      rgba,
      random.nextInt(FRAME_WIDTH),
      random.nextInt(FRAME_HEIGHT),
      random.nextInt(5) === 0 ? MUTED : NOISE
    )
  }

  for (let i = 0; i < 24; i++) {
    const symbol = DUST_SYMBOLS[random.nextInt(DUST_SYMBOLS.length)] as string
    drawTinySymbol(
      rgba,
      symbol,
      random.nextInt(FRAME_WIDTH),
      random.nextInt(FRAME_HEIGHT),
      random.nextInt(4) === 0 ? MUTED : DUST
    )
  }
}

function drawLines(rgba: Uint8Array, random: SeededRandom): void {
  for (let i = 0; i < 5; i++) {
    drawLine(
      rgba,
      random.nextInt(FRAME_WIDTH),
      random.nextInt(FRAME_HEIGHT),
      random.nextInt(FRAME_WIDTH),
      random.nextInt(FRAME_HEIGHT),
      NOISE
    )
  }
}

function drawObstruction(rgba: Uint8Array, random: SeededRandom): void {
  for (let i = 0; i < 3; i++) {
    const y = 16 + random.nextInt(FRAME_HEIGHT - 32)
    const color = random.nextInt(3) === 0 ? MUTED : NOISE
    drawLine(
      rgba,
      12 + random.nextInt(36),
      y,
      FRAME_WIDTH - 12 - random.nextInt(36),
      y + random.nextInt(9) - 4,
      color
    )
  }

  for (let i = 0; i < 14; i++) {
    const x = random.nextInt(FRAME_WIDTH)
    const y = random.nextInt(FRAME_HEIGHT)
    fillRect(rgba, x, y, 1 + random.nextInt(2), 8 + random.nextInt(16), DUST)
  }
}

function drawAsciiArtRows(
  rgba: Uint8Array,
  art: AsciiCodeArt,
  x: number,
  y: number,
  fallbackColor: RgbaColor
): void {
  for (let row = 0; row < art.rows.length; row++) {
    const symbols = art.rows[row] as string
    const characterCells = art.characterCells[row] ?? []

    for (let col = 0; col < symbols.length; col++) {
      const symbol = symbols[col]
      if (!symbol || symbol === ' ') continue
      const characterIndex = characterCells[col] ?? -1
      const color = art.characterStyles[characterIndex]?.color ?? fallbackColor

      drawTinySymbol(
        rgba,
        symbol,
        x + col * ASCII_ART_CELL_ADVANCE_X,
        y + row * ASCII_ART_CELL_ADVANCE_Y,
        color
      )
    }
  }
}

function drawAsciiArtRowsTransformed(
  rgba: Uint8Array,
  art: AsciiCodeArt,
  x: number,
  y: number,
  fallbackColor: RgbaColor,
  style: TemporalWheelSymbolStyle
): void {
  const radians = degreesToRadians(style.rotationDegrees)
  const sin = Math.sin(radians)
  const cos = Math.cos(radians)
  const centerX = x + style.offsetX + art.widthPx / 2
  const centerY = y + style.offsetY + art.heightPx / 2

  for (let row = 0; row < art.rows.length; row++) {
    const symbols = art.rows[row] as string
    const characterCells = art.characterCells[row] ?? []

    for (let col = 0; col < symbols.length; col++) {
      const symbol = symbols[col]
      if (!symbol || symbol === ' ') continue
      const characterIndex = characterCells[col] ?? -1
      const color = style.color ?? art.characterStyles[characterIndex]?.color ?? fallbackColor
      const cellX = x + style.offsetX + col * ASCII_ART_CELL_ADVANCE_X
      const cellY = y + style.offsetY + row * ASCII_ART_CELL_ADVANCE_Y
      const dx = cellX + TINY_GLYPH_WIDTH / 2 - centerX
      const dy = (cellY + TINY_GLYPH_HEIGHT / 2 - centerY) * style.scaleY
      const rotatedX = centerX + dx * cos - dy * sin - TINY_GLYPH_WIDTH / 2
      const rotatedY = centerY + dx * sin + dy * cos - TINY_GLYPH_HEIGHT / 2

      drawTinySymbol(rgba, symbol, Math.round(rotatedX), Math.round(rotatedY), color)
    }
  }
}

function drawTinySymbol(
  rgba: Uint8Array,
  symbol: string,
  x: number,
  y: number,
  color: readonly [number, number, number, number]
): void {
  const glyph = TINY_ASCII_FONT[symbol]
  if (!glyph) return

  for (let row = 0; row < TINY_GLYPH_HEIGHT; row++) {
    const bits = glyph[row] as string

    for (let col = 0; col < TINY_GLYPH_WIDTH; col++) {
      if (bits[col] === '1') {
        fillRect(rgba, x + col * TINY_SCALE, y + row * TINY_SCALE, TINY_SCALE, TINY_SCALE, color)
      }
    }
  }
}

function centerPosition(art: AsciiCodeArt): { x: number; y: number } {
  return {
    x: Math.round((FRAME_WIDTH - art.widthPx) / 2),
    y: Math.round((FRAME_HEIGHT - art.heightPx) / 2)
  }
}

function temporalGridCharacterTargetPoint(
  symbolIndex: number,
  characterIndex: number,
  characterCount: number
): { x: number; y: number } {
  const slot = TEMPORAL_POINTER_GRID_SLOTS[symbolIndex]
  if (!slot) return { x: POINTER_CENTER_X, y: POINTER_CENTER_Y }

  const anchor = temporalPointerGridCharacterAnchorRatio(slot, characterIndex, characterCount)
  return {
    x: Math.round(anchor.x * FRAME_WIDTH),
    y: Math.round(anchor.y * FRAME_HEIGHT)
  }
}

function temporalGridReadableCharacterPosition(
  art: AsciiCodeArt,
  symbolIndex: number,
  characterIndex: number,
  characterCount: number
): { x: number; y: number } {
  const slot = TEMPORAL_POINTER_GRID_SLOTS[symbolIndex]
  if (!slot) return centerPosition(art)

  const anchor = temporalPointerGridReadableCharacterRatio(slot, characterIndex, characterCount)
  const x = Math.round(anchor.x * FRAME_WIDTH - art.widthPx / 2)
  const y = Math.round(anchor.y * FRAME_HEIGHT - art.heightPx / 2)

  return {
    x: clamp(x, TEMPORAL_GRID_READABLE_MARGIN, FRAME_WIDTH - art.widthPx - TEMPORAL_GRID_READABLE_MARGIN),
    y: clamp(y, TEMPORAL_GRID_READABLE_MARGIN, FRAME_HEIGHT - art.heightPx - TEMPORAL_GRID_READABLE_MARGIN)
  }
}

function slideDirection(seed: string, transitionIndex: number): SlideDirection {
  const random = new SeededRandom(`${seed}:slide-direction:${transitionIndex}`)
  const directions = [
    SlideDirection.Left,
    SlideDirection.Right,
    SlideDirection.Up,
    SlideDirection.Down
  ]
  return directions[random.nextInt(directions.length)] as SlideDirection
}

function easeInOut(value: number): number {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

function pointDistance(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

function fillCircle(
  rgba: Uint8Array,
  centerX: number,
  centerY: number,
  radius: number,
  color: readonly [number, number, number, number]
): void {
  const radiusSquared = radius * radius

  for (let y = centerY - radius; y <= centerY + radius; y++) {
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      const dx = x - centerX
      const dy = y - centerY
      if (dx * dx + dy * dy <= radiusSquared) {
        setPixel(rgba, x, y, color)
      }
    }
  }
}

function fillRect(
  rgba: Uint8Array,
  x: number,
  y: number,
  width: number,
  height: number,
  color: readonly [number, number, number, number]
): void {
  for (let yy = y; yy < y + height; yy++) {
    for (let xx = x; xx < x + width; xx++) {
      setPixel(rgba, xx, yy, color)
    }
  }
}

function drawLine(
  rgba: Uint8Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: readonly [number, number, number, number]
): void {
  let dx = Math.abs(x1 - x0)
  let dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let error = dx + dy
  let x = x0
  let y = y0

  while (true) {
    setPixel(rgba, x, y, color)
    if (x === x1 && y === y1) {
      break
    }

    const doubled = 2 * error
    if (doubled >= dy) {
      error += dy
      x += sx
    }

    if (doubled <= dx) {
      error += dx
      y += sy
    }

    dx = Math.abs(x1 - x0)
    dy = -Math.abs(y1 - y0)
  }
}

function drawTimelineBorderLength(
  rgba: Uint8Array,
  left: number,
  top: number,
  right: number,
  bottom: number,
  length: number,
  color: readonly [number, number, number, number]
): void {
  let remaining = length
  remaining = drawTimelineSegment(rgba, left, top, right, top, remaining, color)
  remaining = drawTimelineSegment(rgba, right, top, right, bottom, remaining, color)
  remaining = drawTimelineSegment(rgba, right, bottom, left, bottom, remaining, color)
  drawTimelineSegment(rgba, left, bottom, left, top, remaining, color)
}

function drawTimelineSegment(
  rgba: Uint8Array,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  remaining: number,
  color: readonly [number, number, number, number]
): number {
  if (remaining <= 0) return 0

  const segmentLength = Math.abs(x1 - x0) + Math.abs(y1 - y0)
  const drawLength = Math.min(remaining, segmentLength)
  const ratio = segmentLength === 0 ? 0 : drawLength / segmentLength
  const endX = Math.round(x0 + (x1 - x0) * ratio)
  const endY = Math.round(y0 + (y1 - y0) * ratio)
  drawLine(rgba, x0, y0, endX, endY, color)

  return remaining - drawLength
}

function setPixel(
  rgba: Uint8Array,
  x: number,
  y: number,
  color: readonly [number, number, number, number]
): void {
  if (x < 0 || x >= FRAME_WIDTH || y < 0 || y >= FRAME_HEIGHT) {
    return
  }

  const offset = (y * FRAME_WIDTH + x) * 4
  rgba[offset] = color[0]
  rgba[offset + 1] = color[1]
  rgba[offset + 2] = color[2]
  rgba[offset + 3] = color[3]
}

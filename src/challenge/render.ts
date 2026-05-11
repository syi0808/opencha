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
  TEMPORAL_POINTER_CHALLENGE_VERSION,
  type ChallengeDisplayModel,
  type LegacySlideDisplayModel,
  type TemporalPointerDisplayModel,
  type TemporalPointerFrameCue
} from './types'

export interface Frame {
  width: number
  height: number
  rgba: Uint8Array
  delayMs: number
}

export const FRAME_WIDTH = 528
export const FRAME_HEIGHT = 528
export const FRAME_DELAY_MS = 90
export const CODE_HOLD_FRAMES = 5

const BACKGROUND = [240, 239, 234, 255] as const
const TEXT = ASCII_ART_CHARACTER_COLORS[0] as RgbaColor
const MUTED = [110, 116, 122, 255] as const
const NOISE = [176, 170, 160, 255] as const
const DUST = [211, 205, 196, 255] as const

const POINTER_CENTER_X = Math.round(FRAME_WIDTH / 2)
const POINTER_CENTER_Y = Math.round(FRAME_HEIGHT / 2)
const WHEEL_RADIUS_X = 206
const WHEEL_RADIUS_Y = 206
const WHEEL_LABEL_FONT_SIZE = 20
const WHEEL_LABEL_TRACKING = -2
const POINTER_INSET = 34
const POINTER_ARROWHEAD_LENGTH = 14

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
  const symbolArt = challenge.wheelSymbols.map((symbol, symbolIndex) =>
    renderAsciiCodeArt(symbol, wheelSymbolFont(challenge.seed, symbolIndex))
  )

  return challenge.timeline.map((cue) => renderTemporalPointerFrame(challenge, symbolArt, cue))
}

function renderTemporalPointerFrame(
  challenge: TemporalPointerDisplayModel,
  symbolArt: readonly AsciiCodeArt[],
  cue: TemporalPointerFrameCue
): Frame {
  const rgba = new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT * 4)
  const random = new SeededRandom(`${challenge.seed}:temporal-frame:${cue.frameIndex}`)
  prepareCanvas(rgba, random)

  drawTemporalWheel(rgba, challenge, symbolArt)
  drawTemporalPointer(rgba, cue.pointerAngleDegrees)
  drawTemporalHub(rgba)

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

function wheelSymbolFont(seed: string, symbolIndex: number): AsciiArtFont {
  const selected = selectAsciiArtFont(seed, symbolIndex)
  return {
    ...selected,
    name: `${selected.name}-wheel`,
    fontSize: WHEEL_LABEL_FONT_SIZE,
    tracking: WHEEL_LABEL_TRACKING
  }
}

function drawTemporalWheel(
  rgba: Uint8Array,
  challenge: TemporalPointerDisplayModel,
  symbolArt: readonly AsciiCodeArt[]
): void {
  for (let symbolIndex = 0; symbolIndex < challenge.wheelSymbols.length; symbolIndex++) {
    const art = symbolArt[symbolIndex]
    if (!art) continue

    const position = wheelSymbolPosition(symbolIndex, challenge.wheelSymbols.length, art)
    drawAsciiArtRows(rgba, art, position.x, position.y, TEXT)
  }
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
  for (let i = 0; i < 180; i++) {
    setPixel(
      rgba,
      random.nextInt(FRAME_WIDTH),
      random.nextInt(FRAME_HEIGHT),
      random.nextInt(5) === 0 ? MUTED : NOISE
    )
  }

  for (let i = 0; i < 46; i++) {
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
  for (let i = 0; i < 7; i++) {
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

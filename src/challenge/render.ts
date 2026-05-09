import { BITMAP_FONT, GLYPH_HEIGHT, GLYPH_WIDTH } from './bitmap-font'
import { SeededRandom } from './random'
import { type ChallengeDisplayModel } from './types'

export interface Frame {
  width: number
  height: number
  rgba: Uint8Array
  delayMs: number
}

export const FRAME_WIDTH = 360
export const FRAME_HEIGHT = 120
export const FRAME_DELAY_MS = 90
export const CODE_HOLD_FRAMES = 5

const BACKGROUND = [240, 239, 234, 255] as const
const TEXT = [41, 44, 48, 255] as const
const MUTED = [110, 116, 122, 255] as const
const NOISE = [176, 170, 160, 255] as const
const DUST = [211, 205, 196, 255] as const

const TINY_ASCII_FONT: Record<string, readonly string[]> = {
  '#': ['111', '111', '111', '111', '111'],
  '@': ['111', '101', '101', '100', '111'],
  '%': ['101', '001', '010', '100', '101'],
  '&': ['010', '101', '010', '101', '011'],
  '*': ['101', '010', '111', '010', '101'],
  '+': ['000', '010', '111', '010', '000'],
  '=': ['000', '111', '000', '111', '000'],
  '/': ['001', '001', '010', '100', '100'],
  '\\': ['100', '100', '010', '001', '001'],
  '|': ['010', '010', '010', '010', '010'],
  '_': ['000', '000', '000', '000', '111']
}

const INK_SYMBOLS = ['#', '@', '%', '&', '*', '+'] as const
const DUST_SYMBOLS = ['+', '=', '/', '\\', '|', '_'] as const
const TINY_SCALE = 2
const TINY_GLYPH_WIDTH = 3
const TINY_GLYPH_HEIGHT = 5
const CELL_STRIDE_X = 7
const CELL_STRIDE_Y = 9
const LETTER_GAP = 8
const CHALLENGE_CODE_LENGTH = 5
const CODE_RENDER_WIDTH =
  CHALLENGE_CODE_LENGTH * GLYPH_WIDTH * CELL_STRIDE_X +
  (CHALLENGE_CODE_LENGTH - 1) * LETTER_GAP
const CODE_RENDER_HEIGHT = GLYPH_HEIGHT * CELL_STRIDE_Y

const enum SlideDirection {
  Left = 'left',
  Right = 'right',
  Up = 'up',
  Down = 'down'
}

export function renderChallengeFrames(challenge: ChallengeDisplayModel): Frame[] {
  const frames: Frame[] = []

  for (let codeIndex = 0; codeIndex < challenge.codes.length; codeIndex++) {
    const code = challenge.codes[codeIndex] as string

    for (let holdIndex = 0; holdIndex < CODE_HOLD_FRAMES; holdIndex++) {
      frames.push(renderHoldFrame(challenge, code, codeIndex, holdIndex))
    }

    if (codeIndex + 1 < challenge.codes.length) {
      const nextCode = challenge.codes[codeIndex + 1] as string

      for (let frameIndex = 0; frameIndex < challenge.params.animationFrames; frameIndex++) {
        frames.push(renderTransitionFrame(challenge, code, nextCode, codeIndex, frameIndex))
      }
    }
  }

  return frames
}

function renderHoldFrame(
  challenge: ChallengeDisplayModel,
  code: string,
  codeIndex: number,
  holdIndex: number
): Frame {
  const rgba = new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT * 4)
  const random = new SeededRandom(`${challenge.seed}:hold:${codeIndex}:${holdIndex}`)
  prepareCanvas(rgba, random)

  const pulse = Math.sin((holdIndex / CODE_HOLD_FRAMES) * Math.PI * 2)
  const base = centerPosition()
  const x = base.x + Math.round(pulse * 2) + random.nextInt(3) - 1
  const y = base.y + random.nextInt(3) - 1

  drawAsciiArtCode(rgba, code, x, y, TEXT, random)
  drawObstruction(rgba, random)

  return {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    rgba,
    delayMs: FRAME_DELAY_MS
  }
}

function renderTransitionFrame(
  challenge: ChallengeDisplayModel,
  sourceCode: string,
  targetCode: string,
  transitionIndex: number,
  frameIndex: number
): Frame {
  const rgba = new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT * 4)
  const random = new SeededRandom(`${challenge.seed}:transition:${transitionIndex}:${frameIndex}`)
  prepareCanvas(rgba, random)

  const progress = easeInOut(frameIndex / Math.max(1, challenge.params.animationFrames - 1))
  const direction = slideDirection(challenge.seed, transitionIndex)
  const base = centerPosition()
  const distance =
    direction === SlideDirection.Left || direction === SlideDirection.Right
      ? CODE_RENDER_WIDTH + 64
      : CODE_RENDER_HEIGHT + 36
  const offset = Math.round(progress * distance)
  const source = { x: base.x, y: base.y }
  const target = { x: base.x, y: base.y }

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

  drawAsciiArtCode(rgba, sourceCode, source.x, source.y, MUTED, random)
  drawAsciiArtCode(rgba, targetCode, target.x, target.y, TEXT, random)
  drawObstruction(rgba, random)

  return {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    rgba,
    delayMs: FRAME_DELAY_MS
  }
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

function drawAsciiArtCode(
  rgba: Uint8Array,
  code: string,
  x: number,
  y: number,
  color: readonly [number, number, number, number],
  random: SeededRandom
): void {
  let cursorX = x

  for (const char of code) {
    const glyph = BITMAP_FONT[char]
    if (!glyph) {
      cursorX += GLYPH_WIDTH * CELL_STRIDE_X + LETTER_GAP
      continue
    }

    drawAsciiGlyph(rgba, glyph, cursorX, y, color, random)
    cursorX += GLYPH_WIDTH * CELL_STRIDE_X + LETTER_GAP
  }
}

function drawAsciiGlyph(
  rgba: Uint8Array,
  glyph: readonly string[],
  x: number,
  y: number,
  color: readonly [number, number, number, number],
  random: SeededRandom
): void {
  for (let row = 0; row < GLYPH_HEIGHT; row++) {
    const bits = glyph[row] as string

    for (let col = 0; col < GLYPH_WIDTH; col++) {
      const cellX = x + col * CELL_STRIDE_X + random.nextInt(3) - 1
      const cellY = y + row * CELL_STRIDE_Y + random.nextInt(3) - 1

      if (bits[col] === '1') {
        const symbol = INK_SYMBOLS[random.nextInt(INK_SYMBOLS.length)] as string
        drawTinySymbol(rgba, symbol, cellX, cellY, color)
      } else if (random.nextInt(9) === 0) {
        const symbol = DUST_SYMBOLS[random.nextInt(DUST_SYMBOLS.length)] as string
        drawTinySymbol(rgba, symbol, cellX, cellY, DUST)
      }
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

function centerPosition(): { x: number; y: number } {
  return {
    x: Math.round((FRAME_WIDTH - CODE_RENDER_WIDTH) / 2),
    y: Math.round((FRAME_HEIGHT - CODE_RENDER_HEIGHT) / 2)
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

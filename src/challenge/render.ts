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
export const FRAME_DELAY_MS = 320

const BACKGROUND = [240, 239, 234, 255] as const
const TEXT = [41, 44, 48, 255] as const
const MUTED = [110, 116, 122, 255] as const
const NOISE = [176, 170, 160, 255] as const
const ACCENT = [170, 64, 54, 255] as const

export function renderChallengeFrames(challenge: ChallengeDisplayModel): Frame[] {
  const frames: Frame[] = []

  for (let codeIndex = 0; codeIndex < challenge.codes.length; codeIndex++) {
    const code = challenge.codes[codeIndex] as string

    for (let frameIndex = 0; frameIndex < challenge.params.animationFrames; frameIndex++) {
      frames.push(renderFrame(challenge, code, codeIndex, frameIndex))
    }
  }

  return frames
}

function renderFrame(
  challenge: ChallengeDisplayModel,
  code: string,
  codeIndex: number,
  frameIndex: number
): Frame {
  const rgba = new Uint8Array(FRAME_WIDTH * FRAME_HEIGHT * 4)
  fill(rgba, BACKGROUND)

  const random = new SeededRandom(
    `${challenge.seed}:frame:${codeIndex}:${frameIndex}:${challenge.targetIndex}`
  )
  const progress = frameIndex / Math.max(1, challenge.params.animationFrames - 1)
  const slide = Math.round((progress - 0.5) * 28)
  const textWidth = code.length * GLYPH_WIDTH * 8 + (code.length - 1) * 6
  const baseX = Math.round((FRAME_WIDTH - textWidth) / 2) + slide
  const baseY = 33 + Math.round(Math.sin(progress * Math.PI * 2) * 2)

  drawNoise(rgba, random)
  drawLines(rgba, random)
  drawText(rgba, `${codeIndex + 1}`, 24, 18, 4, MUTED, random)
  drawText(rgba, code, baseX, baseY, 8, TEXT, random)

  if (codeIndex + 1 === challenge.targetIndex) {
    drawMarker(rgba, baseX - 13, baseY + 65)
  }

  return {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    rgba,
    delayMs: FRAME_DELAY_MS
  }
}

function fill(rgba: Uint8Array, color: readonly [number, number, number, number]): void {
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = color[0]
    rgba[i + 1] = color[1]
    rgba[i + 2] = color[2]
    rgba[i + 3] = color[3]
  }
}

function drawNoise(rgba: Uint8Array, random: SeededRandom): void {
  for (let i = 0; i < 420; i++) {
    setPixel(
      rgba,
      random.nextInt(FRAME_WIDTH),
      random.nextInt(FRAME_HEIGHT),
      random.nextInt(4) === 0 ? TEXT : NOISE
    )
  }
}

function drawLines(rgba: Uint8Array, random: SeededRandom): void {
  for (let i = 0; i < 4; i++) {
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

function drawText(
  rgba: Uint8Array,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: readonly [number, number, number, number],
  random: SeededRandom
): void {
  let cursorX = x

  for (const char of text) {
    const glyph = BITMAP_FONT[char]
    if (!glyph) {
      cursorX += (GLYPH_WIDTH + 1) * scale
      continue
    }

    const jitterX = random.nextInt(3) - 1
    const jitterY = random.nextInt(3) - 1
    drawGlyph(rgba, glyph, cursorX + jitterX, y + jitterY, scale, color)
    cursorX += GLYPH_WIDTH * scale + Math.max(2, Math.floor(scale * 0.75))
  }
}

function drawGlyph(
  rgba: Uint8Array,
  glyph: readonly string[],
  x: number,
  y: number,
  scale: number,
  color: readonly [number, number, number, number]
): void {
  for (let row = 0; row < GLYPH_HEIGHT; row++) {
    const bits = glyph[row] as string

    for (let col = 0; col < GLYPH_WIDTH; col++) {
      if (bits[col] !== '1') {
        continue
      }

      fillRect(rgba, x + col * scale, y + row * scale, scale, scale, color)
    }
  }
}

function drawMarker(rgba: Uint8Array, x: number, y: number): void {
  fillRect(rgba, x, y, 74, 4, ACCENT)
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

import { SeededRandom } from './random'
import {
  CHALLENGE_CHARSET,
  CODE_LENGTH_MAX,
  CODE_LENGTH_MIN,
  NOISE_LEVEL,
  TEMPORAL_POINTER_CHALLENGE_VERSION,
  TEMPORAL_POINTER_KIND,
  type TemporalPointerDisplayModel,
  type TemporalPointerFrameCue
} from './types'

export const TEMPORAL_RING_SIZE = 18
export const TEMPORAL_CAPTURE_HOLD_FRAMES = 5
export const TEMPORAL_NEAR_MISS_HOLD_FRAMES = 3
export const TEMPORAL_TRAVEL_FRAMES_MIN = 7
export const TEMPORAL_TRAVEL_FRAMES_MAX = 11
export const TEMPORAL_INTRO_FRAMES = 6
export const TEMPORAL_OUTRO_FRAMES = 6
export const TEMPORAL_FRAME_DELAY_MS = 90

const MAX_ANSWER_ATTEMPTS = 64
const MAX_WHEEL_SHUFFLE_ATTEMPTS = 256

export interface CreateTemporalPointerDisplayOptions {
  seed: string
}

export function createTemporalPointerDisplay(
  options: CreateTemporalPointerDisplayOptions
): TemporalPointerDisplayModel {
  const random = new SeededRandom(`${options.seed}:temporal-pointer`)

  for (let attempt = 0; attempt < MAX_ANSWER_ATTEMPTS; attempt++) {
    const answer = generateTemporalAnswer(random)
    const wheelSymbols = buildLeakFreeWheel(random, answer)
    if (!wheelSymbols) continue

    const decoyPauseCount = 0
    const timeline = buildPointerTimeline({
      seed: options.seed,
      answer,
      wheelSymbols,
      decoyPauseCount
    })

    return {
      version: TEMPORAL_POINTER_CHALLENGE_VERSION,
      kind: TEMPORAL_POINTER_KIND,
      seed: options.seed,
      answer,
      wheelSymbols,
      timeline,
      params: {
        kind: TEMPORAL_POINTER_KIND,
        codeLength: answer.length,
        ringSize: TEMPORAL_RING_SIZE,
        captureCount: answer.length,
        decoyPauseCount,
        frameDelayMs: TEMPORAL_FRAME_DELAY_MS,
        charset: CHALLENGE_CHARSET,
        noiseLevel: NOISE_LEVEL
      }
    }
  }

  throw new Error('Unable to create temporal pointer challenge without a static ring leak.')
}

export function ringContainsAnswerInAnyRotation(
  symbols: readonly string[],
  answer: string
): boolean {
  const ring = symbols.join('')
  const doubled = ring + ring
  const reversed = [...symbols].reverse().join('')
  return doubled.includes(answer) || (reversed + reversed).includes(answer)
}

export function visibleStringsForTemporalPointerFrame(
  display: TemporalPointerDisplayModel,
  cue: TemporalPointerFrameCue
): string[] {
  return [
    display.wheelSymbols.join(''),
    display.wheelSymbols[cue.pointedSymbolIndex] ?? '',
    '.'.repeat(cue.completedCaptures)
  ]
}

export function temporalPointerSymbolAngleDegrees(index: number, symbolCount: number): number {
  return -90 + (index * 360) / symbolCount
}

export function temporalPointerAngleToSymbolIndex(angleDegrees: number, symbolCount: number): number {
  const step = 360 / symbolCount
  const normalized = normalizeDegrees(angleDegrees - temporalPointerSymbolAngleDegrees(0, symbolCount))
  return Math.round(normalized / step) % symbolCount
}

function generateTemporalAnswer(random: SeededRandom): string {
  const length = CODE_LENGTH_MIN + random.nextInt(CODE_LENGTH_MAX - CODE_LENGTH_MIN + 1)
  let answer = ''

  for (let index = 0; index < length; index++) {
    answer += CHALLENGE_CHARSET[random.nextInt(CHALLENGE_CHARSET.length)] as string
  }

  return answer
}

function buildLeakFreeWheel(random: SeededRandom, answer: string): string[] | null {
  const symbols = uniqueSymbols(answer)
  const decoys = shuffle(
    [...CHALLENGE_CHARSET].filter((symbol) => !symbols.includes(symbol)),
    random
  ).slice(0, TEMPORAL_RING_SIZE - symbols.length)
  const candidates = [...symbols, ...decoys]

  for (let attempt = 0; attempt < MAX_WHEEL_SHUFFLE_ATTEMPTS; attempt++) {
    const wheel = shuffle(candidates, random)
    if (!ringContainsAnswerInAnyRotation(wheel, answer)) {
      return wheel
    }
  }

  return null
}

function buildPointerTimeline(input: {
  seed: string
  answer: string
  wheelSymbols: readonly string[]
  decoyPauseCount: number
}): TemporalPointerFrameCue[] {
  const random = new SeededRandom(`${input.seed}:temporal-pointer:timeline`)
  const timeline: TemporalPointerFrameCue[] = []
  let currentAngle = temporalPointerSymbolAngleDegrees(0, input.wheelSymbols.length)
  let completedCaptures = 0
  const decoyBeforeCaptures = selectDecoyBeforeCaptures(random, input.answer.length, input.decoyPauseCount)

  appendRotation(timeline, currentAngle, currentAngle + 360, TEMPORAL_INTRO_FRAMES, input.wheelSymbols.length, completedCaptures)
  currentAngle += 360

  for (let captureIndex = 0; captureIndex < input.answer.length; captureIndex++) {
    if (decoyBeforeCaptures.has(captureIndex)) {
      const decoyIndex = selectNearMissIndex(random, input.wheelSymbols, input.answer[captureIndex] as string)
      const decoyAngle = nextClockwiseAngle(currentAngle, temporalPointerSymbolAngleDegrees(decoyIndex, input.wheelSymbols.length))
      const travelFrames = randomTravelFrames(random)
      appendRotation(timeline, currentAngle, decoyAngle, travelFrames, input.wheelSymbols.length, completedCaptures)
      currentAngle = decoyAngle
      appendHold(timeline, currentAngle, decoyIndex, TEMPORAL_NEAR_MISS_HOLD_FRAMES, 'near-miss', null, completedCaptures)
    }

    const targetSymbol = input.answer[captureIndex] as string
    const targetIndex = input.wheelSymbols.indexOf(targetSymbol)
    if (targetIndex < 0) {
      throw new Error(`Temporal pointer wheel is missing answer symbol ${targetSymbol}.`)
    }

    const targetAngle = nextClockwiseAngle(
      currentAngle,
      temporalPointerSymbolAngleDegrees(targetIndex, input.wheelSymbols.length)
    )
    const travelFrames = randomTravelFrames(random)
    appendRotation(timeline, currentAngle, targetAngle, travelFrames, input.wheelSymbols.length, completedCaptures)
    currentAngle = targetAngle
    completedCaptures += 1
    appendHold(
      timeline,
      currentAngle,
      targetIndex,
      TEMPORAL_CAPTURE_HOLD_FRAMES,
      'capture',
      captureIndex,
      completedCaptures
    )
  }

  appendRotation(timeline, currentAngle, currentAngle + 360, TEMPORAL_OUTRO_FRAMES, input.wheelSymbols.length, completedCaptures)
  return timeline.map((cue, frameIndex) => ({ ...cue, frameIndex }))
}

function appendRotation(
  timeline: TemporalPointerFrameCue[],
  startAngle: number,
  endAngle: number,
  frameCount: number,
  symbolCount: number,
  completedCaptures: number
): void {
  for (let frame = 0; frame < frameCount; frame++) {
    const progress = frameCount <= 1 ? 1 : frame / (frameCount - 1)
    const angle = startAngle + (endAngle - startAngle) * easeInOut(progress)
    timeline.push({
      frameIndex: timeline.length,
      pointerAngleDegrees: angle,
      pointedSymbolIndex: temporalPointerAngleToSymbolIndex(angle, symbolCount),
      kind: 'rotation',
      captureIndex: null,
      completedCaptures
    })
  }
}

function appendHold(
  timeline: TemporalPointerFrameCue[],
  angle: number,
  pointedSymbolIndex: number,
  frameCount: number,
  kind: 'near-miss' | 'capture',
  captureIndex: number | null,
  completedCaptures: number
): void {
  for (let frame = 0; frame < frameCount; frame++) {
    timeline.push({
      frameIndex: timeline.length,
      pointerAngleDegrees: angle,
      pointedSymbolIndex,
      kind,
      captureIndex,
      completedCaptures
    })
  }
}

function selectDecoyBeforeCaptures(random: SeededRandom, captureCount: number, decoyCount: number): Set<number> {
  const candidates = Array.from({ length: Math.max(0, captureCount - 1) }, (_unused, index) => index + 1)
  const selected = new Set<number>()

  for (const captureIndex of shuffle(candidates, random)) {
    if (selected.size >= decoyCount) break
    selected.add(captureIndex)
  }

  return selected
}

function selectNearMissIndex(
  random: SeededRandom,
  wheelSymbols: readonly string[],
  nextTargetSymbol: string
): number {
  const candidates = wheelSymbols
    .map((symbol, index) => ({ symbol, index }))
    .filter((candidate) => candidate.symbol !== nextTargetSymbol)
  return (random.pick(candidates).index)
}

function randomTravelFrames(random: SeededRandom): number {
  return TEMPORAL_TRAVEL_FRAMES_MIN + random.nextInt(TEMPORAL_TRAVEL_FRAMES_MAX - TEMPORAL_TRAVEL_FRAMES_MIN + 1)
}

function nextClockwiseAngle(currentAngle: number, targetBaseAngle: number): number {
  return currentAngle + normalizeDegrees(targetBaseAngle - currentAngle)
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}

function uniqueSymbols(value: string): string[] {
  const seen = new Set<string>()
  const symbols: string[] = []

  for (const symbol of value) {
    if (!seen.has(symbol)) {
      seen.add(symbol)
      symbols.push(symbol)
    }
  }

  return symbols
}

function shuffle<T>(items: readonly T[], random: SeededRandom): T[] {
  const output = [...items]

  for (let index = output.length - 1; index > 0; index--) {
    const swapIndex = random.nextInt(index + 1)
    const current = output[index] as T
    output[index] = output[swapIndex] as T
    output[swapIndex] = current
  }

  return output
}

function easeInOut(value: number): number {
  return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2
}

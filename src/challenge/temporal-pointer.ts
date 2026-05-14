import { SeededRandom } from './random'
import {
  temporalPointerGridCharacterTargets,
  temporalPointerGridClosestCharacterTargetIndex,
  temporalPointerGridTargetAngleDegreesByIndex
} from './temporal-grid-layout'
import {
  CHALLENGE_CHARSET,
  CODE_LENGTH_MAX,
  CODE_LENGTH_MIN,
  LOWERCASE_CONFUSABLE_CHARS,
  NOISE_LEVEL,
  TEMPORAL_GRID_CELL_CODE_LENGTH_MAX,
  TEMPORAL_GRID_CELL_CODE_LENGTH_MIN,
  TEMPORAL_POINTER_CHALLENGE_VERSION,
  TEMPORAL_POINTER_GRID_SLOTS,
  TEMPORAL_POINTER_GRID_LAYOUT,
  TEMPORAL_POINTER_KIND,
  type TemporalPointerDisplayModel,
  type TemporalPointerDirection,
  type TemporalPointerGridSlot,
  type TemporalPointerFrameCue
} from './types'

export const TEMPORAL_DIRECTION_COUNT = TEMPORAL_POINTER_GRID_SLOTS.length
export const TEMPORAL_RING_SIZE = TEMPORAL_POINTER_GRID_SLOTS.reduce(
  (total, slot) => total + (slot.length === 1 ? TEMPORAL_GRID_CELL_CODE_LENGTH_MAX : TEMPORAL_GRID_CELL_CODE_LENGTH_MIN),
  0
)
export const TEMPORAL_CAPTURE_HOLD_FRAMES = 5
export const TEMPORAL_NEAR_MISS_HOLD_FRAMES = 3
export const TEMPORAL_TRAVEL_FRAMES_MIN = 12
export const TEMPORAL_TRAVEL_FRAMES_MAX = 16
export const TEMPORAL_INTRO_FRAMES = 6
export const TEMPORAL_OUTRO_FRAMES = 6
export const TEMPORAL_FRAME_DELAY_MS = 90

const CONTINUOUS_ROTATION_START_FRAME = 2

export interface CreateTemporalPointerDisplayOptions {
  seed: string
}

export function createTemporalPointerDisplay(
  options: CreateTemporalPointerDisplayOptions
): TemporalPointerDisplayModel {
  const random = new SeededRandom(`${options.seed}:temporal-pointer`)

  const wheelSymbols = generateDirectionCodes(random)
  const characterTargets = temporalPointerGridCharacterTargets(wheelSymbols)
  const captureIndexes = generateCaptureIndexes(random, characterTargets)
  const captureTargets = captureIndexes.map((index) => characterTargets[index]!)
  const answer = captureTargets.map((target) => target.character).join('')
  const captureSlots = captureTargets.map((target) => target.slot)

  const decoyPauseCount = 0
  const timeline = buildPointerTimeline({
    seed: options.seed,
    targets: characterTargets,
    captureIndexes,
    decoyPauseCount
  })

  return {
    version: TEMPORAL_POINTER_CHALLENGE_VERSION,
    kind: TEMPORAL_POINTER_KIND,
    seed: options.seed,
    answer,
    wheelSymbols,
    characterTargets,
    captureTargets,
    captureSlots,
    captureDirections: captureSlots,
    timeline,
    params: {
      kind: TEMPORAL_POINTER_KIND,
      layout: TEMPORAL_POINTER_GRID_LAYOUT,
      codeLength: answer.length,
      cellCodeLengths: wheelSymbols.map((symbol) => symbol.length),
      ringSize: TEMPORAL_RING_SIZE,
      captureCount: captureIndexes.length,
      decoyPauseCount,
      frameDelayMs: TEMPORAL_FRAME_DELAY_MS,
      charset: CHALLENGE_CHARSET,
      noiseLevel: NOISE_LEVEL
    }
  }
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
  const target = display.characterTargets[cue.pointedSymbolIndex]
  return [
    target ? `${target.slot}:${target.characterIndex}` : '',
    '.'.repeat(cue.completedCaptures)
  ]
}

export function temporalPointerSymbolAngleDegrees(index: number, symbolCount: number): number {
  if (symbolCount === TEMPORAL_RING_SIZE) {
    return temporalPointerGridTargetAngleDegreesByIndex(index)
  }

  return -90 + (index * 360) / symbolCount
}

export function temporalPointerAngleToSymbolIndex(angleDegrees: number, symbolCount: number): number {
  if (symbolCount === TEMPORAL_RING_SIZE) {
    return temporalPointerGridClosestCharacterTargetIndex(
      angleDegrees,
      temporalPointerGridCharacterTargets(
        TEMPORAL_POINTER_GRID_SLOTS.map((slot) =>
          'X'.repeat(slot.length === 1 ? TEMPORAL_GRID_CELL_CODE_LENGTH_MAX : TEMPORAL_GRID_CELL_CODE_LENGTH_MIN)
        )
      )
    )
  }

  const step = 360 / symbolCount
  const normalized = normalizeDegrees(angleDegrees - temporalPointerSymbolAngleDegrees(0, symbolCount))
  return Math.round(normalized / step) % symbolCount
}

function generateCaptureIndexes(
  random: SeededRandom,
  targets: readonly ReturnType<typeof temporalPointerGridCharacterTargets>[number][]
): number[] {
  const length = CODE_LENGTH_MIN + random.nextInt(CODE_LENGTH_MAX - CODE_LENGTH_MIN + 1)
  const indexes: number[] = []

  for (let index = 0; index < length; index++) {
    let candidate = random.nextInt(targets.length)
    while (indexes.length > 0 && indexes[indexes.length - 1] === candidate) {
      candidate = random.nextInt(targets.length)
    }
    indexes.push(candidate)
  }

  ensureOffCenterCapture(indexes, targets, random)
  return indexes
}

function generateDirectionCodes(random: SeededRandom): string[] {
  const codes: string[] = []
  const usedCharacters = new Set<string>()

  for (const direction of TEMPORAL_POINTER_GRID_SLOTS) {
    const length = temporalDirectionCodeLength(direction)
    codes.push(generateDirectionCode(random, length, usedCharacters))
  }

  enforceDirectionCodeCaseVariety(codes, random)
  return codes
}

function temporalDirectionCodeLength(direction: TemporalPointerDirection): number {
  return direction.length === 1 ? TEMPORAL_GRID_CELL_CODE_LENGTH_MAX : TEMPORAL_GRID_CELL_CODE_LENGTH_MIN
}

function generateDirectionCode(random: SeededRandom, length: number, usedCharacters: Set<string>): string {
  let code = ''

  for (let index = 0; index < length; index++) {
    let symbol = CHALLENGE_CHARSET[random.nextInt(CHALLENGE_CHARSET.length)] as string
    while (usedCharacters.has(symbol.toUpperCase())) {
      symbol = CHALLENGE_CHARSET[random.nextInt(CHALLENGE_CHARSET.length)] as string
    }

    usedCharacters.add(symbol.toUpperCase())
    code += mixTemporalCase(symbol, random)
  }

  return code
}

function ensureOffCenterCapture(
  indexes: number[],
  targets: readonly ReturnType<typeof temporalPointerGridCharacterTargets>[number][],
  random: SeededRandom
): void {
  if (indexes.some((index) => isOffCenterTarget(targets[index]))) return

  const replacementCandidates = targets
    .map((target, index) => ({ target, index }))
    .filter(({ target }) => isOffCenterTarget(target))
  if (replacementCandidates.length === 0 || indexes.length === 0) return

  const replaceAtIndex = random.nextInt(indexes.length)
  let replacement = replacementCandidates[random.nextInt(replacementCandidates.length)]!
  const previous = indexes[replaceAtIndex - 1]
  const next = indexes[replaceAtIndex + 1]
  let attempts = 0

  while ((replacement.index === previous || replacement.index === next) && attempts < replacementCandidates.length * 2) {
    replacement = replacementCandidates[random.nextInt(replacementCandidates.length)]!
    attempts += 1
  }

  indexes[replaceAtIndex] = replacement.index
}

function isOffCenterTarget(
  target: ReturnType<typeof temporalPointerGridCharacterTargets>[number] | undefined
): boolean {
  if (!target) return false

  const slotLength = temporalDirectionCodeLength(target.slot)
  return target.characterIndex !== Math.floor(slotLength / 2) || slotLength % 2 === 0
}

function enforceDirectionCodeCaseVariety(codes: string[], random: SeededRandom): void {
  if (!codes.join('').match(/[a-z]/)) {
    for (let attempt = 0; attempt < codes.length * 4; attempt++) {
      const codeIndex = random.nextInt(codes.length)
      const code = codes[codeIndex] as string
      const charIndex = random.nextInt(code.length)
      const symbol = code[charIndex] as string
      if (!isCaseVariantSymbol(symbol.toUpperCase())) continue

      codes[codeIndex] = replaceAt(code, charIndex, symbol.toLowerCase())
      break
    }
  }

  if (!codes.join('').match(/[A-Z]/)) {
    const codeIndex = random.nextInt(codes.length)
    const code = codes[codeIndex] as string
    const charIndex = random.nextInt(code.length)
    codes[codeIndex] = replaceAt(code, charIndex, (code[charIndex] as string).toUpperCase())
  }
}

function mixTemporalCase(symbol: string, random: SeededRandom): string {
  return isCaseVariantSymbol(symbol) && random.nextInt(2) === 0 ? symbol.toLowerCase() : symbol
}

function isCaseVariantSymbol(symbol: string): boolean {
  return /^[A-Z]$/.test(symbol) && !LOWERCASE_CONFUSABLE_CHARS.includes(symbol)
}

function replaceAt(value: string, index: number, replacement: string): string {
  return `${value.slice(0, index)}${replacement}${value.slice(index + 1)}`
}

function buildPointerTimeline(input: {
  seed: string
  targets: readonly ReturnType<typeof temporalPointerGridCharacterTargets>[number][]
  captureIndexes: readonly number[]
  decoyPauseCount: number
}): TemporalPointerFrameCue[] {
  const random = new SeededRandom(`${input.seed}:temporal-pointer:timeline`)
  const timeline: TemporalPointerFrameCue[] = []
  let currentAngle = input.targets[0]?.angleDegrees ?? -90
  let completedCaptures = 0
  const decoyBeforeCaptures = selectDecoyBeforeCaptures(random, input.captureIndexes.length, input.decoyPauseCount)

  appendRotation(timeline, currentAngle, currentAngle + 360, TEMPORAL_INTRO_FRAMES, input.targets, completedCaptures)
  currentAngle += 360

  for (let captureIndex = 0; captureIndex < input.captureIndexes.length; captureIndex++) {
    const targetIndex = input.captureIndexes[captureIndex] as number
    if (decoyBeforeCaptures.has(captureIndex)) {
      const decoyIndex = selectNearMissIndex(random, input.targets.length, targetIndex)
      const decoyAngle = nextClockwiseAngle(currentAngle, input.targets[decoyIndex]?.angleDegrees ?? -90)
      const travelFrames = randomTravelFrames(random)
      appendRotation(timeline, currentAngle, decoyAngle, travelFrames, input.targets, completedCaptures)
      currentAngle = decoyAngle
      appendHold(timeline, currentAngle, decoyIndex, TEMPORAL_NEAR_MISS_HOLD_FRAMES, 'near-miss', null, completedCaptures)
    }

    const targetAngle = nextClockwiseAngle(
      currentAngle,
      input.targets[targetIndex]?.angleDegrees ?? -90
    )
    const travelFrames = randomTravelFrames(random)
    appendRotation(timeline, currentAngle, targetAngle, travelFrames, input.targets, completedCaptures)
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

  appendRotation(timeline, currentAngle, currentAngle + 360, TEMPORAL_OUTRO_FRAMES, input.targets, completedCaptures)
  return timeline.map((cue, frameIndex) => ({ ...cue, frameIndex }))
}

function appendRotation(
  timeline: TemporalPointerFrameCue[],
  startAngle: number,
  endAngle: number,
  frameCount: number,
  targets: readonly ReturnType<typeof temporalPointerGridCharacterTargets>[number][],
  completedCaptures: number
): void {
  const startFrame = shouldSkipDuplicateRotationStart(timeline, startAngle)
    ? Math.min(CONTINUOUS_ROTATION_START_FRAME, frameCount - 1)
    : 0

  for (let frame = startFrame; frame < frameCount; frame++) {
    const progress = frameCount <= 1 ? 1 : frame / (frameCount - 1)
    const angle = startAngle + (endAngle - startAngle) * easeInOut(progress)
    timeline.push({
      frameIndex: timeline.length,
      pointerAngleDegrees: angle,
      pointedSymbolIndex: temporalPointerGridClosestCharacterTargetIndex(angle, targets),
      kind: 'rotation',
      captureIndex: null,
      completedCaptures
    })
  }
}

function shouldSkipDuplicateRotationStart(timeline: readonly TemporalPointerFrameCue[], startAngle: number): boolean {
  const previous = timeline[timeline.length - 1]
  return previous?.kind === 'rotation' && anglesEqual(previous.pointerAngleDegrees, startAngle)
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
  directionCount: number,
  targetIndex: number
): number {
  let selected = random.nextInt(directionCount)
  while (selected === targetIndex) {
    selected = random.nextInt(directionCount)
  }
  return selected
}

function randomTravelFrames(random: SeededRandom): number {
  return TEMPORAL_TRAVEL_FRAMES_MIN + random.nextInt(TEMPORAL_TRAVEL_FRAMES_MAX - TEMPORAL_TRAVEL_FRAMES_MIN + 1)
}

function nextClockwiseAngle(currentAngle: number, targetBaseAngle: number): number {
  return currentAngle + 360 + normalizeDegrees(targetBaseAngle - currentAngle)
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}

function anglesEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.000001
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

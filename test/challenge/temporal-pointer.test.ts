import { verifyAnswer } from '../../src/challenge/answer'
import { createChallenge } from '../../src/challenge/generate'
import {
  temporalPointerGridCharacterTargets,
  temporalPointerGridTargetAngleDegrees
} from '../../src/challenge/temporal-grid-layout'
import {
  TEMPORAL_CAPTURE_HOLD_FRAMES,
  TEMPORAL_INTRO_FRAMES,
  TEMPORAL_RING_SIZE,
  temporalPointerAngleToSymbolIndex,
  temporalPointerSymbolAngleDegrees,
  visibleStringsForTemporalPointerFrame
} from '../../src/challenge/temporal-pointer'
import {
  CHALLENGE_CHARSET,
  CODE_LENGTH_MAX,
  CODE_LENGTH_MIN,
  TEMPORAL_GRID_CELL_CODE_LENGTH_MAX,
  TEMPORAL_GRID_CELL_CODE_LENGTH_MIN,
  TEMPORAL_POINTER_CHALLENGE_VERSION,
  TEMPORAL_POINTER_DIRECTIONS,
  TEMPORAL_POINTER_GRID_SLOTS,
  TEMPORAL_POINTER_GRID_LAYOUT,
  TEMPORAL_POINTER_KIND
} from '../../src/challenge/types'

describe('temporal pointer challenge', () => {
  it('generates deterministic challenge details for the same seed and salt', () => {
    const first = createChallenge({ seed: 'temporal-seed', answerSalt: 'fixed-salt' })
    const second = createChallenge({ seed: 'temporal-seed', answerSalt: 'fixed-salt' })

    expect(first).toEqual(second)
  })

  it('generates a temporal pointer display model and hashed answer payload', () => {
    const challenge = createChallenge({ seed: 'temporal-shape-seed', answerSalt: 'salt' })
    const display = challenge.display

    expect(display.version).toBe(TEMPORAL_POINTER_CHALLENGE_VERSION)
    if (display.version !== TEMPORAL_POINTER_CHALLENGE_VERSION) {
      throw new Error('expected temporal pointer display')
    }

    expect(display.kind).toBe(TEMPORAL_POINTER_KIND)
    expect(display.captureDirections.length).toBeGreaterThanOrEqual(CODE_LENGTH_MIN)
    expect(display.captureDirections.length).toBeLessThanOrEqual(CODE_LENGTH_MAX)
    expect(display.captureSlots).toEqual(display.captureDirections)
    expect(display.answer).toHaveLength(display.captureTargets.length)
    expect(display.characterTargets).toHaveLength(TEMPORAL_RING_SIZE)
    expect(display.wheelSymbols).toHaveLength(TEMPORAL_POINTER_DIRECTIONS.length)
    expect(new Set(display.wheelSymbols).size).toBe(display.wheelSymbols.length)
    expect(new Set(display.wheelSymbols.join('').toUpperCase()).size).toBe(TEMPORAL_RING_SIZE)
    expect(display.wheelSymbols.join('')).toMatch(/[a-z]/)
    expect(display.wheelSymbols.join('')).toMatch(/[A-Z]/)
    for (const code of display.wheelSymbols) {
      expect(code.length).toBeGreaterThanOrEqual(TEMPORAL_GRID_CELL_CODE_LENGTH_MIN)
      expect(code.length).toBeLessThanOrEqual(TEMPORAL_GRID_CELL_CODE_LENGTH_MAX)
    }
    expect(display.params).toEqual({
      kind: TEMPORAL_POINTER_KIND,
      layout: TEMPORAL_POINTER_GRID_LAYOUT,
      codeLength: display.answer.length,
      cellCodeLengths: display.wheelSymbols.map((symbol) => symbol.length),
      ringSize: TEMPORAL_RING_SIZE,
      captureCount: display.captureDirections.length,
      decoyPauseCount: 0,
      frameDelayMs: 90,
      charset: CHALLENGE_CHARSET,
      noiseLevel: 'medium'
    })

    expect(display.characterTargets).toEqual(temporalPointerGridCharacterTargets(display.wheelSymbols))
    expect(display.captureTargets.map((target) => target.character).join('')).toBe(display.answer)
    expect(display.captureTargets.some((target) =>
      target.angleDegrees !== temporalPointerGridTargetAngleDegrees(target.slot)
    )).toBe(true)
    for (const target of display.captureTargets) {
      expect(display.captureSlots).toContain(target.slot)
      expect(display.wheelSymbols[target.slotIndex]?.[target.characterIndex]).toBe(target.character)
    }

    expect(challenge.payload.challengeVersion).toBe(TEMPORAL_POINTER_CHALLENGE_VERSION)
    expect(challenge.payload.challengeParams).toEqual(display.params)
    expect(challenge.payload).not.toHaveProperty('answer')
    expect(verifyAnswer(display.answer, challenge.payload.answerSalt, challenge.payload.answerHash)).toBe(true)
    expect(verifyAnswer(invertAsciiCase(display.answer), challenge.payload.answerSalt, challenge.payload.answerHash)).toBe(true)
  })

  it('keeps the ordered answer out of center-frame visible strings', () => {
    for (let index = 0; index < 64; index++) {
      const challenge = createChallenge({
        seed: `temporal-grid-leak-seed-${index}`,
        answerSalt: 'salt'
      })
      const display = challenge.display
      if (display.version !== TEMPORAL_POINTER_CHALLENGE_VERSION) {
        throw new Error('expected temporal pointer display')
      }

      for (const cue of display.timeline) {
        for (const visible of visibleStringsForTemporalPointerFrame(display, cue)) {
          expect(visible).not.toContain(display.answer)
        }
      }
    }
  })

  it('keeps visually confusable wheel letters uppercase', () => {
    for (let index = 0; index < 64; index++) {
      const challenge = createChallenge({
        seed: `temporal-readable-case-seed-${index}`,
        answerSalt: 'salt'
      })
      const display = challenge.display
      if (display.version !== TEMPORAL_POINTER_CHALLENGE_VERSION) {
        throw new Error('expected temporal pointer display')
      }

      expect(display.wheelSymbols.join('')).not.toMatch(/[fthn]/)
      expect(display.answer).not.toMatch(/[fthn]/)
      expect(display.wheelSymbols.join('')).toMatch(/[a-z]/)
      expect(display.wheelSymbols.join('')).toMatch(/[A-Z]/)
    }
  })

  it('moves past the intro endpoint when the first travel rotation starts', () => {
    const challenge = createChallenge({ seed: 'temporal-timeline-seed', answerSalt: 'salt' })
    const display = challenge.display
    if (display.version !== TEMPORAL_POINTER_CHALLENGE_VERSION) {
      throw new Error('expected temporal pointer display')
    }

    const introEnd = display.timeline[TEMPORAL_INTRO_FRAMES - 1]
    const firstTravel = display.timeline[TEMPORAL_INTRO_FRAMES]

    expect(introEnd?.kind).toBe('rotation')
    expect(firstTravel?.kind).toBe('rotation')
    expect(firstTravel!.pointerAngleDegrees).toBeGreaterThan(introEnd!.pointerAngleDegrees)
    expect(firstTravel!.pointedSymbolIndex).not.toBe(introEnd!.pointedSymbolIndex)
  })

  it('uses layout-derived target angles instead of fixed compass directions', () => {
    const actualAngles = Array.from({ length: TEMPORAL_RING_SIZE }, (_unused, index) =>
      temporalPointerSymbolAngleDegrees(index, TEMPORAL_RING_SIZE)
    )
    const compassAngles = TEMPORAL_POINTER_GRID_SLOTS.map((_slot, index) => -90 + index * 45)

    expect(actualAngles).toHaveLength(TEMPORAL_RING_SIZE)
    expect(new Set(actualAngles).size).toBeGreaterThan(TEMPORAL_POINTER_GRID_SLOTS.length)
    expect(actualAngles.slice(0, compassAngles.length)).not.toEqual(compassAngles)
    for (const [index, angle] of actualAngles.entries()) {
      expect(temporalPointerAngleToSymbolIndex(angle, TEMPORAL_RING_SIZE)).toBe(index)
    }
  })

  it('requires ordered capture events across the frame timeline', () => {
    const challenge = createChallenge({ seed: 'temporal-timeline-seed', answerSalt: 'salt' })
    const display = challenge.display
    if (display.version !== TEMPORAL_POINTER_CHALLENGE_VERSION) {
      throw new Error('expected temporal pointer display')
    }

    const captureFrames = display.timeline.filter((cue) => cue.kind === 'capture')
    const nearMissFrames = display.timeline.filter((cue) => cue.kind === 'near-miss')

    expect(display.timeline.length).toBeGreaterThan(display.captureTargets.length * TEMPORAL_CAPTURE_HOLD_FRAMES)
    expect(captureFrames).toHaveLength(display.captureTargets.length * TEMPORAL_CAPTURE_HOLD_FRAMES)
    expect(display.params.decoyPauseCount).toBe(0)
    expect(nearMissFrames).toHaveLength(0)

    for (const [frameIndex, cue] of display.timeline.entries()) {
      expect(cue.frameIndex).toBe(frameIndex)
      expect(cue.pointedSymbolIndex).toBeGreaterThanOrEqual(0)
      expect(cue.pointedSymbolIndex).toBeLessThan(display.characterTargets.length)

      for (const visible of visibleStringsForTemporalPointerFrame(display, cue)) {
        expect(visible).not.toContain(display.answer)
      }
    }

    let previousCaptureAngle = temporalPointerSymbolAngleDegrees(0, display.characterTargets.length) + 360
    for (let captureIndex = 0; captureIndex < display.captureTargets.length; captureIndex++) {
      const frames = captureFrames.filter((cue) => cue.captureIndex === captureIndex)
      expect(frames).toHaveLength(TEMPORAL_CAPTURE_HOLD_FRAMES)
      expect(frames.every((cue) => cue.completedCaptures === captureIndex + 1)).toBe(true)
      const target = display.captureTargets[captureIndex]!
      expect(frames.every((cue) => cue.pointedSymbolIndex === target.targetIndex)).toBe(true)
      expect(frames[0]!.pointerAngleDegrees - previousCaptureAngle).toBeGreaterThanOrEqual(360)
      previousCaptureAngle = frames[frames.length - 1]!.pointerAngleDegrees
    }
  })
})

function invertAsciiCase(value: string): string {
  return [...value]
    .map((char) => {
      if (/^[a-z]$/.test(char)) return char.toUpperCase()
      if (/^[A-Z]$/.test(char)) return char.toLowerCase()
      return char
    })
    .join('')
}

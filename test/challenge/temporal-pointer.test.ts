import { verifyAnswer, normalizeAnswer } from '../../src/challenge/answer'
import { createChallenge } from '../../src/challenge/generate'
import {
  TEMPORAL_CAPTURE_HOLD_FRAMES,
  TEMPORAL_NEAR_MISS_HOLD_FRAMES,
  TEMPORAL_RING_SIZE,
  ringContainsAnswerInAnyRotation,
  visibleStringsForTemporalPointerFrame
} from '../../src/challenge/temporal-pointer'
import {
  CHALLENGE_CHARSET,
  CODE_LENGTH_MAX,
  CODE_LENGTH_MIN,
  TEMPORAL_POINTER_CHALLENGE_VERSION,
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
    expect(display.answer.length).toBeGreaterThanOrEqual(CODE_LENGTH_MIN)
    expect(display.answer.length).toBeLessThanOrEqual(CODE_LENGTH_MAX)
    expect(display.wheelSymbols).toHaveLength(TEMPORAL_RING_SIZE)
    expect(new Set(display.wheelSymbols).size).toBe(display.wheelSymbols.length)
    expect(display.params).toEqual({
      kind: TEMPORAL_POINTER_KIND,
      codeLength: display.answer.length,
      ringSize: TEMPORAL_RING_SIZE,
      captureCount: display.answer.length,
      decoyPauseCount: display.answer.length === CODE_LENGTH_MIN ? 1 : 2,
      frameDelayMs: 90,
      charset: CHALLENGE_CHARSET,
      noiseLevel: 'medium'
    })

    for (const symbol of display.answer) {
      expect(display.wheelSymbols).toContain(symbol)
    }

    expect(challenge.payload.challengeVersion).toBe(TEMPORAL_POINTER_CHALLENGE_VERSION)
    expect(challenge.payload.challengeParams).toEqual(display.params)
    expect(challenge.payload).not.toHaveProperty('answer')
    expect(verifyAnswer(display.answer, challenge.payload.answerSalt, challenge.payload.answerHash)).toBe(true)
  })

  it('prevents the full answer from being encoded by one static ring frame', () => {
    for (let index = 0; index < 64; index++) {
      const challenge = createChallenge({
        seed: `temporal-ring-leak-seed-${index}`,
        answerSalt: 'salt'
      })
      const display = challenge.display
      if (display.version !== TEMPORAL_POINTER_CHALLENGE_VERSION) {
        throw new Error('expected temporal pointer display')
      }

      expect(ringContainsAnswerInAnyRotation(display.wheelSymbols, normalizeAnswer(display.answer))).toBe(false)
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

    expect(display.timeline.length).toBeGreaterThan(display.answer.length * TEMPORAL_CAPTURE_HOLD_FRAMES)
    expect(captureFrames).toHaveLength(display.answer.length * TEMPORAL_CAPTURE_HOLD_FRAMES)
    expect(nearMissFrames).toHaveLength(display.params.decoyPauseCount * TEMPORAL_NEAR_MISS_HOLD_FRAMES)

    for (const [frameIndex, cue] of display.timeline.entries()) {
      expect(cue.frameIndex).toBe(frameIndex)
      expect(cue.pointedSymbolIndex).toBeGreaterThanOrEqual(0)
      expect(cue.pointedSymbolIndex).toBeLessThan(display.wheelSymbols.length)

      for (const visible of visibleStringsForTemporalPointerFrame(display, cue)) {
        expect(visible).not.toContain(display.answer)
      }
    }

    for (let captureIndex = 0; captureIndex < display.answer.length; captureIndex++) {
      const frames = captureFrames.filter((cue) => cue.captureIndex === captureIndex)
      expect(frames).toHaveLength(TEMPORAL_CAPTURE_HOLD_FRAMES)
      expect(frames.every((cue) => cue.completedCaptures === captureIndex + 1)).toBe(true)
      expect(frames.every((cue) => display.wheelSymbols[cue.pointedSymbolIndex] === display.answer[captureIndex])).toBe(
        true
      )
    }
  })
})

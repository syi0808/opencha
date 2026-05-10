import { verifyAnswer } from '../../src/challenge/answer'
import { createChallenge } from '../../src/challenge/generate'
import {
  ANIMATION_FRAMES,
  CHALLENGE_CHARSET,
  CHALLENGE_VERSION,
  CODE_COUNT,
  CODE_LENGTH_MAX,
  CODE_LENGTH_MIN,
  DECOY_COUNT,
  NOISE_LEVEL,
  TARGET_INDEX_MAX,
  TARGET_INDEX_MIN
} from '../../src/challenge/types'

describe('createChallenge', () => {
  it('generates deterministic challenge details for the same seed and salt', () => {
    const first = createChallenge({ seed: 'fixed-seed', answerSalt: 'fixed-salt' })
    const second = createChallenge({ seed: 'fixed-seed', answerSalt: 'fixed-salt' })

    expect(first).toEqual(second)
  })

  it('generates different codes for different seeds in normal cases', () => {
    const first = createChallenge({ seed: 'fixed-seed-a', answerSalt: 'salt' })
    const second = createChallenge({ seed: 'fixed-seed-b', answerSalt: 'salt' })

    expect(first.display.codes).not.toEqual(second.display.codes)
  })

  it('uses only the allowed charset, fixed visible code count, and unique variable-length codes', () => {
    const challenge = createChallenge({ seed: 'charset-seed', answerSalt: 'salt' })
    const allowed = new RegExp(`^[${CHALLENGE_CHARSET}]+$`)

    expect(challenge.display.codes).toHaveLength(CODE_COUNT)
    expect(new Set(challenge.display.codes).size).toBe(challenge.display.codes.length)
    expect(challenge.payload.challengeParams.length).toBeGreaterThanOrEqual(CODE_LENGTH_MIN)
    expect(challenge.payload.challengeParams.length).toBeLessThanOrEqual(CODE_LENGTH_MAX)

    for (const code of challenge.display.codes) {
      expect(code).toHaveLength(challenge.payload.challengeParams.length)
      expect(code).toMatch(allowed)
    }
  })

  it('keeps the visible code count fixed and varies code length by seed', () => {
    const lengths = new Set<number>()

    for (let i = 0; i < 64; i++) {
      const challenge = createChallenge({ seed: `length-seed-${i}`, answerSalt: 'salt' })
      lengths.add(challenge.payload.challengeParams.length)

      expect(challenge.display.codes).toHaveLength(CODE_COUNT)
      expect(challenge.payload.challengeParams.decoyCount).toBe(DECOY_COUNT)
      expect(challenge.payload.challengeParams.length).toBeGreaterThanOrEqual(CODE_LENGTH_MIN)
      expect(challenge.payload.challengeParams.length).toBeLessThanOrEqual(CODE_LENGTH_MAX)
    }

    expect(lengths.size).toBeGreaterThan(1)
  })

  it('sets target index, params, and answer hash payload fields', () => {
    const challenge = createChallenge({ seed: 'params-seed', answerSalt: 'salt' })

    expect(challenge.display.targetIndex).toBeGreaterThanOrEqual(TARGET_INDEX_MIN)
    expect(challenge.display.targetIndex).toBeLessThanOrEqual(TARGET_INDEX_MAX)
    expect(challenge.display.targetIndex).toBeLessThanOrEqual(challenge.display.codes.length)
    expect(challenge.display.answer).toBe(challenge.display.codes[challenge.display.targetIndex - 1])
    expect(challenge.payload).not.toHaveProperty('answer')
    expect(verifyAnswer(challenge.display.answer, challenge.payload.answerSalt, challenge.payload.answerHash)).toBe(
      true
    )
    expect(challenge.payload.challengeParams).toEqual({
      length: challenge.display.answer.length,
      decoyCount: DECOY_COUNT,
      animationFrames: ANIMATION_FRAMES,
      charset: CHALLENGE_CHARSET,
      noiseLevel: NOISE_LEVEL,
      targetIndex: challenge.display.targetIndex
    })
    expect(challenge.payload.challengeVersion).toBe(CHALLENGE_VERSION)
  })
})

import { verifyAnswer } from '../../src/challenge/answer'
import { createChallenge } from '../../src/challenge/generate'
import {
  ANIMATION_FRAMES,
  CHALLENGE_CHARSET,
  CHALLENGE_LENGTH,
  CHALLENGE_VERSION,
  CODE_COUNT_MAX,
  CODE_COUNT_MIN,
  DECOY_COUNT_MAX,
  DECOY_COUNT_MIN,
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

  it('uses only the allowed charset and unique fixed-length codes', () => {
    const challenge = createChallenge({ seed: 'charset-seed', answerSalt: 'salt' })
    const allowed = new RegExp(`^[${CHALLENGE_CHARSET}]+$`)

    expect(challenge.display.codes.length).toBeGreaterThanOrEqual(CODE_COUNT_MIN)
    expect(challenge.display.codes.length).toBeLessThanOrEqual(CODE_COUNT_MAX)
    expect(new Set(challenge.display.codes).size).toBe(challenge.display.codes.length)

    for (const code of challenge.display.codes) {
      expect(code).toHaveLength(CHALLENGE_LENGTH)
      expect(code).toMatch(allowed)
    }
  })

  it('varies the number of visible codes by seed', () => {
    const counts = new Set<number>()

    for (let i = 0; i < 64; i++) {
      const challenge = createChallenge({ seed: `count-seed-${i}`, answerSalt: 'salt' })
      counts.add(challenge.display.codes.length)

      expect(challenge.display.codes.length).toBeGreaterThanOrEqual(CODE_COUNT_MIN)
      expect(challenge.display.codes.length).toBeLessThanOrEqual(CODE_COUNT_MAX)
      expect(challenge.payload.challengeParams.decoyCount).toBe(challenge.display.codes.length - 1)
    }

    expect(counts.size).toBeGreaterThan(1)
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
      length: CHALLENGE_LENGTH,
      decoyCount: challenge.display.codes.length - 1,
      animationFrames: ANIMATION_FRAMES,
      charset: CHALLENGE_CHARSET,
      noiseLevel: NOISE_LEVEL,
      targetIndex: challenge.display.targetIndex
    })
    expect(challenge.payload.challengeParams.decoyCount).toBeGreaterThanOrEqual(DECOY_COUNT_MIN)
    expect(challenge.payload.challengeParams.decoyCount).toBeLessThanOrEqual(DECOY_COUNT_MAX)
    expect(challenge.payload.challengeVersion).toBe(CHALLENGE_VERSION)
  })
})

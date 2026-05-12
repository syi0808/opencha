import { normalizeAnswer, verifyAnswer } from '../../src/challenge/answer'
import { createChallenge, createLegacySlideChallenge } from '../../src/challenge/generate'
import {
  ANIMATION_FRAMES,
  CHALLENGE_CHARSET,
  CODE_COUNT_DEFAULT,
  CODE_COUNT_MAX,
  CODE_COUNT_MIN,
  CODE_LENGTH_MAX,
  CODE_LENGTH_MIN,
  LEGACY_SLIDE_CHALLENGE_VERSION,
  type LegacySlideChallengeParams,
  NOISE_LEVEL,
  TEMPORAL_POINTER_CHALLENGE_VERSION,
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

    expect(first.display.answer).not.toEqual(second.display.answer)
    expect(first.payload.challengeVersion).toBe(TEMPORAL_POINTER_CHALLENGE_VERSION)
  })

  it('keeps legacy slide generation available with mixed-case codes and unique per-code lengths', () => {
    const challenge = createLegacySlideChallenge({ seed: 'charset-seed', answerSalt: 'salt' })
    const allowed = new RegExp(`^[${CHALLENGE_CHARSET}${CHALLENGE_CHARSET.toLowerCase()}]+$`)

    expect(challenge.display.version).toBe(LEGACY_SLIDE_CHALLENGE_VERSION)
    if (challenge.display.version !== LEGACY_SLIDE_CHALLENGE_VERSION) {
      throw new Error('expected legacy slide display')
    }

    expect(challenge.display.codes).toHaveLength(CODE_COUNT_DEFAULT)
    expect(new Set(challenge.display.codes).size).toBe(challenge.display.codes.length)
    expect(new Set(challenge.display.codes.map(normalizeAnswer)).size).toBe(challenge.display.codes.length)
    expect(legacyParams(challenge).codeCount).toBe(CODE_COUNT_DEFAULT)
    expect(legacyParams(challenge).codeLengths).toEqual(challenge.display.codes.map((code) => code.length))

    for (const code of challenge.display.codes) {
      expect(code.length).toBeGreaterThanOrEqual(CODE_LENGTH_MIN)
      expect(code.length).toBeLessThanOrEqual(CODE_LENGTH_MAX)
      expect(code).toMatch(allowed)
      expect(code).toMatch(/[A-Z]/)
      expect(code).toMatch(/[a-z]/)
      expect(code).not.toMatch(/[fthn]/)
    }
  })

  it('accepts configurable visible code count', () => {
    const challenge = createLegacySlideChallenge({ seed: 'count-seed', answerSalt: 'salt', codeCount: CODE_COUNT_MAX })
    if (challenge.display.version !== LEGACY_SLIDE_CHALLENGE_VERSION) {
      throw new Error('expected legacy slide display')
    }

    expect(challenge.display.codes).toHaveLength(CODE_COUNT_MAX)
    expect(legacyParams(challenge).codeCount).toBe(CODE_COUNT_MAX)
    expect(legacyParams(challenge).decoyCount).toBe(CODE_COUNT_MAX - 1)
  })

  it('varies code length independently within challenges', () => {
    let sawMixedLengths = false

    for (let i = 0; i < 64; i++) {
      const challenge = createLegacySlideChallenge({
        seed: `length-seed-${i}`,
        answerSalt: 'salt',
        codeCount: CODE_COUNT_MAX
      })
      if (challenge.display.version !== LEGACY_SLIDE_CHALLENGE_VERSION) {
        throw new Error('expected legacy slide display')
      }
      const lengths = challenge.display.codes.map((code) => code.length)

      expect(challenge.display.codes).toHaveLength(CODE_COUNT_MAX)
      expect(legacyParams(challenge).codeLengths).toEqual(lengths)
      expect(legacyParams(challenge).decoyCount).toBe(CODE_COUNT_MAX - 1)

      for (const length of lengths) {
        expect(length).toBeGreaterThanOrEqual(CODE_LENGTH_MIN)
        expect(length).toBeLessThanOrEqual(CODE_LENGTH_MAX)
      }

      if (new Set(lengths).size > 1) {
        sawMixedLengths = true
      }
    }

    expect(sawMixedLengths).toBe(true)
  })

  it('sets target index, params, and answer hash payload fields', () => {
    const challenge = createLegacySlideChallenge({ seed: 'params-seed', answerSalt: 'salt', codeCount: CODE_COUNT_MIN })
    if (challenge.display.version !== LEGACY_SLIDE_CHALLENGE_VERSION) {
      throw new Error('expected legacy slide display')
    }

    expect(challenge.display.targetIndex).toBeGreaterThanOrEqual(TARGET_INDEX_MIN)
    expect(challenge.display.targetIndex).toBeLessThanOrEqual(TARGET_INDEX_MAX)
    expect(challenge.display.targetIndex).toBeLessThanOrEqual(challenge.display.codes.length)
    expect(challenge.display.answer).toBe(challenge.display.codes[challenge.display.targetIndex - 1])
    expect(challenge.payload).not.toHaveProperty('answer')
    expect(verifyAnswer(challenge.display.answer, challenge.payload.answerSalt, challenge.payload.answerHash)).toBe(
      true
    )
    expect(challenge.payload.challengeParams).toEqual({
      codeCount: CODE_COUNT_MIN,
      codeLengths: challenge.display.codes.map((code) => code.length),
      decoyCount: CODE_COUNT_MIN - 1,
      animationFrames: ANIMATION_FRAMES,
      charset: CHALLENGE_CHARSET,
      noiseLevel: NOISE_LEVEL,
      targetIndex: challenge.display.targetIndex
    })
    expect(challenge.payload.challengeVersion).toBe(LEGACY_SLIDE_CHALLENGE_VERSION)
  })
})

function legacyParams(challenge: ReturnType<typeof createLegacySlideChallenge>): LegacySlideChallengeParams {
  if (challenge.payload.challengeVersion !== LEGACY_SLIDE_CHALLENGE_VERSION) {
    throw new Error('expected legacy slide payload')
  }
  if ('kind' in challenge.payload.challengeParams) {
    throw new Error('expected legacy slide params')
  }
  return challenge.payload.challengeParams
}

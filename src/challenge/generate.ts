import { randomBytes } from 'node:crypto'
import { hashAnswer } from './answer'
import { SeededRandom } from './random'
import {
  ANIMATION_FRAMES,
  CHALLENGE_CHARSET,
  CHALLENGE_LENGTH,
  CHALLENGE_VERSION,
  DECOY_COUNT,
  type ChallengeParams,
  type CreateChallengeOptions,
  type GeneratedChallenge,
  NOISE_LEVEL,
  TARGET_INDEX_MAX,
  TARGET_INDEX_MIN
} from './types'

export function createChallenge(options: CreateChallengeOptions = {}): GeneratedChallenge {
  const seed = options.seed ?? randomBytes(16).toString('base64url')
  const answerSalt = options.answerSalt ?? randomBytes(16).toString('base64url')
  const random = new SeededRandom(seed)
  const codes = generateUniqueCodes(random)
  const targetIndex =
    TARGET_INDEX_MIN + random.nextInt(TARGET_INDEX_MAX - TARGET_INDEX_MIN + 1)
  const answer = codes[targetIndex - 1] as string
  const params: ChallengeParams = {
    length: CHALLENGE_LENGTH,
    decoyCount: DECOY_COUNT,
    animationFrames: ANIMATION_FRAMES,
    charset: CHALLENGE_CHARSET,
    noiseLevel: NOISE_LEVEL,
    targetIndex
  }

  return {
    display: {
      version: CHALLENGE_VERSION,
      seed,
      codes,
      targetIndex,
      answer,
      params
    },
    payload: {
      challengeVersion: CHALLENGE_VERSION,
      seed,
      challengeParams: params,
      answerSalt,
      answerHash: hashAnswer(answer, answerSalt)
    }
  }
}

function generateUniqueCodes(random: SeededRandom): string[] {
  const codes = new Set<string>()
  const count = DECOY_COUNT + 1

  while (codes.size < count) {
    codes.add(generateCode(random))
  }

  return [...codes]
}

function generateCode(random: SeededRandom): string {
  let code = ''

  for (let i = 0; i < CHALLENGE_LENGTH; i++) {
    code += CHALLENGE_CHARSET[random.nextInt(CHALLENGE_CHARSET.length)]
  }

  return code
}

import { randomBytes } from 'node:crypto'
import { hashAnswer } from './answer'
import { SeededRandom } from './random'
import {
  ANIMATION_FRAMES,
  CHALLENGE_CHARSET,
  CHALLENGE_VERSION,
  CODE_COUNT,
  CODE_LENGTH_MAX,
  CODE_LENGTH_MIN,
  DECOY_COUNT,
  type ChallengeParams,
  type CreateChallengeOptions,
  type GeneratedChallenge,
  NOISE_LEVEL,
  TARGET_INDEX_MIN
} from './types'

export function createChallenge(options: CreateChallengeOptions = {}): GeneratedChallenge {
  const seed = options.seed ?? randomBytes(16).toString('base64url')
  const answerSalt = options.answerSalt ?? randomBytes(16).toString('base64url')
  const random = new SeededRandom(seed)
  const codeLength = CODE_LENGTH_MIN + random.nextInt(CODE_LENGTH_MAX - CODE_LENGTH_MIN + 1)
  const codeCount = CODE_COUNT
  const codes = generateUniqueCodes(random, codeCount, codeLength)
  const targetIndex = TARGET_INDEX_MIN + random.nextInt(codeCount - TARGET_INDEX_MIN + 1)
  const answer = codes[targetIndex - 1] as string
  const params: ChallengeParams = {
    length: codeLength,
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

function generateUniqueCodes(random: SeededRandom, count: number, length: number): string[] {
  const codes = new Set<string>()

  while (codes.size < count) {
    codes.add(generateCode(random, length))
  }

  return [...codes]
}

function generateCode(random: SeededRandom, length: number): string {
  let code = ''

  for (let i = 0; i < length; i++) {
    code += CHALLENGE_CHARSET[random.nextInt(CHALLENGE_CHARSET.length)]
  }

  return code
}

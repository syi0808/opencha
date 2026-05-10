import { randomBytes } from 'node:crypto'
import { hashAnswer, normalizeAnswer } from './answer'
import { SeededRandom } from './random'
import {
  ANIMATION_FRAMES,
  CHALLENGE_CHARSET,
  CHALLENGE_VERSION,
  CODE_COUNT_DEFAULT,
  CODE_LENGTH_MAX,
  CODE_LENGTH_MIN,
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
  const codeCount = options.codeCount ?? CODE_COUNT_DEFAULT
  const codes = generateUniqueCodes(random, codeCount)
  const targetIndex = TARGET_INDEX_MIN + random.nextInt(codeCount - TARGET_INDEX_MIN + 1)
  const answer = codes[targetIndex - 1] as string
  const params: ChallengeParams = {
    codeCount,
    codeLengths: codes.map((code) => code.length),
    decoyCount: codeCount - 1,
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

function generateUniqueCodes(random: SeededRandom, count: number): string[] {
  const codes = new Map<string, string>()

  while (codes.size < count) {
    const length = CODE_LENGTH_MIN + random.nextInt(CODE_LENGTH_MAX - CODE_LENGTH_MIN + 1)
    const code = generateCode(random, length)
    codes.set(normalizeAnswer(code), code)
  }

  return [...codes.values()]
}

function generateCode(random: SeededRandom, length: number): string {
  const chars: string[] = []

  for (let i = 0; i < length; i++) {
    chars.push(mixCase(CHALLENGE_CHARSET[random.nextInt(CHALLENGE_CHARSET.length)] as string, random))
  }

  enforceMixedLetterCase(chars, random)
  return chars.join('')
}

function mixCase(symbol: string, random: SeededRandom): string {
  if (!isUppercaseAsciiLetter(symbol)) return symbol
  return random.nextInt(2) === 0 ? symbol.toLowerCase() : symbol
}

function enforceMixedLetterCase(chars: string[], random: SeededRandom): void {
  while (letterIndexes(chars).length < 2) {
    chars[random.nextInt(chars.length)] = randomLetter(random)
  }

  const letters = letterIndexes(chars)
  if (!chars.some(isUppercaseAsciiLetter)) {
    const index = letters[0] as number
    chars[index] = chars[index]!.toUpperCase()
  }

  if (!chars.some(isLowercaseAsciiLetter)) {
    const index = (letters.find((letterIndex) => letterIndex !== letters[0]) ?? letters[0]) as number
    chars[index] = chars[index]!.toLowerCase()
  }
}

function letterIndexes(chars: readonly string[]): number[] {
  const indexes: number[] = []

  for (let index = 0; index < chars.length; index++) {
    if (isAsciiLetter(chars[index] as string)) indexes.push(index)
  }

  return indexes
}

function randomLetter(random: SeededRandom): string {
  let symbol = CHALLENGE_CHARSET[random.nextInt(CHALLENGE_CHARSET.length)] as string

  while (!isUppercaseAsciiLetter(symbol)) {
    symbol = CHALLENGE_CHARSET[random.nextInt(CHALLENGE_CHARSET.length)] as string
  }

  return mixCase(symbol, random)
}

function isAsciiLetter(symbol: string): boolean {
  return isUppercaseAsciiLetter(symbol) || isLowercaseAsciiLetter(symbol)
}

function isUppercaseAsciiLetter(symbol: string): boolean {
  return symbol >= 'A' && symbol <= 'Z'
}

function isLowercaseAsciiLetter(symbol: string): boolean {
  return symbol >= 'a' && symbol <= 'z'
}

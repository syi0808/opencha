import { randomBytes } from 'node:crypto'
import { hashAnswer, normalizeAnswer } from './answer'
import { SeededRandom } from './random'
import { createTemporalPointerDisplay } from './temporal-pointer'
import {
  ANIMATION_FRAMES,
  CHALLENGE_CHARSET,
  CODE_COUNT_DEFAULT,
  CODE_LENGTH_MAX,
  CODE_LENGTH_MIN,
  type ChallengeParams,
  type CreateChallengeOptions,
  type GeneratedChallenge,
  LOWERCASE_CONFUSABLE_CHARS,
  NOISE_LEVEL,
  TARGET_INDEX_MIN
} from './types'

export function createChallenge(options: CreateChallengeOptions = {}): GeneratedChallenge {
  const seed = options.seed ?? randomBytes(16).toString('base64url')
  const answerSalt = options.answerSalt ?? randomBytes(16).toString('base64url')
  const display = createTemporalPointerDisplay({ seed })

  return {
    display,
    payload: {
      challengeVersion: display.version,
      seed,
      challengeParams: display.params,
      answerSalt,
      answerHash: hashAnswer(display.answer, answerSalt)
    }
  }
}

export function createLegacySlideChallenge(options: CreateChallengeOptions = {}): GeneratedChallenge {
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
      version: 1,
      seed,
      codes,
      targetIndex,
      answer,
      params
    },
    payload: {
      challengeVersion: 1,
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
  if (!canUseLowercaseVariant(symbol)) return symbol
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

  if (!chars.some(isReadableLowercaseVariant)) {
    const index = (letters.find((letterIndex) => canUseLowercaseVariant(chars[letterIndex] as string)) ?? letters[0]) as number
    chars[index] = randomReadableLowercaseLetter(random)
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

function randomReadableLowercaseLetter(random: SeededRandom): string {
  let symbol = CHALLENGE_CHARSET[random.nextInt(CHALLENGE_CHARSET.length)] as string

  while (!canUseLowercaseVariant(symbol)) {
    symbol = CHALLENGE_CHARSET[random.nextInt(CHALLENGE_CHARSET.length)] as string
  }

  return symbol.toLowerCase()
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

function isReadableLowercaseVariant(symbol: string): boolean {
  return isLowercaseAsciiLetter(symbol) && canUseLowercaseVariant(symbol.toUpperCase())
}

function canUseLowercaseVariant(symbol: string): boolean {
  return isUppercaseAsciiLetter(symbol) && !LOWERCASE_CONFUSABLE_CHARS.includes(symbol)
}

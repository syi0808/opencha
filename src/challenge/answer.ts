import { createHash, timingSafeEqual } from 'node:crypto'

export function normalizeAnswer(input: string): string {
  return input.trim().replace(/\s+/g, '').toUpperCase()
}

export function hashNormalizedAnswer(normalizedAnswer: string, answerSalt: string): string {
  return createHash('sha256')
    .update(`${answerSalt}:${normalizedAnswer}`)
    .digest('base64url')
}

export function hashAnswer(answer: string, answerSalt: string): string {
  return hashNormalizedAnswer(normalizeAnswer(answer), answerSalt)
}

export function verifyAnswer(input: string, answerSalt: string, expectedHash: string): boolean {
  const actualHash = hashAnswer(input, answerSalt)
  const actual = Buffer.from(actualHash)
  const expected = Buffer.from(expectedHash)

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

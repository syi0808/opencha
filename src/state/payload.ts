import { z } from 'zod'
import { ConfigError } from '../errors'

export const PAYLOAD_SCHEMA_VERSION = 1
export const PAYLOAD_PURPOSE = 'challenge-payload'

const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Expected ISO timestamp'
})

export const challengePayloadSchema = z.object({
  schema: z.literal(1),
  challengeId: z.string().min(1),
  challengeVersion: z.literal(1),
  seed: z.string().min(1),
  challengeParams: z.object({
    length: z.literal(5),
    decoyCount: z.literal(4),
    animationFrames: z.literal(8),
    charset: z.string().min(1),
    noiseLevel: z.literal('medium'),
    targetIndex: z.number().int().min(2).max(5)
  }),
  answerSalt: z.string().min(1),
  answerHash: z.string().min(1),
  attempts: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
  cooldownSeconds: z.number().int().min(0),
  cooldownUntil: isoDate.nullable(),
  issuedAt: isoDate,
  passed: z.boolean(),
  passedAt: isoDate.nullable(),
  passedBy: z.string().nullable(),
  passMethod: z.union([z.literal('answer'), z.literal('approve')]).nullable(),
  draftedByOpencha: z.boolean(),
  asset: z.object({
    url: z.string().url(),
    assetRef: z.string().min(1)
  }).nullable(),
  exceeded: z.boolean()
})

export type ChallengePayload = z.infer<typeof challengePayloadSchema>

export function parseChallengePayload(value: unknown): ChallengePayload {
  const parsed = challengePayloadSchema.safeParse(value)
  if (!parsed.success) {
    throw new ConfigError(`Invalid OpenCHA payload: ${z.prettifyError(parsed.error)}`)
  }
  return parsed.data
}

export function markPayloadPassed(
  payload: ChallengePayload,
  input: { passedBy: string; passMethod: 'answer' | 'approve'; now: Date }
): ChallengePayload {
  return {
    ...payload,
    passed: true,
    passedAt: input.now.toISOString(),
    passedBy: input.passedBy,
    passMethod: input.passMethod,
    cooldownUntil: null,
    exceeded: false
  }
}

export function attemptsRemaining(payload: ChallengePayload): number {
  return Math.max(0, payload.maxAttempts - payload.attempts)
}

export function isCooldownActive(payload: ChallengePayload, now: Date): boolean {
  return payload.cooldownUntil !== null && Date.parse(payload.cooldownUntil) > now.getTime()
}

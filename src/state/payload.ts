import { z } from 'zod'
import {
  CODE_COUNT_MAX,
  CODE_COUNT_MIN,
  CODE_LENGTH_MAX,
  CODE_LENGTH_MIN,
  TARGET_INDEX_MIN
} from '../challenge/types'
import { ConfigError } from '../errors'

export const PAYLOAD_SCHEMA_VERSION = 1
export const PAYLOAD_PURPOSE = 'challenge-payload'

const LEGACY_RANDOM_CODE_COUNT_DECOY_MIN = 2
const LEGACY_RANDOM_CODE_COUNT_DECOY_MAX = 6
const LEGACY_RANDOM_CODE_COUNT_TARGET_MAX = 7
const legacyOrCurrentCodeCountMax = Math.max(CODE_COUNT_MAX, LEGACY_RANDOM_CODE_COUNT_TARGET_MAX)

const isoDate = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Expected ISO timestamp'
})

export const challengePayloadSchema = z.object({
  schema: z.literal(1),
  challengeId: z.string().min(1),
  challengeVersion: z.literal(1),
  seed: z.string().min(1),
  challengeParams: z.object({
    length: z.number().int().min(CODE_LENGTH_MIN).max(CODE_LENGTH_MAX).optional(),
    codeCount: z.number().int().min(CODE_COUNT_MIN).max(CODE_COUNT_MAX).optional(),
    codeLengths: z
      .array(z.number().int().min(CODE_LENGTH_MIN).max(CODE_LENGTH_MAX))
      .min(CODE_COUNT_MIN)
      .max(CODE_COUNT_MAX)
      .optional(),
    decoyCount: z
      .number()
      .int()
      .min(LEGACY_RANDOM_CODE_COUNT_DECOY_MIN)
      .max(LEGACY_RANDOM_CODE_COUNT_DECOY_MAX),
    animationFrames: z.number().int().min(8).max(32),
    charset: z.string().min(1),
    noiseLevel: z.literal('medium'),
    targetIndex: z.number().int().min(TARGET_INDEX_MIN).max(legacyOrCurrentCodeCountMax)
  }).superRefine((params, context) => {
    if (params.length === undefined && params.codeLengths === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'Expected either legacy length or per-code lengths'
      })
    }

    if (params.codeCount !== undefined && params.decoyCount !== params.codeCount - 1) {
      context.addIssue({
        code: 'custom',
        message: 'Expected decoyCount to match codeCount - 1'
      })
    }

    if (
      params.codeCount !== undefined &&
      params.codeLengths !== undefined &&
      params.codeLengths.length !== params.codeCount
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Expected codeLengths length to match codeCount'
      })
    }

    if (params.codeCount !== undefined && params.targetIndex > params.codeCount) {
      context.addIssue({
        code: 'custom',
        message: 'Expected targetIndex to be within codeCount'
      })
    }
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

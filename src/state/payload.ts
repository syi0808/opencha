import { z } from 'zod'
import {
  CODE_COUNT_MAX,
  CODE_COUNT_MIN,
  CODE_LENGTH_MAX,
  CODE_LENGTH_MIN,
  CHALLENGE_CHARSET,
  LEGACY_SLIDE_CHALLENGE_VERSION,
  TEMPORAL_GRID_CELL_CODE_LENGTH_MAX,
  TEMPORAL_GRID_CELL_CODE_LENGTH_MIN,
  TEMPORAL_POINTER_CHALLENGE_VERSION,
  TEMPORAL_POINTER_GRID_LAYOUT,
  TEMPORAL_POINTER_GRID_SLOTS,
  TEMPORAL_POINTER_KIND,
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

const legacySlideParamsSchema = z.object({
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
})

const temporalPointerParamsSchema = z.object({
  kind: z.literal(TEMPORAL_POINTER_KIND),
  layout: z.literal(TEMPORAL_POINTER_GRID_LAYOUT).optional(),
  codeLength: z.number().int().min(CODE_LENGTH_MIN).max(CODE_LENGTH_MAX * TEMPORAL_GRID_CELL_CODE_LENGTH_MAX),
  cellCodeLengths: z
    .array(z.number().int().min(TEMPORAL_GRID_CELL_CODE_LENGTH_MIN).max(TEMPORAL_GRID_CELL_CODE_LENGTH_MAX))
    .length(TEMPORAL_POINTER_GRID_SLOTS.length)
    .optional(),
  ringSize: z.number().int().min(TEMPORAL_POINTER_GRID_SLOTS.length).max(24),
  captureCount: z.number().int().min(CODE_LENGTH_MIN).max(CODE_LENGTH_MAX),
  decoyPauseCount: z.number().int().min(0).max(3),
  frameDelayMs: z.number().int().min(60).max(140),
  charset: z.literal(CHALLENGE_CHARSET),
  noiseLevel: z.literal('medium')
}).superRefine((params, context) => {
  if (params.layout === TEMPORAL_POINTER_GRID_LAYOUT && params.cellCodeLengths === undefined) {
    context.addIssue({
      code: 'custom',
      message: 'Expected direction-grid cellCodeLengths'
    })
  }

  if (
    params.layout === TEMPORAL_POINTER_GRID_LAYOUT &&
    params.codeLength !== params.captureCount &&
    (params.codeLength < params.captureCount * TEMPORAL_GRID_CELL_CODE_LENGTH_MIN ||
      params.codeLength > params.captureCount * TEMPORAL_GRID_CELL_CODE_LENGTH_MAX)
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Expected direction-grid codeLength to match captured character count or legacy cell code length range'
    })
  }

  if (params.layout !== TEMPORAL_POINTER_GRID_LAYOUT && params.captureCount !== params.codeLength) {
    context.addIssue({
      code: 'custom',
      message: 'Expected captureCount to match codeLength'
    })
  }

  if (params.layout !== TEMPORAL_POINTER_GRID_LAYOUT && params.ringSize <= params.codeLength) {
    context.addIssue({
      code: 'custom',
      message: 'Expected ringSize to exceed codeLength'
    })
  }

  const gridTargetCount = params.cellCodeLengths?.reduce((total, length) => total + length, 0)
  if (
    params.layout === TEMPORAL_POINTER_GRID_LAYOUT &&
    params.ringSize !== TEMPORAL_POINTER_GRID_SLOTS.length &&
    params.ringSize !== gridTargetCount
  ) {
    context.addIssue({
      code: 'custom',
      message: 'Expected direction-grid ringSize to match cell count or character target count'
    })
  }
})

const temporalPointerGridAssetLayoutSchema = z.object({
  kind: z.literal(TEMPORAL_POINTER_GRID_LAYOUT),
  center: z.string().url(),
  cells: z.array(z.object({
    direction: z.enum(TEMPORAL_POINTER_GRID_SLOTS),
    url: z.string().url()
  })).length(TEMPORAL_POINTER_GRID_SLOTS.length)
})

export const challengePayloadSchema = z.object({
  schema: z.literal(1),
  challengeId: z.string().min(1),
  challengeVersion: z.union([
    z.literal(LEGACY_SLIDE_CHALLENGE_VERSION),
    z.literal(TEMPORAL_POINTER_CHALLENGE_VERSION)
  ]),
  seed: z.string().min(1),
  challengeParams: z.union([legacySlideParamsSchema, temporalPointerParamsSchema]),
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
    assetRef: z.string().min(1),
    layout: temporalPointerGridAssetLayoutSchema.optional()
  }).nullable(),
  exceeded: z.boolean()
}).superRefine((payload, context) => {
  const isTemporalParams =
    'kind' in payload.challengeParams && payload.challengeParams.kind === TEMPORAL_POINTER_KIND

  if (payload.challengeVersion === LEGACY_SLIDE_CHALLENGE_VERSION && isTemporalParams) {
    context.addIssue({
      code: 'custom',
      path: ['challengeParams'],
      message: 'Expected legacy slide params for challengeVersion 1'
    })
  }

  if (payload.challengeVersion === TEMPORAL_POINTER_CHALLENGE_VERSION && !isTemporalParams) {
    context.addIssue({
      code: 'custom',
      path: ['challengeParams'],
      message: 'Expected temporal pointer params for challengeVersion 2'
    })
  }
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

import { z } from 'zod'
import { ConfigError } from '../errors'
import { DEFAULT_CONFIG, DEFAULT_TRUSTED_BOTS, type OpenchaConfig } from './defaults'

const safeBranchName = /^[A-Za-z0-9._/-]+$/

const rawConfigSchema = z.object({
  trusted_users: z.array(z.string().min(1)).optional(),
  trusted_bots: z.array(z.string().min(1)).optional(),
  labels: z.object({
    verifying: z.string().min(1).optional(),
    needs_maintainer: z.string().min(1).optional()
  }).optional(),
  challenge: z.object({
    max_attempts: z.number().int().min(1).max(20).optional(),
    cooldown_seconds: z.number().int().min(0).max(3600).optional(),
    rotate_on_wrong_answer: z.boolean().optional()
  }).optional(),
  assets: z.object({
    branch: z.string().min(1).regex(safeBranchName).optional(),
    cleanup_passed_assets: z.boolean().optional()
  }).optional(),
  policy: z.object({
    reverify_on_push: z.boolean().optional()
  }).optional()
})

const knownKeys = new Map<string, Set<string>>([
  ['', new Set(['trusted_users', 'trusted_bots', 'labels', 'challenge', 'assets', 'policy'])],
  ['labels', new Set(['verifying', 'needs_maintainer'])],
  ['challenge', new Set(['max_attempts', 'cooldown_seconds', 'rotate_on_wrong_answer'])],
  ['assets', new Set(['branch', 'cleanup_passed_assets'])],
  ['policy', new Set(['reverify_on_push'])]
])

export interface ParsedConfig {
  config: OpenchaConfig
  warnings: string[]
}

export function parseOpenchaConfig(input: unknown): ParsedConfig {
  const warnings = collectUnknownFieldWarnings(input)
  const parsed = rawConfigSchema.safeParse(input ?? {})

  if (!parsed.success) {
    throw new ConfigError(`Invalid .github/opencha.yml: ${z.prettifyError(parsed.error)}`)
  }

  const raw = parsed.data
  const trustedBots = uniqueCaseInsensitive([
    ...DEFAULT_TRUSTED_BOTS,
    ...(raw.trusted_bots ?? [])
  ])

  return {
    warnings,
    config: {
      trustedUsers: raw.trusted_users ?? [...DEFAULT_CONFIG.trustedUsers],
      trustedBots,
      labels: {
        verifying: raw.labels?.verifying ?? DEFAULT_CONFIG.labels.verifying,
        needsMaintainer: raw.labels?.needs_maintainer ?? DEFAULT_CONFIG.labels.needsMaintainer
      },
      challenge: {
        maxAttempts: raw.challenge?.max_attempts ?? DEFAULT_CONFIG.challenge.maxAttempts,
        cooldownSeconds: raw.challenge?.cooldown_seconds ?? DEFAULT_CONFIG.challenge.cooldownSeconds,
        rotateOnWrongAnswer: raw.challenge?.rotate_on_wrong_answer ?? DEFAULT_CONFIG.challenge.rotateOnWrongAnswer
      },
      assets: {
        branch: raw.assets?.branch ?? DEFAULT_CONFIG.assets.branch,
        cleanupPassedAssets: raw.assets?.cleanup_passed_assets ?? DEFAULT_CONFIG.assets.cleanupPassedAssets
      },
      policy: {
        reverifyOnPush: raw.policy?.reverify_on_push ?? DEFAULT_CONFIG.policy.reverifyOnPush
      }
    }
  }
}

function collectUnknownFieldWarnings(value: unknown): string[] {
  if (!isRecord(value)) return []

  const warnings: string[] = []
  collectForPath(value, '', warnings)
  return warnings
}

function collectForPath(value: Record<string, unknown>, path: string, warnings: string[]): void {
  const allowed = knownKeys.get(path)
  if (!allowed) return

  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      warnings.push(`Unknown OpenCHA config field ignored: ${path ? `${path}.` : ''}${key}`)
      continue
    }

    const childPath = path ? `${path}.${key}` : key
    const child = value[key]
    if (isRecord(child)) {
      collectForPath(child, childPath, warnings)
    }
  }
}

function uniqueCaseInsensitive(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const key = value.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      result.push(value)
    }
  }

  return result
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

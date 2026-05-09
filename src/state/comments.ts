import { PayloadMarkerError } from '../errors'
import { attemptsRemaining, type ChallengePayload } from './payload'

export const CHALLENGE_MARKER = '<!-- opencha:challenge -->'
export const PAYLOAD_PREFIX = '<!-- opencha:payload '
export const PAYLOAD_SUFFIX = ' -->'

export interface ChallengeCommentInput {
  assetUrl: string
  targetIndex: number
  payload: ChallengePayload
  encryptedPayload: string
  now: Date
}

export function extractEncryptedPayload(body: string): string | null {
  if (!body.includes(CHALLENGE_MARKER)) {
    return null
  }

  const matches = [...body.matchAll(/<!--\s*opencha:payload\s+([A-Za-z0-9_-]+)\s*-->/g)]
  if (matches.length === 0) return null
  if (matches.length > 1) {
    throw new PayloadMarkerError('OpenCHA challenge comment contains multiple payload markers.')
  }

  return matches[0]?.[1] ?? null
}

export function renderChallengeComment(input: ChallengeCommentInput): string {
  const cooldownText = renderCooldown(input.payload, input.now)
  return [
    CHALLENGE_MARKER,
    '## OpenCHA verification',
    '',
    'This PR is temporarily gated because it was opened by an outside contributor.',
    '',
    `Enter the ${ordinal(input.targetIndex)} code shown in the animation:`,
    '',
    `![OpenCHA challenge](${input.assetUrl})`,
    '',
    'Reply with:',
    '',
    '```text',
    '/opencha answer YOUR_CODE',
    '```',
    '',
    `Attempts remaining: ${attemptsRemaining(input.payload)}`,
    cooldownText ? `Next attempt available in about ${cooldownText}.` : '',
    '',
    `${PAYLOAD_PREFIX}${input.encryptedPayload}${PAYLOAD_SUFFIX}`
  ].filter((line) => line !== '').join('\n')
}

export function renderExceededComment(payload: ChallengePayload, encryptedPayload: string): string {
  return [
    CHALLENGE_MARKER,
    '## OpenCHA verification',
    '',
    'Maintainer review required.',
    '',
    'The maximum number of answer attempts has been reached. A maintainer can run:',
    '',
    '```text',
    '/opencha approve',
    '/opencha reset',
    '```',
    '',
    `Attempts remaining: ${attemptsRemaining(payload)}`,
    '',
    `${PAYLOAD_PREFIX}${encryptedPayload}${PAYLOAD_SUFFIX}`
  ].join('\n')
}

export function renderPassedChallengeComment(payload: ChallengePayload, encryptedPayload: string): string {
  const actor = payload.passedBy ? ` by @${payload.passedBy}` : ''
  return [
    CHALLENGE_MARKER,
    '## OpenCHA verification',
    '',
    `OpenCHA verification passed${actor}.`,
    '',
    `${PAYLOAD_PREFIX}${encryptedPayload}${PAYLOAD_SUFFIX}`
  ].join('\n')
}

export function renderPassComment(payload: ChallengePayload): string {
  if (payload.passMethod === 'approve' && payload.passedBy) {
    return `OpenCHA verification manually approved by @${payload.passedBy}.`
  }
  return 'OpenCHA verification passed.'
}

function renderCooldown(payload: ChallengePayload, now: Date): string | null {
  if (!payload.cooldownUntil) return null
  const diff = Date.parse(payload.cooldownUntil) - now.getTime()
  if (diff <= 0) return null
  return `${Math.ceil(diff / 1000)} seconds`
}

function ordinal(value: number): string {
  const suffix = value === 1 ? 'st' : value === 2 ? 'nd' : value === 3 ? 'rd' : 'th'
  return `${value}${suffix}`
}

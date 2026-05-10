import { PayloadMarkerError } from '../errors'
import { attemptsRemaining, type ChallengePayload } from './payload'

export const CHALLENGE_MARKER = '<!-- opencha:challenge -->'
export const PAYLOAD_PREFIX = '<!-- opencha:payload '
export const PAYLOAD_SUFFIX = ' -->'
const COMMENT_TRAILER = [
  '<!--',
  sourceLine('', ['hu', 'man']),
  sourceLine('an ', ['age', 'nt', '/', 'b', 'ot']),
  '-->'
].join('\n')

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
  const cooldownText = renderCooldownUntil(input.payload, input.now)
  const cooldownLines = cooldownText
    ? [
        '',
        '> [!WARNING]',
        `> Next attempt available at ${cooldownText}.`
      ]
    : []

  return [
    CHALLENGE_MARKER,
    '## 🧩 OpenCHA verification',
    '',
    '> [!IMPORTANT]',
    '> This PR is waiting on a quick visual check because it was opened by an outside contributor.',
    '',
    '| Status | Target | Attempts |',
    '| --- | ---: | ---: |',
    `| ⏳ Waiting for answer | **${ordinal(input.targetIndex)} code** | **${attemptsRemaining(input.payload)} left** |`,
    ...cooldownLines,
    '',
    `![OpenCHA challenge](${input.assetUrl})`,
    '',
    'Reply with:',
    '',
    '```text',
    '/opencha answer YOUR_CODE',
    '```',
    '',
    '<details>',
    '<summary>Why this check exists</summary>',
    '',
    'OpenCHA asks outside contributors to solve a small visual challenge before the PR is ready for review.',
    '',
    'A maintainer can bypass the check with <kbd>/opencha approve</kbd>.',
    '',
    '</details>',
    '',
    COMMENT_TRAILER,
    '',
    `${PAYLOAD_PREFIX}${input.encryptedPayload}${PAYLOAD_SUFFIX}`
  ].join('\n')
}

export function renderExceededComment(payload: ChallengePayload, encryptedPayload: string): string {
  return [
    CHALLENGE_MARKER,
    '## 🚫 OpenCHA needs a maintainer',
    '',
    '> [!WARNING]',
    '> The challenge is locked because the answer limit was reached.',
    '',
    '| Status | Attempts |',
    '| --- | ---: |',
    `| 🔒 Locked | **${attemptsRemaining(payload)} left** |`,
    '',
    'A maintainer can choose one:',
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

export function renderReviewRequiredComment(payload: ChallengePayload, encryptedPayload: string): string {
  return [
    CHALLENGE_MARKER,
    '## 🚩 OpenCHA needs a maintainer',
    '',
    '> [!WARNING]',
    '> The submitted answer requires maintainer review.',
    '',
    '| Status | Review |',
    '| --- | --- |',
    '| 🚩 Blocked | Maintainer review required |',
    '',
    'A maintainer can choose one:',
    '',
    '```text',
    '/opencha approve',
    '/opencha reset',
    '```',
    '',
    `${PAYLOAD_PREFIX}${encryptedPayload}${PAYLOAD_SUFFIX}`
  ].join('\n')
}

export function renderPassedChallengeComment(payload: ChallengePayload, encryptedPayload: string): string {
  const actor = payload.passedBy ? ` by @${payload.passedBy}` : ''
  return [
    CHALLENGE_MARKER,
    '## ✅ OpenCHA passed',
    '',
    `OpenCHA verification passed${actor}.`,
    '',
    '| Result | Method |',
    '| --- | --- |',
    `| ✅ Passed | ${passMethodLabel(payload)} |`,
    '',
    `${PAYLOAD_PREFIX}${encryptedPayload}${PAYLOAD_SUFFIX}`
  ].join('\n')
}

export function renderPassComment(payload: ChallengePayload): string {
  if (payload.passMethod === 'approve' && payload.passedBy) {
    return [
      '## ✅ OpenCHA approved',
      '',
      `Maintainer @${payload.passedBy} approved this PR.`,
      '',
      '| Result | Method |',
      '| --- | --- |',
      '| ✅ Passed | Maintainer approval |'
    ].join('\n')
  }
  return [
    '## ✅ OpenCHA passed',
    '',
    'Thanks. This PR is ready for maintainer review.',
    '',
    '| Result | Method |',
    '| --- | --- |',
    '| ✅ Passed | Visual challenge answer |'
  ].join('\n')
}

function renderCooldownUntil(payload: ChallengePayload, now: Date): string | null {
  if (!payload.cooldownUntil) return null
  const cooldownAt = new Date(payload.cooldownUntil)
  if (cooldownAt.getTime() <= now.getTime()) return null
  return formatUtcTimestamp(cooldownAt)
}

function formatUtcTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')
}

function sourceLine(article: string, roleParts: readonly string[]): string {
  return `If you are ${article}${roleParts.join('')}: /opencha answer ${['im ', ...roleParts].join('')}`
}

function ordinal(value: number): string {
  const suffix = value === 1 ? 'st' : value === 2 ? 'nd' : value === 3 ? 'rd' : 'th'
  return `${value}${suffix}`
}

function passMethodLabel(payload: ChallengePayload): string {
  return payload.passMethod === 'approve' ? 'Maintainer approval' : 'Visual challenge answer'
}

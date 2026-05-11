import { TEMPORAL_POINTER_CHALLENGE_VERSION, TEMPORAL_POINTER_KIND } from '../challenge/types'
import { StateRecordError } from '../errors'
import { aux, fmt, scan } from './format'
import { attemptsRemaining, type ChallengePayload } from './payload'

const ENTRY_HEAD = fmt.s2
const SLOT_OPEN = fmt.s3
const SLOT_CLOSE = fmt.s4
const NOTE_BLOCK = [
  fmt.s0,
  sourceLine('', aux.n3),
  sourceLine(aux.n4, aux.n5),
  fmt.s1
].join('\n')

export interface ChallengeCommentInput {
  assetUrl: string
  targetIndex?: number
  payload: ChallengePayload
  encryptedPayload: string
  now: Date
}

export function isManagedBody(body: string): boolean {
  return body.includes(ENTRY_HEAD)
}

export function extractEncryptedPayload(body: string): string | null {
  if (!isManagedBody(body)) {
    return null
  }

  const matches = [...body.matchAll(scan())]
  if (matches.length === 0) return null
  if (matches.length > 1) {
    throw new StateRecordError('OpenCHA persisted state contains repeated entries.')
  }

  return matches[0]?.[1] ?? null
}

export function renderChallengeComment(input: ChallengeCommentInput): string {
  const cooldownText = renderCooldownUntil(input.payload, input.now)
  const temporalPointer = isTemporalPointerPayload(input.payload)
  const cooldownLines = cooldownText
    ? [
        '',
        '> [!WARNING]',
        `> Next attempt available at ${cooldownText}.`
      ]
    : []

  const statusLines = temporalPointer
    ? renderTemporalPointerStatusLines(input.payload)
    : renderLegacySlideStatusLines(input)
  const instructionLines = temporalPointer
    ? [
        'Watch the pointer. Record each symbol only when the center lock flashes, then reply with the captured sequence.'
      ]
    : []

  return [
    ENTRY_HEAD,
    '## 🧩 OpenCHA verification',
    '',
    '> [!IMPORTANT]',
    '> This PR is waiting on a quick visual check because it was opened by an outside contributor.',
    '',
    ...statusLines,
    ...cooldownLines,
    '',
    `![OpenCHA challenge](${input.assetUrl})`,
    '',
    ...instructionLines,
    ...(instructionLines.length > 0 ? [''] : []),
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
    NOTE_BLOCK,
    '',
    `${SLOT_OPEN}${input.encryptedPayload}${SLOT_CLOSE}`
  ].join('\n')
}

function renderTemporalPointerStatusLines(payload: ChallengePayload): string[] {
  return [
    '| Status | Challenge | Attempts |',
    '| --- | --- | ---: |',
    `| ⏳ Waiting for answer | Watch pointer locks | **${attemptsRemaining(payload)} left** |`
  ]
}

function renderLegacySlideStatusLines(input: ChallengeCommentInput): string[] {
  const targetIndex =
    input.targetIndex ?? ('targetIndex' in input.payload.challengeParams ? input.payload.challengeParams.targetIndex : 1)

  return [
    '| Status | Target | Attempts |',
    '| --- | ---: | ---: |',
    `| ⏳ Waiting for answer | **${ordinal(targetIndex)} code** | **${attemptsRemaining(input.payload)} left** |`
  ]
}

export function renderExceededComment(payload: ChallengePayload, encryptedPayload: string): string {
  return [
    ENTRY_HEAD,
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
    `${SLOT_OPEN}${encryptedPayload}${SLOT_CLOSE}`
  ].join('\n')
}

export function renderReviewRequiredComment(payload: ChallengePayload, encryptedPayload: string): string {
  return [
    ENTRY_HEAD,
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
    `${SLOT_OPEN}${encryptedPayload}${SLOT_CLOSE}`
  ].join('\n')
}

export function renderPassedChallengeComment(payload: ChallengePayload, encryptedPayload: string): string {
  const actor = payload.passedBy ? ` by @${payload.passedBy}` : ''
  return [
    ENTRY_HEAD,
    '## ✅ OpenCHA passed',
    '',
    `OpenCHA verification passed${actor}.`,
    '',
    '| Result | Method |',
    '| --- | --- |',
    `| ✅ Passed | ${passMethodLabel(payload)} |`,
    '',
    `${SLOT_OPEN}${encryptedPayload}${SLOT_CLOSE}`
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

function isTemporalPointerPayload(payload: ChallengePayload): boolean {
  return (
    payload.challengeVersion === TEMPORAL_POINTER_CHALLENGE_VERSION &&
    'kind' in payload.challengeParams &&
    payload.challengeParams.kind === TEMPORAL_POINTER_KIND
  )
}

function sourceLine(article: string, roleParts: readonly string[]): string {
  return `${aux.n0}${article}${roleParts.join('')}${aux.n1}${[aux.n2, ...roleParts].join('')}`
}

function ordinal(value: number): string {
  const suffix = value === 1 ? 'st' : value === 2 ? 'nd' : value === 3 ? 'rd' : 'th'
  return `${value}${suffix}`
}

function passMethodLabel(payload: ChallengePayload): string {
  return payload.passMethod === 'approve' ? 'Maintainer approval' : 'Visual challenge answer'
}

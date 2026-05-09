import type { ActionInputs } from '../action/inputs'
import type { ActionRunReport } from '../action/result'
import { GitBranchAssetStore } from '../assets/branch-store'
import { createChallenge } from '../challenge/generate'
import { verifyAnswer } from '../challenge/answer'
import { parseOpenchaCommand } from '../commands/parser'
import { setCheckFailure } from '../checks'
import type { OpenchaConfig } from '../config/defaults'
import type { OpenchaEvent } from '../github/context'
import type { GitHubGateway, IssueComment, PullRequestInfo } from '../github/gateway'
import { ensureAndAddNeedsMaintainerLabel } from '../labels'
import { renderChallengeComment, renderExceededComment, renderPassedChallengeComment } from '../state/comments'
import type { ChallengePayload } from '../state/payload'
import { encryptPayload, loadChallengeState } from './state'
import { cleanupStateBestEffort, failClosed, loadConfigForPr, startNewChallenge, trustForActor } from './pr-flow'
import { completePass } from './pass-flow'

export interface CommentFlowInput {
  event: Extract<OpenchaEvent, { kind: 'comment' }>
  gateway: GitHubGateway
  inputs: ActionInputs
  report: ActionRunReport
}

export async function handleIssueCommentEvent(input: CommentFlowInput): Promise<void> {
  const command = parseOpenchaCommand(input.event.body)
  if (command.kind === 'none' || command.kind === 'unknown') return

  const pr = await input.gateway.getPullRequest(input.event.owner, input.event.repo, input.event.prNumber)
  const config = await loadConfigForPr(input.gateway, pr, input.report)

  if (command.kind === 'answer') {
    await handleAnswer(input, pr, config, command.answer)
    return
  }

  const trust = await trustForActor(input.gateway, pr, input.event.actor, config, input.report)
  if (!trust.trusted) return

  if (command.kind === 'approve') {
    await handleApprove(input, pr, config)
    return
  }

  await handleReset(input, pr, config)
}

async function handleAnswer(
  input: CommentFlowInput,
  pr: PullRequestInfo,
  config: OpenchaConfig,
  answer: string
): Promise<void> {
  if (input.event.actor.toLowerCase() !== pr.author.toLowerCase()) {
    await hideCommentBestEffort(input.gateway, input.event.commentNodeId, input.report)
    return
  }

  const actorTrust = await trustForActor(input.gateway, pr, input.event.actor, config, input.report)
  if (actorTrust.trusted) {
    await hideCommentBestEffort(input.gateway, input.event.commentNodeId, input.report)
    return
  }

  const state = await loadChallengeState(input.gateway, input.inputs, pr)
  if (state.kind === 'none') {
    await startNewChallenge(input.gateway, input.inputs, config, pr, input.report)
    await hideCommentBestEffort(input.gateway, input.event.commentNodeId, input.report)
    return
  }

  if (state.kind === 'corrupted') {
    await failClosed(input.gateway, config, pr, input.report, 'OpenCHA challenge state is corrupted.')
    await hideCommentBestEffort(input.gateway, input.event.commentNodeId, input.report)
    return
  }

  if (state.kind === 'passed' || state.kind === 'exceeded') {
    await hideCommentBestEffort(input.gateway, input.event.commentNodeId, input.report)
    return
  }

  const now = new Date()
  if (state.payload.cooldownUntil && Date.parse(state.payload.cooldownUntil) > now.getTime()) {
    await updateChallengeComment(input, pr, state.comment, state.payload, now)
    await hideCommentBestEffort(input.gateway, input.event.commentNodeId, input.report)
    return
  }

  if (verifyAnswer(answer, state.payload.answerSalt, state.payload.answerHash)) {
    await completePass({
      gateway: input.gateway,
      inputs: input.inputs,
      report: input.report,
      config,
      pr,
      challengeComment: state.comment,
      answerCommentNodeId: input.event.commentNodeId,
      payload: state.payload,
      passedBy: input.event.actor,
      passMethod: 'answer'
    })
    return
  }

  const nextPayload: ChallengePayload = {
    ...state.payload,
    attempts: state.payload.attempts + 1,
    cooldownUntil: new Date(now.getTime() + state.payload.cooldownSeconds * 1000).toISOString()
  }

  if (nextPayload.attempts >= nextPayload.maxAttempts) {
    nextPayload.exceeded = true
    nextPayload.cooldownUntil = null
    const encrypted = encryptPayload(nextPayload, input.inputs, pr)
    await input.gateway.updateIssueComment(pr.baseOwner, pr.baseRepo, state.comment.id, renderExceededComment(nextPayload, encrypted))
    await ensureAndAddNeedsMaintainerLabel(input.gateway, config, pr.baseOwner, pr.baseRepo, pr.number)
    await setCheckFailure(input.gateway, pr, input.report, 'OpenCHA needs maintainer review')
    await hideCommentBestEffort(input.gateway, input.event.commentNodeId, input.report)
    return
  }

  if (config.challenge.rotateOnWrongAnswer) {
    if (config.assets.cleanupPassedAssets && state.payload.asset) {
      try {
        await new GitBranchAssetStore(input.gateway, config.assets.branch, pr.baseRef).delete({
          owner: pr.baseOwner,
          repo: pr.baseRepo,
          assetRef: state.payload.asset.assetRef
        })
      } catch (error) {
        input.report.warn(error instanceof Error ? error.message : 'Failed to clean up rotated challenge asset.')
      }
    }
    await startNewChallenge(input.gateway, input.inputs, config, pr, input.report, state.comment.id, nextPayload.attempts, nextPayload.cooldownUntil)
  } else {
    await updateChallengeComment(input, pr, state.comment, nextPayload, now)
  }

  await hideCommentBestEffort(input.gateway, input.event.commentNodeId, input.report)
}

async function handleApprove(input: CommentFlowInput, pr: PullRequestInfo, config: OpenchaConfig): Promise<void> {
  const state = await loadChallengeState(input.gateway, input.inputs, pr)
  if (state.kind === 'active' || state.kind === 'passed' || state.kind === 'exceeded') {
    await completePass({
      gateway: input.gateway,
      inputs: input.inputs,
      report: input.report,
      config,
      pr,
      challengeComment: state.comment,
      answerCommentNodeId: input.event.commentNodeId,
      payload: state.payload,
      passedBy: input.event.actor,
      passMethod: 'approve'
    })
    return
  }

  if (state.kind === 'corrupted') {
    await hideCommentBestEffort(input.gateway, state.comment.nodeId, input.report)
  }

  const generated = createChallenge()
  const now = new Date()
  const payload: ChallengePayload = {
    schema: 1,
    challengeId: cryptoRandomId(),
    challengeVersion: generated.payload.challengeVersion,
    seed: generated.payload.seed,
    challengeParams: generated.payload.challengeParams,
    answerSalt: generated.payload.answerSalt,
    answerHash: generated.payload.answerHash,
    attempts: 0,
    maxAttempts: config.challenge.maxAttempts,
    cooldownSeconds: config.challenge.cooldownSeconds,
    cooldownUntil: null,
    issuedAt: now.toISOString(),
    passed: false,
    passedAt: null,
    passedBy: null,
    passMethod: null,
    draftedByOpencha: false,
    asset: null,
    exceeded: false
  }
  const encrypted = encryptPayload(payload, input.inputs, pr)
  const comment = await input.gateway.createIssueComment(
    pr.baseOwner,
    pr.baseRepo,
    pr.number,
    renderPassedChallengeComment(payload, encrypted)
  )
  await completePass({
    gateway: input.gateway,
    inputs: input.inputs,
    report: input.report,
    config,
    pr,
    challengeComment: comment,
    answerCommentNodeId: input.event.commentNodeId,
    payload,
    passedBy: input.event.actor,
    passMethod: 'approve'
  })
}

async function handleReset(input: CommentFlowInput, pr: PullRequestInfo, config: OpenchaConfig): Promise<void> {
  const state = await loadChallengeState(input.gateway, input.inputs, pr)
  if (state.kind !== 'none' && state.kind !== 'corrupted') {
    await cleanupStateBestEffort(input.gateway, config, pr, state, input.report)
  } else if (state.kind === 'corrupted') {
    await hideCommentBestEffort(input.gateway, state.comment.nodeId, input.report)
  }
  await startNewChallenge(input.gateway, input.inputs, config, pr, input.report)
}

async function updateChallengeComment(
  input: CommentFlowInput,
  pr: PullRequestInfo,
  comment: IssueComment,
  payload: ChallengePayload,
  now: Date
): Promise<void> {
  const encrypted = encryptPayload(payload, input.inputs, pr)
  await input.gateway.updateIssueComment(pr.baseOwner, pr.baseRepo, comment.id, renderChallengeComment({
    assetUrl: payload.asset?.url ?? '',
    targetIndex: payload.challengeParams.targetIndex,
    payload,
    encryptedPayload: encrypted,
    now
  }))
}

async function hideCommentBestEffort(gateway: GitHubGateway, nodeId: string, report: ActionRunReport): Promise<void> {
  if (!nodeId) return
  try {
    await gateway.minimizeComment(nodeId)
  } catch (error) {
    report.warn(error instanceof Error ? error.message : 'Failed to hide OpenCHA comment.')
  }
}

function cryptoRandomId(): string {
  return `approved-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

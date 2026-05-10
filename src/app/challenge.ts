import { randomUUID } from 'node:crypto'
import type { ActionInputs } from '../action/inputs'
import type { ActionRunReport } from '../action/result'
import { GitBranchAssetStore } from '../assets/branch-store'
import type { OpenchaConfig } from '../config/defaults'
import { createChallenge } from '../challenge/generate'
import { encodeGif } from '../challenge/gif'
import { renderChallengeFrames } from '../challenge/render'
import type { GitHubGateway, PullRequestInfo } from '../github/gateway'
import { renderChallengeComment } from '../state/comments'
import type { ChallengePayload } from '../state/payload'
import { encryptPayload } from './state'

export interface IssuedChallenge {
  commentId: number
  commentNodeId: string
  payload: ChallengePayload
}

export async function issueChallenge(input: {
  gateway: GitHubGateway
  inputs: ActionInputs
  report: ActionRunReport
  config: OpenchaConfig
  pr: PullRequestInfo
  draftedByOpencha?: boolean
  updateCommentId?: number
  attempts?: number
  cooldownUntil?: string | null
}): Promise<IssuedChallenge> {
  const challengeId = randomUUID()
  const generated = createChallenge({ codeCount: input.config.challenge.codeCount })
  const frames = renderChallengeFrames(generated.display)
  const gif = encodeGif(frames)
  const assetStore = new GitBranchAssetStore(input.gateway, input.config.assets.branch, input.pr.baseRef)
  const asset = await assetStore.put({
    owner: input.pr.baseOwner,
    repo: input.pr.baseRepo,
    prNumber: input.pr.number,
    challengeId,
    filename: `challenge-${challengeId}.gif`,
    contentType: 'image/gif',
    bytes: gif
  })

  const now = new Date()
  const payload: ChallengePayload = {
    schema: 1,
    challengeId,
    challengeVersion: generated.payload.challengeVersion,
    seed: generated.payload.seed,
    challengeParams: generated.payload.challengeParams,
    answerSalt: generated.payload.answerSalt,
    answerHash: generated.payload.answerHash,
    attempts: input.attempts ?? 0,
    maxAttempts: input.config.challenge.maxAttempts,
    cooldownSeconds: input.config.challenge.cooldownSeconds,
    cooldownUntil: input.cooldownUntil ?? null,
    issuedAt: now.toISOString(),
    passed: false,
    passedAt: null,
    passedBy: null,
    passMethod: null,
    draftedByOpencha: input.draftedByOpencha ?? false,
    asset,
    exceeded: false
  }

  const encrypted = encryptPayload(payload, input.inputs, input.pr)
  const body = renderChallengeComment({
    assetUrl: asset.url,
    targetIndex: payload.challengeParams.targetIndex,
    payload,
    encryptedPayload: encrypted,
    now
  })

  const comment = input.updateCommentId
    ? await input.gateway.updateIssueComment(input.pr.baseOwner, input.pr.baseRepo, input.updateCommentId, body)
    : await input.gateway.createIssueComment(input.pr.baseOwner, input.pr.baseRepo, input.pr.number, body)

  return { commentId: comment.id, commentNodeId: comment.nodeId, payload }
}

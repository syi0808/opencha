import { randomUUID } from 'node:crypto'
import type { ActionInputs } from '../action/inputs'
import type { ActionRunReport } from '../action/result'
import { bundleAssetRefs, GitBranchAssetStore } from '../assets/branch-store'
import type { OpenchaConfig } from '../config/defaults'
import { createChallenge } from '../challenge/generate'
import { encodeGif } from '../challenge/gif'
import { renderChallengeAssets, type ChallengeRenderAssetSlot } from '../challenge/render'
import { TEMPORAL_POINTER_GRID_LAYOUT, TEMPORAL_POINTER_GRID_SLOTS } from '../challenge/types'
import type { GitHubGateway, PullRequestInfo } from '../github/gateway'
import { renderChallengeComment } from '../state/comments'
import type { ChallengePayload } from '../state/payload'
import { encryptPayload } from './state'

export interface IssuedChallenge {
  commentId: number
  commentNodeId: string
  payload: ChallengePayload
}

interface UploadedChallengeAsset {
  slot: ChallengeRenderAssetSlot
  url: string
  assetRef: string
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
  const renderedAssets = renderChallengeAssets(generated.display)
  const assetStore = new GitBranchAssetStore(input.gateway, input.config.assets.branch, input.pr.baseRef)
  const uploadedAssets: UploadedChallengeAsset[] = []

  for (const rendered of renderedAssets) {
    const gif = encodeGif(rendered.frames)
    uploadedAssets.push({
      slot: rendered.slot,
      ...(await assetStore.put({
        owner: input.pr.baseOwner,
        repo: input.pr.baseRepo,
        prNumber: input.pr.number,
        challengeId,
        filename: challengeAssetFilename(challengeId, rendered.filenamePart),
        contentType: 'image/gif',
        bytes: gif
      }))
    })
  }

  const primaryAsset = uploadedAssets[0]
  if (!primaryAsset) {
    throw new Error('OpenCHA challenge renderer did not produce any assets.')
  }
  const assetRef = uploadedAssets.length === 1
    ? primaryAsset.assetRef
    : bundleAssetRefs(uploadedAssets.map((uploaded) => uploaded.assetRef))
  const layout = temporalPointerLayout(uploadedAssets)
  const asset = layout ? {
    url: primaryAsset.url,
    assetRef,
    layout
  } : {
    url: primaryAsset.url,
    assetRef
  }

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
    payload,
    encryptedPayload: encrypted,
    now
  })

  const comment = input.updateCommentId
    ? await input.gateway.updateIssueComment(input.pr.baseOwner, input.pr.baseRepo, input.updateCommentId, body)
    : await input.gateway.createIssueComment(input.pr.baseOwner, input.pr.baseRepo, input.pr.number, body)

  return { commentId: comment.id, commentNodeId: comment.nodeId, payload }
}

function challengeAssetFilename(challengeId: string, filenamePart: string): string {
  return `challenge-${challengeId}-${filenamePart}.gif`
}

function temporalPointerLayout(assets: readonly UploadedChallengeAsset[]): NonNullable<ChallengePayload['asset']>['layout'] {
  const center = assets.find((asset) => asset.slot === 'center')
  const cells = TEMPORAL_POINTER_GRID_SLOTS.map((direction) => {
    const asset = assets.find((candidate) => candidate.slot === direction)
    return asset ? { direction, url: asset.url } : null
  })

  if (!center || cells.some((cell) => cell === null)) {
    return undefined
  }

  return {
    kind: TEMPORAL_POINTER_GRID_LAYOUT,
    center: center.url,
    cells: cells.filter((cell) => cell !== null)
  }
}

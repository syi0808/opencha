import type { ActionInputs } from '../action/inputs'
import type { ActionRunReport } from '../action/result'
import { GitBranchAssetStore } from '../assets/branch-store'
import { setCheckSuccess } from '../checks'
import type { OpenchaConfig } from '../config/defaults'
import type { GitHubGateway, IssueComment, PullRequestInfo } from '../github/gateway'
import { removeVerificationLabelsBestEffort } from '../labels'
import { renderPassComment, renderPassedChallengeComment } from '../state/comments'
import { markPayloadPassed, type ChallengePayload } from '../state/payload'
import { encryptPayload } from './state'

export async function completePass(input: {
  gateway: GitHubGateway
  inputs: ActionInputs
  report: ActionRunReport
  config: OpenchaConfig
  pr: PullRequestInfo
  challengeComment: IssueComment
  answerCommentNodeId?: string
  payload: ChallengePayload
  passedBy: string
  passMethod: 'answer' | 'approve'
}): Promise<ChallengePayload> {
  const wasAlreadyPassed = input.payload.passed
  const passedPayload = markPayloadPassed(input.payload, {
    passedBy: input.passedBy,
    passMethod: input.passMethod,
    now: new Date()
  })
  const encrypted = encryptPayload(passedPayload, input.inputs, input.pr)
  await input.gateway.updateIssueComment(
    input.pr.baseOwner,
    input.pr.baseRepo,
    input.challengeComment.id,
    renderPassedChallengeComment(passedPayload, encrypted)
  )

  await removeVerificationLabelsBestEffort(input.gateway, input.config, input.pr.baseOwner, input.pr.baseRepo, input.pr.number, input.report)
  await setCheckSuccess(input.gateway, input.pr, input.report)

  if (passedPayload.draftedByOpencha) {
    try {
      await input.gateway.markPullRequestReady(input.pr.nodeId)
    } catch (error) {
      input.report.warn(error instanceof Error ? error.message : 'Failed to mark pull request ready.')
    }
  }

  if (!wasAlreadyPassed) {
    try {
      await input.gateway.createIssueComment(input.pr.baseOwner, input.pr.baseRepo, input.pr.number, renderPassComment(passedPayload))
    } catch (error) {
      input.report.warn(error instanceof Error ? error.message : 'Failed to create OpenCHA pass comment.')
    }
  }

  for (const nodeId of [input.challengeComment.nodeId, input.answerCommentNodeId]) {
    if (!nodeId) continue
    try {
      await input.gateway.minimizeComment(nodeId)
    } catch (error) {
      input.report.warn(error instanceof Error ? error.message : 'Failed to hide OpenCHA comment.')
    }
  }

  if (input.config.assets.cleanupPassedAssets && passedPayload.asset) {
    try {
      await new GitBranchAssetStore(input.gateway, input.config.assets.branch, input.pr.baseRef).delete({
        owner: input.pr.baseOwner,
        repo: input.pr.baseRepo,
        assetRef: passedPayload.asset.assetRef
      })
    } catch (error) {
      input.report.warn(error instanceof Error ? error.message : 'Failed to clean up OpenCHA challenge asset.')
    }
  }

  return passedPayload
}

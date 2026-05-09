import type { ActionInputs } from '../action/inputs'
import type { ActionRunReport } from '../action/result'
import { GitBranchAssetStore } from '../assets/branch-store'
import { setCheckFailure, setCheckInProgress, setCheckSuccess } from '../checks'
import { DEFAULT_CONFIG, type OpenchaConfig } from '../config/defaults'
import { loadOpenchaConfig } from '../config/load'
import { ConfigError } from '../errors'
import type { OpenchaEvent } from '../github/context'
import type { GitHubGateway, PullRequestInfo, RepositoryPermission } from '../github/gateway'
import { ensureAndAddNeedsMaintainerLabel, ensureAndAddVerifyingLabel, removeVerificationLabelsBestEffort } from '../labels'
import { isChallengeIssuanceEvent, isEnforcementEvent } from '../policy/events'
import { decideTrust } from '../policy/trust'
import { issueChallenge } from './challenge'
import { loadChallengeState, type LoadedChallengeState } from './state'

export interface PullRequestFlowInput {
  event: Extract<OpenchaEvent, { kind: 'pr' }>
  gateway: GitHubGateway
  inputs: ActionInputs
  report: ActionRunReport
}

export async function handlePullRequestEvent(input: PullRequestFlowInput): Promise<void> {
  if (!isChallengeIssuanceEvent(input.event.action) && !isEnforcementEvent(input.event.action)) {
    return
  }

  const pr = await input.gateway.getPullRequest(input.event.owner, input.event.repo, input.event.prNumber)
  const config = await loadConfigForPr(input.gateway, pr, input.report)
  const trust = await trustForActor(input.gateway, pr, pr.author, config, input.report)

  if (trust.trusted) {
    await removeVerificationLabelsBestEffort(input.gateway, config, pr.baseOwner, pr.baseRepo, pr.number, input.report)
    await setCheckSuccess(input.gateway, pr, input.report, `OpenCHA skipped for trusted actor (${trust.reason})`)
    return
  }

  const state = await loadChallengeState(input.gateway, input.inputs, pr)

  if (state.kind === 'corrupted') {
    await failClosed(input.gateway, config, pr, input.report, 'OpenCHA challenge state is corrupted.')
    return
  }

  if (input.event.action === 'synchronize' && state.kind === 'passed' && config.policy.reverifyOnPush) {
    await cleanupStateBestEffort(input.gateway, config, pr, state, input.report)
    await startNewChallenge(input.gateway, input.inputs, config, pr, input.report)
    return
  }

  if (state.kind === 'passed') {
    await removeVerificationLabelsBestEffort(input.gateway, config, pr.baseOwner, pr.baseRepo, pr.number, input.report)
    await setCheckSuccess(input.gateway, pr, input.report)
    return
  }

  if (state.kind === 'exceeded') {
    await ensureAndAddNeedsMaintainerLabel(input.gateway, config, pr.baseOwner, pr.baseRepo, pr.number)
    await setCheckFailure(input.gateway, pr, input.report, 'OpenCHA needs maintainer review')
    return
  }

  if (state.kind === 'none') {
    await startNewChallenge(input.gateway, input.inputs, config, pr, input.report)
    return
  }

  await enforceActiveChallenge(input.gateway, config, pr, input.report)
}

export async function loadConfigForPr(
  gateway: GitHubGateway,
  pr: PullRequestInfo,
  report: ActionRunReport
): Promise<OpenchaConfig> {
  try {
    return await loadOpenchaConfig(gateway, { owner: pr.baseOwner, repo: pr.baseRepo, ref: pr.baseRef }, report)
  } catch (error) {
    if (error instanceof ConfigError) {
      report.warn(error.message)
      return DEFAULT_CONFIG
    }
    throw error
  }
}

export async function trustForActor(
  gateway: GitHubGateway,
  pr: PullRequestInfo,
  actor: string,
  config: OpenchaConfig,
  report: ActionRunReport
) {
  let permission: RepositoryPermission | null = null
  let permissionLookupFailed = false
  try {
    permission = await gateway.getRepositoryPermission(pr.baseOwner, pr.baseRepo, actor)
  } catch (error) {
    permissionLookupFailed = true
    report.warn(error instanceof Error ? error.message : `Failed to look up repository permission for ${actor}.`)
  }

  return decideTrust({ actor, permission, permissionLookupFailed, config })
}

export async function startNewChallenge(
  gateway: GitHubGateway,
  inputs: ActionInputs,
  config: OpenchaConfig,
  pr: PullRequestInfo,
  report: ActionRunReport,
  updateCommentId?: number,
  attempts?: number,
  cooldownUntil?: string | null
): Promise<void> {
  let draftedByOpencha = false
  if (!pr.isDraft) {
    try {
      await gateway.markPullRequestDraft(pr.nodeId)
      draftedByOpencha = true
    } catch (error) {
      report.warn(error instanceof Error ? error.message : 'Failed to convert pull request to draft.')
    }
  }

  const challengeInput: Parameters<typeof issueChallenge>[0] = { gateway, inputs, report, config, pr, draftedByOpencha }
  if (updateCommentId !== undefined) challengeInput.updateCommentId = updateCommentId
  if (attempts !== undefined) challengeInput.attempts = attempts
  if (cooldownUntil !== undefined) challengeInput.cooldownUntil = cooldownUntil
  await issueChallenge(challengeInput)
  await ensureAndAddVerifyingLabel(gateway, config, pr.baseOwner, pr.baseRepo, pr.number)
  await setCheckInProgress(gateway, pr, report)
}

export async function enforceActiveChallenge(
  gateway: GitHubGateway,
  config: OpenchaConfig,
  pr: PullRequestInfo,
  report: ActionRunReport
): Promise<void> {
  await ensureAndAddVerifyingLabel(gateway, config, pr.baseOwner, pr.baseRepo, pr.number)
  if (!pr.isDraft) {
    try {
      await gateway.markPullRequestDraft(pr.nodeId)
    } catch (error) {
      report.warn(error instanceof Error ? error.message : 'Failed to convert pull request to draft.')
    }
  }
  await setCheckInProgress(gateway, pr, report)
}

export async function failClosed(
  gateway: GitHubGateway,
  config: OpenchaConfig,
  pr: PullRequestInfo,
  report: ActionRunReport,
  reason: string
): Promise<void> {
  report.warn(reason)
  await ensureAndAddNeedsMaintainerLabel(gateway, config, pr.baseOwner, pr.baseRepo, pr.number)
  await setCheckFailure(gateway, pr, report, 'OpenCHA needs maintainer review')
}

export async function cleanupStateBestEffort(
  gateway: GitHubGateway,
  config: OpenchaConfig,
  pr: PullRequestInfo,
  state: Exclude<LoadedChallengeState, { kind: 'none' | 'corrupted' }>,
  report: ActionRunReport
): Promise<void> {
  try {
    await gateway.minimizeComment(state.comment.nodeId)
  } catch (error) {
    report.warn(error instanceof Error ? error.message : 'Failed to hide old challenge comment.')
  }

  if (config.assets.cleanupPassedAssets && state.payload.asset) {
    try {
      await new GitBranchAssetStore(gateway, config.assets.branch, pr.baseRef).delete({
        owner: pr.baseOwner,
        repo: pr.baseRepo,
        assetRef: state.payload.asset.assetRef
      })
    } catch (error) {
      report.warn(error instanceof Error ? error.message : 'Failed to clean up old challenge asset.')
    }
  }
}

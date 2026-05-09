import type { ActionRunReport } from './action/result'
import type { GitHubGateway, PullRequestInfo } from './github/gateway'

export const OPENCHA_CHECK_NAME = 'OpenCHA'

export async function setCheckInProgress(
  gateway: GitHubGateway,
  pr: PullRequestInfo,
  report: ActionRunReport,
  title = 'OpenCHA verification is required'
): Promise<void> {
  await gateway.createOrUpdateCheck(pr.baseOwner, pr.baseRepo, pr.headSha, {
    name: OPENCHA_CHECK_NAME,
    status: 'in_progress',
    title,
    summary: report.toCheckSummary()
  })
}

export async function setCheckSuccess(
  gateway: GitHubGateway,
  pr: PullRequestInfo,
  report: ActionRunReport,
  title = 'OpenCHA verification passed'
): Promise<void> {
  await gateway.createOrUpdateCheck(pr.baseOwner, pr.baseRepo, pr.headSha, {
    name: OPENCHA_CHECK_NAME,
    status: 'completed',
    conclusion: 'success',
    title,
    summary: report.toCheckSummary()
  })
}

export async function setCheckFailure(
  gateway: GitHubGateway,
  pr: PullRequestInfo,
  report: ActionRunReport,
  title = 'OpenCHA verification failed'
): Promise<void> {
  await gateway.createOrUpdateCheck(pr.baseOwner, pr.baseRepo, pr.headSha, {
    name: OPENCHA_CHECK_NAME,
    status: 'completed',
    conclusion: 'failure',
    title,
    summary: report.toCheckSummary()
  })
}

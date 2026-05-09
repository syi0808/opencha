import type { ActionRunReport } from './action/result'
import type { OpenchaConfig } from './config/defaults'
import type { GitHubGateway } from './github/gateway'

const VERIFYING_COLOR = 'FFD866'
const NEEDS_MAINTAINER_COLOR = 'D73A4A'

export async function ensureAndAddVerifyingLabel(
  gateway: GitHubGateway,
  config: OpenchaConfig,
  owner: string,
  repo: string,
  prNumber: number
): Promise<void> {
  await gateway.ensureLabel(owner, repo, config.labels.verifying, VERIFYING_COLOR, 'OpenCHA verification is in progress')
  await gateway.addLabels(owner, repo, prNumber, [config.labels.verifying])
}

export async function ensureAndAddNeedsMaintainerLabel(
  gateway: GitHubGateway,
  config: OpenchaConfig,
  owner: string,
  repo: string,
  prNumber: number
): Promise<void> {
  await gateway.ensureLabel(owner, repo, config.labels.needsMaintainer, NEEDS_MAINTAINER_COLOR, 'OpenCHA needs maintainer attention')
  await gateway.addLabels(owner, repo, prNumber, [config.labels.needsMaintainer])
}

export async function removeVerificationLabelsBestEffort(
  gateway: GitHubGateway,
  config: OpenchaConfig,
  owner: string,
  repo: string,
  prNumber: number,
  report: ActionRunReport
): Promise<void> {
  for (const label of [config.labels.verifying, config.labels.needsMaintainer]) {
    try {
      await gateway.removeLabel(owner, repo, prNumber, label)
    } catch (error) {
      report.warn(error instanceof Error ? error.message : `Failed to remove label ${label}.`)
    }
  }
}

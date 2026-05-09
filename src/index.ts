import * as core from '@actions/core'
import * as github from '@actions/github'
import { readActionInputs } from './action/inputs'
import { ActionRunReport } from './action/result'
import { routeEvent } from './app/router'
import { OctokitGitHubGateway } from './github/octokit-gateway'

export async function main(): Promise<void> {
  const report = new ActionRunReport()

  try {
    const inputs = readActionInputs(core)
    const gateway = new OctokitGitHubGateway(inputs.githubToken)
    await routeEvent({
      context: github.context,
      gateway,
      inputs,
      report,
      core
    })

    for (const warning of report.warnings) {
      core.warning(warning)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    core.setFailed(message)
  }
}

if (require.main === module) {
  void main()
}

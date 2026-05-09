import type * as core from '@actions/core'
import type { Context } from '@actions/github/lib/context'
import type { ActionInputs } from '../action/inputs'
import type { ActionRunReport } from '../action/result'
import { handleIssueCommentEvent } from './comment-flow'
import { handlePullRequestEvent } from './pr-flow'
import { fromGitHubContext } from '../github/context'
import type { GitHubGateway } from '../github/gateway'

export interface RouteEventInput {
  context: Context
  gateway: GitHubGateway
  inputs: ActionInputs
  report: ActionRunReport
  core: Pick<typeof core, 'info'>
}

export async function routeEvent(input: RouteEventInput): Promise<void> {
  const event = fromGitHubContext(input.context)

  if (event.kind === 'noop') {
    input.core.info(`OpenCHA no-op: ${event.reason}`)
    return
  }

  if (event.kind === 'pr') {
    await handlePullRequestEvent({ event, gateway: input.gateway, inputs: input.inputs, report: input.report })
    return
  }

  await handleIssueCommentEvent({ event, gateway: input.gateway, inputs: input.inputs, report: input.report })
}

import type { Context } from '@actions/github/lib/context'

export type OpenchaEvent =
  | {
      kind: 'pr'
      action: string
      owner: string
      repo: string
      prNumber: number
      baseRef: string
      headSha: string
      author: string
      isDraft: boolean
    }
  | {
      kind: 'comment'
      action: 'created'
      owner: string
      repo: string
      prNumber: number
      commentId: number
      commentNodeId: string
      body: string
      actor: string
    }
  | { kind: 'noop'; reason: string }

export function fromGitHubContext(context: Context): OpenchaEvent {
  const payload = context.payload as Record<string, unknown>
  const action = typeof payload.action === 'string' ? payload.action : ''

  if (context.eventName === 'pull_request_target') {
    const pr = payload.pull_request as Record<string, unknown> | undefined
    const repo = payload.repository as Record<string, unknown> | undefined
    if (!pr || !repo) return { kind: 'noop', reason: 'missing pull_request payload' }

    const fullName = String(repo.full_name ?? '')
    const [owner, repoName] = fullName.split('/')
    const user = pr.user as Record<string, unknown> | undefined
    const base = pr.base as Record<string, unknown> | undefined
    const head = pr.head as Record<string, unknown> | undefined

    if (!owner || !repoName || typeof pr.number !== 'number' || !base || !head) {
      return { kind: 'noop', reason: 'incomplete pull_request payload' }
    }

    return {
      kind: 'pr',
      action,
      owner,
      repo: repoName,
      prNumber: pr.number,
      baseRef: String(base.ref ?? ''),
      headSha: String(head.sha ?? ''),
      author: String(user?.login ?? ''),
      isDraft: Boolean(pr.draft)
    }
  }

  if (context.eventName === 'issue_comment' && action === 'created') {
    const issue = payload.issue as Record<string, unknown> | undefined
    const comment = payload.comment as Record<string, unknown> | undefined
    const repo = payload.repository as Record<string, unknown> | undefined
    if (!issue || !comment || !repo || !issue.pull_request) {
      return { kind: 'noop', reason: 'not a pull request comment' }
    }

    const fullName = String(repo.full_name ?? '')
    const [owner, repoName] = fullName.split('/')
    const user = comment.user as Record<string, unknown> | undefined

    if (!owner || !repoName || typeof issue.number !== 'number' || typeof comment.id !== 'number') {
      return { kind: 'noop', reason: 'incomplete issue_comment payload' }
    }

    return {
      kind: 'comment',
      action: 'created',
      owner,
      repo: repoName,
      prNumber: issue.number,
      commentId: comment.id,
      commentNodeId: String(comment.node_id ?? ''),
      body: String(comment.body ?? ''),
      actor: String(user?.login ?? '')
    }
  }

  return { kind: 'noop', reason: `unsupported event ${context.eventName}` }
}

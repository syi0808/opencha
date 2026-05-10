import * as github from '@actions/github'
import { GitHubGatewayError, NotFoundError } from '../errors'
import type { CheckRunInput, GitHubGateway, IssueComment, PullRequestInfo, RepositoryPermission } from './gateway'

type Octokit = ReturnType<typeof github.getOctokit>

export class OctokitGitHubGateway implements GitHubGateway {
  private readonly octokit: Octokit

  constructor(token: string) {
    this.octokit = github.getOctokit(token)
  }

  async getRepositoryPermission(owner: string, repo: string, username: string): Promise<RepositoryPermission> {
    try {
      const response = await this.octokit.rest.repos.getCollaboratorPermissionLevel({
        owner,
        repo,
        username
      })
      return normalizePermission(response.data.permission)
    } catch (error) {
      if (statusOf(error) === 404) return 'none'
      throw normalizeError(error, 'Failed to read repository permission.')
    }
  }

  async getPullRequest(owner: string, repo: string, prNumber: number): Promise<PullRequestInfo> {
    try {
      const response = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      })
      const pr = response.data
      return {
        number: pr.number,
        nodeId: pr.node_id,
        author: pr.user?.login ?? '',
        baseOwner: pr.base.repo.owner.login,
        baseRepo: pr.base.repo.name,
        baseRef: pr.base.ref,
        headSha: pr.head.sha,
        isDraft: pr.draft ?? false
      }
    } catch (error) {
      throw normalizeError(error, 'Failed to read pull request.')
    }
  }

  async listIssueComments(owner: string, repo: string, issueNumber: number): Promise<IssueComment[]> {
    try {
      const comments = await this.octokit.paginate(this.octokit.rest.issues.listComments, {
        owner,
        repo,
        issue_number: issueNumber,
        per_page: 100
      })
      return comments.map(toIssueComment)
    } catch (error) {
      throw normalizeError(error, 'Failed to list issue comments.')
    }
  }

  async createIssueComment(owner: string, repo: string, issueNumber: number, body: string): Promise<IssueComment> {
    try {
      const response = await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body
      })
      return toIssueComment(response.data)
    } catch (error) {
      throw normalizeError(error, 'Failed to create issue comment.')
    }
  }

  async updateIssueComment(owner: string, repo: string, commentId: number, body: string): Promise<IssueComment> {
    try {
      const response = await this.octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: commentId,
        body
      })
      return toIssueComment(response.data)
    } catch (error) {
      throw normalizeError(error, 'Failed to update issue comment.')
    }
  }

  async minimizeComment(commentNodeId: string, classifier: 'OUTDATED' | 'RESOLVED' = 'OUTDATED'): Promise<void> {
    try {
      await this.octokit.graphql(
        `mutation MinimizeOpenchaComment($subjectId: ID!, $classifier: ReportedContentClassifiers!) {
          minimizeComment(input: { subjectId: $subjectId, classifier: $classifier }) {
            minimizedComment { isMinimized }
          }
        }`,
        { subjectId: commentNodeId, classifier }
      )
    } catch (error) {
      throw normalizeError(error, 'Failed to minimize comment.', false)
    }
  }

  async ensureLabel(owner: string, repo: string, name: string, color: string, description: string): Promise<void> {
    try {
      await this.octokit.rest.issues.getLabel({ owner, repo, name })
    } catch (error) {
      if (statusOf(error) !== 404) throw normalizeError(error, `Failed to read label ${name}.`)
      try {
        await this.octokit.rest.issues.createLabel({ owner, repo, name, color, description })
      } catch (createError) {
        if (statusOf(createError) === 422) return
        throw normalizeError(createError, `Failed to create label ${name}.`)
      }
    }
  }

  async addLabels(owner: string, repo: string, issueNumber: number, labels: string[]): Promise<void> {
    if (labels.length === 0) return
    try {
      await this.octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels
      })
    } catch (error) {
      throw normalizeError(error, 'Failed to add labels.')
    }
  }

  async removeLabel(owner: string, repo: string, issueNumber: number, label: string): Promise<void> {
    try {
      await this.octokit.rest.issues.removeLabel({
        owner,
        repo,
        issue_number: issueNumber,
        name: label
      })
    } catch (error) {
      if (statusOf(error) === 404) return
      throw normalizeError(error, `Failed to remove label ${label}.`, false)
    }
  }

  async createOrUpdateCheck(owner: string, repo: string, headSha: string, input: CheckRunInput): Promise<void> {
    try {
      const existing = await this.octokit.rest.checks.listForRef({
        owner,
        repo,
        ref: headSha,
        check_name: input.name,
        per_page: 100
      })
      const checkRuns = existing.data.check_runs
        .filter((run) => run.name === input.name)
        .sort((a, b) => checkRunTimestamp(b) - checkRunTimestamp(a))
      const checkRun =
        input.status === 'completed'
          ? checkRuns.find((run) => run.status !== 'completed') ?? checkRuns[0]
          : checkRuns.find((run) => run.status !== 'completed')
      const output = { title: input.title, summary: input.summary }

      if (checkRun) {
        const updateParams: Record<string, unknown> = {
          owner,
          repo,
          check_run_id: checkRun.id,
          status: input.status,
          output
        }
        if (input.conclusion) updateParams.conclusion = input.conclusion
        await this.octokit.rest.checks.update(updateParams as never)
      } else {
        const createParams: Record<string, unknown> = {
          owner,
          repo,
          name: input.name,
          head_sha: headSha,
          status: input.status,
          output
        }
        if (input.conclusion) createParams.conclusion = input.conclusion
        await this.octokit.rest.checks.create(createParams as never)
      }
    } catch (error) {
      throw normalizeError(error, 'Failed to create or update check run.')
    }
  }

  async markPullRequestDraft(prNodeId: string): Promise<void> {
    try {
      await this.octokit.graphql(
        `mutation ConvertOpenchaPrToDraft($pullRequestId: ID!) {
          convertPullRequestToDraft(input: { pullRequestId: $pullRequestId }) {
            pullRequest { isDraft }
          }
        }`,
        { pullRequestId: prNodeId }
      )
    } catch (error) {
      throw normalizeError(error, 'Failed to convert pull request to draft.', false)
    }
  }

  async markPullRequestReady(prNodeId: string): Promise<void> {
    try {
      await this.octokit.graphql(
        `mutation MarkOpenchaPrReady($pullRequestId: ID!) {
          markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
            pullRequest { isDraft }
          }
        }`,
        { pullRequestId: prNodeId }
      )
    } catch (error) {
      throw normalizeError(error, 'Failed to mark pull request ready for review.', false)
    }
  }

  async readFile(owner: string, repo: string, path: string, ref: string): Promise<string | null> {
    try {
      const response = await this.octokit.rest.repos.getContent({ owner, repo, path, ref })
      const data = response.data
      if (Array.isArray(data) || data.type !== 'file' || !('content' in data)) {
        return null
      }
      return Buffer.from(data.content, 'base64').toString('utf8')
    } catch (error) {
      if (statusOf(error) === 404) return null
      throw normalizeError(error, `Failed to read file ${path}.`)
    }
  }

  async ensureBranch(owner: string, repo: string, branch: string, baseRef: string): Promise<void> {
    try {
      await this.octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`
      })
      return
    } catch (error) {
      if (statusOf(error) !== 404) {
        throw normalizeError(error, `Failed to read branch ${branch}.`)
      }
    }

    try {
      const base = await this.octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${baseRef}`
      })
      await this.octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: base.data.object.sha
      })
    } catch (error) {
      if (statusOf(error) === 422) return
      throw normalizeError(error, `Failed to create branch ${branch}.`)
    }
  }

  async writeFile(
    owner: string,
    repo: string,
    branch: string,
    path: string,
    bytes: Uint8Array,
    message: string
  ): Promise<void> {
    const existingSha = await this.getFileSha(owner, repo, branch, path)
    try {
      const params: Record<string, unknown> = {
        owner,
        repo,
        path,
        branch,
        message,
        content: Buffer.from(bytes).toString('base64')
      }
      if (existingSha) params.sha = existingSha
      await this.octokit.rest.repos.createOrUpdateFileContents(params as never)
    } catch (error) {
      throw normalizeError(error, `Failed to write file ${path}.`)
    }
  }

  async deleteFile(owner: string, repo: string, branch: string, path: string, message: string): Promise<void> {
    const existingSha = await this.getFileSha(owner, repo, branch, path)
    if (!existingSha) return
    try {
      await this.octokit.rest.repos.deleteFile({
        owner,
        repo,
        path,
        branch,
        message,
        sha: existingSha
      })
    } catch (error) {
      if (statusOf(error) === 404) return
      throw normalizeError(error, `Failed to delete file ${path}.`, false)
    }
  }

  private async getFileSha(owner: string, repo: string, branch: string, path: string): Promise<string | null> {
    try {
      const response = await this.octokit.rest.repos.getContent({ owner, repo, path, ref: branch })
      const data = response.data
      if (Array.isArray(data) || data.type !== 'file' || !('sha' in data)) return null
      return data.sha
    } catch (error) {
      if (statusOf(error) === 404) return null
      throw normalizeError(error, `Failed to read file ${path}.`)
    }
  }
}

function toIssueComment(comment: {
  id: number
  node_id?: string
  body?: string | null
  user?: { login?: string | null } | null
  created_at?: string
  updated_at?: string
}): IssueComment {
  return {
    id: comment.id,
    nodeId: comment.node_id ?? '',
    body: comment.body ?? '',
    author: comment.user?.login ?? '',
    createdAt: comment.created_at ?? '',
    updatedAt: comment.updated_at ?? ''
  }
}

function normalizePermission(permission: string): RepositoryPermission {
  if (permission === 'admin' || permission === 'maintain' || permission === 'write' || permission === 'triage' || permission === 'read') {
    return permission
  }
  return 'none'
}

function checkRunTimestamp(run: { started_at: string | null; completed_at: string | null }): number {
  const timestamp = run.started_at ?? run.completed_at
  return timestamp ? Date.parse(timestamp) : 0
}

function normalizeError(error: unknown, fallback: string, hard = true): GitHubGatewayError {
  const status = statusOf(error)
  if (status === 404) return new NotFoundError(fallback)
  const suffix = error instanceof Error && error.message ? ` ${error.message}` : ''
  return new GitHubGatewayError(`${fallback}${suffix}`, 'github_gateway_error', hard)
}

function statusOf(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status
    return typeof status === 'number' ? status : undefined
  }
  return undefined
}

import type { ActionInputs } from '../src/action/inputs'
import { ActionRunReport } from '../src/action/result'
import { handleIssueCommentEvent } from '../src/app/comment-flow'
import { handlePullRequestEvent } from '../src/app/pr-flow'
import { loadChallengeState } from '../src/app/state'
import { createChallenge } from '../src/challenge/generate'
import { TEMPORAL_POINTER_CHALLENGE_VERSION, TEMPORAL_POINTER_KIND } from '../src/challenge/types'
import type { CheckRunInput, GitHubGateway, IssueComment, PullRequestInfo, RepositoryPermission } from '../src/github/gateway'

describe('OpenCHA flows', () => {
  const inputs: ActionInputs = {
    githubToken: 'token',
    openchaSecret: 'x'.repeat(40)
  }

  it('gates an untrusted PR, then passes with the PR author answer', async () => {
    const gateway = new FakeGateway()
    const report = new ActionRunReport()

    await handlePullRequestEvent({
      event: prEvent('opened'),
      gateway,
      inputs,
      report
    })

    expect(gateway.pr.isDraft).toBe(true)
    expect(gateway.labels).toContain('opencha: verifying')
    expect(gateway.latestCheck()?.status).toBe('in_progress')
    expect(gateway.files.size).toBe(1)

    const state = await loadChallengeState(gateway, inputs, gateway.pr)
    expect(state.kind).toBe('active')
    if (state.kind !== 'active') throw new Error('expected active state')

    const answer = createChallenge({
      seed: state.payload.seed,
      answerSalt: state.payload.answerSalt
    }).display.answer

    const answerComment = await gateway.createIssueComment('owner', 'repo', 1, `/opencha answer ${answer}`)
    await handleIssueCommentEvent({
      event: commentEvent(`/opencha answer ${answer}`, 'outside', answerComment),
      gateway,
      inputs,
      report
    })

    const passed = await loadChallengeState(gateway, inputs, gateway.pr)
    expect(passed.kind).toBe('passed')
    expect(gateway.pr.isDraft).toBe(false)
    expect(gateway.labels).not.toContain('opencha: verifying')
    expect(gateway.latestCheck()?.conclusion).toBe('success')
    expect(gateway.comments.some((comment) => comment.body.includes('## ✅ OpenCHA passed'))).toBe(true)
    expect(gateway.minimizedNodeIds.size).toBeGreaterThanOrEqual(1)
    expect(gateway.files.size).toBe(1)
  })

  it('blocks answer attempts while cooldown is active', async () => {
    const gateway = new FakeGateway({ config: 'challenge:\n  max_attempts: 3\n  cooldown_seconds: 30\n' })
    const report = new ActionRunReport()

    await handlePullRequestEvent({ event: prEvent('opened'), gateway, inputs, report })
    await handleIssueCommentEvent({
      event: commentEvent('/opencha answer WRONG', 'outside'),
      gateway,
      inputs,
      report
    })

    let state = await loadChallengeState(gateway, inputs, gateway.pr)
    expect(state.kind).toBe('active')
    if (state.kind !== 'active') throw new Error('expected active state')
    expect(state.payload.attempts).toBe(1)

    await handleIssueCommentEvent({
      event: commentEvent('/opencha answer WRONG', 'outside'),
      gateway,
      inputs,
      report
    })

    state = await loadChallengeState(gateway, inputs, gateway.pr)
    expect(state.kind).toBe('active')
    if (state.kind !== 'active') throw new Error('expected active state')
    expect(state.payload.attempts).toBe(1)

  })

  it('issues temporal pointer challenges when legacy code count config is present', async () => {
    const gateway = new FakeGateway({ config: 'challenge:\n  code_count: 7\n' })
    const report = new ActionRunReport()

    await handlePullRequestEvent({ event: prEvent('opened'), gateway, inputs, report })

    const state = await loadChallengeState(gateway, inputs, gateway.pr)
    expect(state.kind).toBe('active')
    if (state.kind !== 'active') throw new Error('expected active state')
    expect(state.payload.challengeVersion).toBe(TEMPORAL_POINTER_CHALLENGE_VERSION)
    if (!('kind' in state.payload.challengeParams)) {
      throw new Error('expected temporal pointer params')
    }
    expect(state.payload.challengeParams).toMatchObject({
      kind: TEMPORAL_POINTER_KIND,
      ringSize: 18
    })
    expect(state.payload.challengeParams.captureCount).toBe(state.payload.challengeParams.codeLength)
  })

  it('requires maintainer after max attempts', async () => {
    const gateway = new FakeGateway({ config: 'challenge:\n  max_attempts: 2\n  cooldown_seconds: 0\n' })
    const report = new ActionRunReport()

    await handlePullRequestEvent({ event: prEvent('opened'), gateway, inputs, report })
    await handleIssueCommentEvent({ event: commentEvent('/opencha answer WRONG', 'outside'), gateway, inputs, report })
    await handleIssueCommentEvent({ event: commentEvent('/opencha answer WRONG', 'outside'), gateway, inputs, report })

    const state = await loadChallengeState(gateway, inputs, gateway.pr)
    expect(state.kind).toBe('exceeded')
    expect(gateway.labels).toContain('opencha: needs maintainer')
    expect(gateway.latestCheck()?.conclusion).toBe('failure')
  })

  it('lets a maintainer reset and approve a challenge', async () => {
    const gateway = new FakeGateway()
    const report = new ActionRunReport()

    await handlePullRequestEvent({ event: prEvent('opened'), gateway, inputs, report })
    const firstState = await loadChallengeState(gateway, inputs, gateway.pr)
    expect(firstState.kind).toBe('active')

    await handleIssueCommentEvent({
      event: commentEvent('/opencha reset', 'maintainer'),
      gateway,
      inputs,
      report
    })

    const resetState = await loadChallengeState(gateway, inputs, gateway.pr)
    expect(resetState.kind).toBe('active')
    if (firstState.kind !== 'active' || resetState.kind !== 'active') throw new Error('expected active states')
    expect(resetState.payload.challengeId).not.toBe(firstState.payload.challengeId)

    await handleIssueCommentEvent({
      event: commentEvent('/opencha approve', 'maintainer'),
      gateway,
      inputs,
      report
    })

    const passed = await loadChallengeState(gateway, inputs, gateway.pr)
    expect(passed.kind).toBe('passed')
    if (passed.kind !== 'passed') throw new Error('expected passed state')
    expect(passed.payload.passMethod).toBe('approve')
    expect(passed.payload.passedBy).toBe('maintainer')
    expect(gateway.comments.some((comment) => comment.body.includes('Maintainer @maintainer approved this PR.'))).toBe(true)
  })

  it('does not let a trusted maintainer pass with answer command', async () => {
    const gateway = new FakeGateway()
    gateway.pr = { ...gateway.pr, author: 'maintainer' }
    const report = new ActionRunReport()

    await handleIssueCommentEvent({
      event: commentEvent('/opencha reset', 'maintainer'),
      gateway,
      inputs,
      report
    })

    const state = await loadChallengeState(gateway, inputs, gateway.pr)
    expect(state.kind).toBe('active')
    if (state.kind !== 'active') throw new Error('expected active state')

    const answer = createChallenge({
      seed: state.payload.seed,
      answerSalt: state.payload.answerSalt
    }).display.answer

    await handleIssueCommentEvent({
      event: commentEvent(`/opencha answer ${answer}`, 'maintainer'),
      gateway,
      inputs,
      report
    })

    const afterAnswer = await loadChallengeState(gateway, inputs, gateway.pr)
    expect(afterAnswer.kind).toBe('active')
  })
})

function prEvent(action: string) {
  return {
    kind: 'pr' as const,
    action,
    owner: 'owner',
    repo: 'repo',
    prNumber: 1,
    baseRef: 'main',
    headSha: 'head-sha',
    author: 'outside',
    isDraft: false
  }
}

function commentEvent(body: string, actor: string, comment?: IssueComment) {
  return {
    kind: 'comment' as const,
    action: 'created' as const,
    owner: 'owner',
    repo: 'repo',
    prNumber: 1,
    commentId: comment?.id ?? 999,
    commentNodeId: comment?.nodeId ?? `COMMENT_${Math.random()}`,
    body,
    actor
  }
}

class FakeGateway implements GitHubGateway {
  pr: PullRequestInfo = {
    number: 1,
    nodeId: 'PR_1',
    author: 'outside',
    baseOwner: 'owner',
    baseRepo: 'repo',
    baseRef: 'main',
    headSha: 'head-sha',
    isDraft: false
  }

  readonly labels = new Set<string>()
  readonly comments: IssueComment[] = []
  readonly files = new Map<string, Uint8Array>()
  readonly minimizedNodeIds = new Set<string>()
  readonly checks: CheckRunInput[] = []
  private commentId = 1

  constructor(private readonly options: { config?: string } = {}) {}

  latestCheck(): CheckRunInput | undefined {
    return this.checks.at(-1)
  }

  async getRepositoryPermission(_owner: string, _repo: string, username: string): Promise<RepositoryPermission> {
    return username === 'maintainer' ? 'write' : 'none'
  }

  async getPullRequest(): Promise<PullRequestInfo> {
    return { ...this.pr }
  }

  async listIssueComments(): Promise<IssueComment[]> {
    return [...this.comments]
  }

  async createIssueComment(_owner: string, _repo: string, _issueNumber: number, body: string): Promise<IssueComment> {
    const comment = this.makeComment(body)
    this.comments.push(comment)
    return comment
  }

  async updateIssueComment(_owner: string, _repo: string, commentId: number, body: string): Promise<IssueComment> {
    const index = this.comments.findIndex((comment) => comment.id === commentId)
    if (index === -1) throw new Error(`missing comment ${commentId}`)
    const updated = { ...this.comments[index]!, body, updatedAt: new Date().toISOString() }
    this.comments[index] = updated
    return updated
  }

  async minimizeComment(commentNodeId: string): Promise<void> {
    this.minimizedNodeIds.add(commentNodeId)
  }

  async ensureLabel(): Promise<void> {}

  async addLabels(_owner: string, _repo: string, _issueNumber: number, labels: string[]): Promise<void> {
    for (const label of labels) this.labels.add(label)
  }

  async removeLabel(_owner: string, _repo: string, _issueNumber: number, label: string): Promise<void> {
    this.labels.delete(label)
  }

  async createOrUpdateCheck(_owner: string, _repo: string, _headSha: string, input: CheckRunInput): Promise<void> {
    this.checks.push(input)
  }

  async markPullRequestDraft(): Promise<void> {
    this.pr = { ...this.pr, isDraft: true }
  }

  async markPullRequestReady(): Promise<void> {
    this.pr = { ...this.pr, isDraft: false }
  }

  async readFile(_owner: string, _repo: string, path: string): Promise<string | null> {
    if (path === '.github/opencha.yml') return this.options.config ?? null
    return null
  }

  async ensureBranch(): Promise<void> {}

  async writeFile(
    _owner: string,
    _repo: string,
    branch: string,
    path: string,
    bytes: Uint8Array
  ): Promise<void> {
    this.files.set(`${branch}:${path}`, bytes)
  }

  async deleteFile(_owner: string, _repo: string, branch: string, path: string): Promise<void> {
    this.files.delete(`${branch}:${path}`)
  }

  private makeComment(body: string): IssueComment {
    const id = this.commentId++
    return {
      id,
      nodeId: `COMMENT_${id}`,
      body,
      author: 'github-actions[bot]',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }
}

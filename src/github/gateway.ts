export type RepositoryPermission = 'admin' | 'maintain' | 'write' | 'triage' | 'read' | 'none'

export interface PullRequestInfo {
  number: number
  nodeId: string
  author: string
  baseOwner: string
  baseRepo: string
  baseRef: string
  headSha: string
  isDraft: boolean
}

export interface IssueComment {
  id: number
  nodeId: string
  body: string
  author: string
  createdAt: string
  updatedAt: string
}

export interface CheckRunInput {
  name: string
  status: 'queued' | 'in_progress' | 'completed'
  conclusion?: 'success' | 'failure' | 'neutral' | undefined
  title: string
  summary: string
}

export interface GitHubGateway {
  getRepositoryPermission(owner: string, repo: string, username: string): Promise<RepositoryPermission>
  getPullRequest(owner: string, repo: string, prNumber: number): Promise<PullRequestInfo>
  listIssueComments(owner: string, repo: string, issueNumber: number): Promise<IssueComment[]>
  createIssueComment(owner: string, repo: string, issueNumber: number, body: string): Promise<IssueComment>
  updateIssueComment(owner: string, repo: string, commentId: number, body: string): Promise<IssueComment>
  minimizeComment(commentNodeId: string, classifier?: 'OUTDATED' | 'RESOLVED'): Promise<void>
  ensureLabel(owner: string, repo: string, name: string, color: string, description: string): Promise<void>
  addLabels(owner: string, repo: string, issueNumber: number, labels: string[]): Promise<void>
  removeLabel(owner: string, repo: string, issueNumber: number, label: string): Promise<void>
  createOrUpdateCheck(owner: string, repo: string, headSha: string, input: CheckRunInput): Promise<void>
  markPullRequestDraft(prNodeId: string): Promise<void>
  markPullRequestReady(prNodeId: string): Promise<void>
  readFile(owner: string, repo: string, path: string, ref: string): Promise<string | null>
  ensureBranch(owner: string, repo: string, branch: string, baseRef: string): Promise<void>
  writeFile(owner: string, repo: string, branch: string, path: string, bytes: Uint8Array, message: string): Promise<void>
  deleteFile(owner: string, repo: string, branch: string, path: string, message: string): Promise<void>
}

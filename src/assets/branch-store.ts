import type { GitHubGateway } from '../github/gateway'
import type { ChallengeAssetStore } from './store'

export interface BranchAssetRef {
  backend: 'branch'
  branch: string
  path: string
}

export class GitBranchAssetStore implements ChallengeAssetStore {
  constructor(
    private readonly gateway: GitHubGateway,
    private readonly branch: string,
    private readonly baseRef: string
  ) {}

  async put(input: {
    owner: string
    repo: string
    prNumber: number
    challengeId: string
    filename: string
    contentType: string
    bytes: Uint8Array
  }): Promise<{ url: string; assetRef: string }> {
    await this.gateway.ensureBranch(input.owner, input.repo, this.branch, this.baseRef)
    const path = `pr-${input.prNumber}/challenge-${shortId(input.challengeId)}.gif`
    await this.gateway.writeFile(
      input.owner,
      input.repo,
      this.branch,
      path,
      input.bytes,
      `OpenCHA challenge asset for PR #${input.prNumber}`
    )

    const encodedPath = path.split('/').map(encodeURIComponent).join('/')
    return {
      url: `https://raw.githubusercontent.com/${input.owner}/${input.repo}/${encodeURIComponent(this.branch)}/${encodedPath}`,
      assetRef: JSON.stringify({ backend: 'branch', branch: this.branch, path } satisfies BranchAssetRef)
    }
  }

  async delete(input: { owner: string; repo: string; assetRef: string }): Promise<void> {
    const ref = parseAssetRef(input.assetRef)
    if (!ref) return
    await this.gateway.deleteFile(input.owner, input.repo, ref.branch, ref.path, 'Remove OpenCHA challenge asset')
  }
}

export function parseAssetRef(value: string): BranchAssetRef | null {
  try {
    const parsed = JSON.parse(value) as Partial<BranchAssetRef>
    if (parsed.backend === 'branch' && typeof parsed.branch === 'string' && typeof parsed.path === 'string') {
      return { backend: 'branch', branch: parsed.branch, path: parsed.path }
    }
  } catch {
    return null
  }
  return null
}

function shortId(challengeId: string): string {
  return challengeId.replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || 'challenge'
}

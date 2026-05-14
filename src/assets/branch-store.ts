import type { GitHubGateway } from '../github/gateway'
import type { ChallengeAssetStore } from './store'

export interface BranchAssetRef {
  backend: 'branch'
  branch: string
  path: string
}

export interface BranchAssetBundleRef {
  backend: 'branch-bundle'
  refs: BranchAssetRef[]
}

export type BranchAssetReference = BranchAssetRef | BranchAssetBundleRef

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
    const path = `pr-${input.prNumber}/${safeFilename(input.filename, input.challengeId)}`
    await this.gateway.writeFile(
      input.owner,
      input.repo,
      this.branch,
      path,
      input.bytes,
      `OpenCHA challenge asset for PR #${input.prNumber}`
    )

    const encodedPath = path.split('/').map(encodeURIComponent).join('/')
    const encodedOwner = encodeURIComponent(input.owner)
    const encodedRepo = encodeURIComponent(input.repo)
    const encodedBranch = encodeURIComponent(this.branch)
    return {
      url: `https://github.com/${encodedOwner}/${encodedRepo}/raw/${encodedBranch}/${encodedPath}`,
      assetRef: JSON.stringify({ backend: 'branch', branch: this.branch, path } satisfies BranchAssetRef)
    }
  }

  async delete(input: { owner: string; repo: string; assetRef: string }): Promise<void> {
    const ref = parseAssetRef(input.assetRef)
    if (!ref) return
    const refs = ref.backend === 'branch-bundle' ? ref.refs : [ref]
    for (const asset of refs) {
      await this.gateway.deleteFile(input.owner, input.repo, asset.branch, asset.path, 'Remove OpenCHA challenge asset')
    }
  }
}

export function parseAssetRef(value: string): BranchAssetReference | null {
  try {
    const parsed = JSON.parse(value) as Partial<BranchAssetReference>
    if (parsed.backend === 'branch' && typeof parsed.branch === 'string' && typeof parsed.path === 'string') {
      return { backend: 'branch', branch: parsed.branch, path: parsed.path }
    }
    if (parsed.backend === 'branch-bundle' && Array.isArray(parsed.refs)) {
      const refs = parsed.refs.flatMap((ref) => {
        if (ref.backend === 'branch' && typeof ref.branch === 'string' && typeof ref.path === 'string') {
          return [{ backend: 'branch' as const, branch: ref.branch, path: ref.path }]
        }
        return []
      })
      if (refs.length === parsed.refs.length) return { backend: 'branch-bundle', refs }
    }
  } catch {
    return null
  }
  return null
}

export function bundleAssetRefs(assetRefs: readonly string[]): string {
  const refs = assetRefs.flatMap((assetRef) => {
    const parsed = parseAssetRef(assetRef)
    if (!parsed) return []
    return parsed.backend === 'branch-bundle' ? parsed.refs : [parsed]
  })

  return JSON.stringify({ backend: 'branch-bundle', refs } satisfies BranchAssetBundleRef)
}

function shortId(challengeId: string): string {
  return challengeId.replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || 'challenge'
}

function safeFilename(filename: string, challengeId: string): string {
  const normalized = filename.replace(/[^A-Za-z0-9._-]/g, '-').replace(/^-+|-+$/g, '')
  return normalized || `challenge-${shortId(challengeId)}.gif`
}

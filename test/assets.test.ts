import { GitBranchAssetStore, parseAssetRef } from '../src/assets/branch-store'
import type { GitHubGateway } from '../src/github/gateway'

describe('branch asset store', () => {
  it('stores assets on a configured branch and returns raw URLs', async () => {
    const calls: string[] = []
    const gateway = {
      ensureBranch: async () => { calls.push('ensureBranch') },
      writeFile: async (_owner: string, _repo: string, branch: string, path: string) => {
        calls.push(`${branch}:${path}`)
      }
    } as unknown as GitHubGateway
    const store = new GitBranchAssetStore(gateway, 'opencha-assets', 'main')

    const result = await store.put({
      owner: 'owner',
      repo: 'repo',
      prNumber: 123,
      challengeId: 'abc-123',
      filename: 'ignored.gif',
      contentType: 'image/gif',
      bytes: new Uint8Array([1, 2, 3])
    })

    expect(calls).toEqual(['ensureBranch', 'opencha-assets:pr-123/challenge-abc123.gif'])
    expect(result.url).toBe('https://raw.githubusercontent.com/owner/repo/opencha-assets/pr-123/challenge-abc123.gif')
    expect(parseAssetRef(result.assetRef)).toEqual({
      backend: 'branch',
      branch: 'opencha-assets',
      path: 'pr-123/challenge-abc123.gif'
    })
  })
})

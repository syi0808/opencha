export interface ChallengeAssetStore {
  put(input: {
    owner: string
    repo: string
    prNumber: number
    challengeId: string
    filename: string
    contentType: string
    bytes: Uint8Array
  }): Promise<{ url: string; assetRef: string }>

  delete(input: {
    owner: string
    repo: string
    assetRef: string
  }): Promise<void>
}

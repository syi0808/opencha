import type { ActionInputs } from '../action/inputs'
import { decryptJson, encryptJson } from '../crypto/envelope'
import { derivePayloadKey } from '../crypto/keys'
import { PayloadDecryptError } from '../errors'
import type { GitHubGateway, IssueComment, PullRequestInfo } from '../github/gateway'
import { extractEncryptedPayload } from '../state/comments'
import { parseChallengePayload, PAYLOAD_PURPOSE, type ChallengePayload } from '../state/payload'

export type LoadedChallengeState =
  | { kind: 'none' }
  | { kind: 'active'; comment: IssueComment; payload: ChallengePayload }
  | { kind: 'passed'; comment: IssueComment; payload: ChallengePayload }
  | { kind: 'exceeded'; comment: IssueComment; payload: ChallengePayload }
  | { kind: 'corrupted'; comment: IssueComment; error: Error }

export async function loadChallengeState(
  gateway: GitHubGateway,
  inputs: ActionInputs,
  pr: PullRequestInfo
): Promise<LoadedChallengeState> {
  const comments = await gateway.listIssueComments(pr.baseOwner, pr.baseRepo, pr.number)
  const markerComments = comments
    .filter((comment) => comment.body.includes('<!-- opencha:challenge -->'))
    .sort((a, b) => b.id - a.id)

  for (const comment of markerComments) {
    const token = extractEncryptedPayload(comment.body)
    if (!token) continue

    try {
      const payload = parseChallengePayload(decryptPayload(token, inputs, pr))
      if (payload.passed) return { kind: 'passed', comment, payload }
      if (payload.exceeded) return { kind: 'exceeded', comment, payload }
      return { kind: 'active', comment, payload }
    } catch (error) {
      return {
        kind: 'corrupted',
        comment,
        error: error instanceof Error ? error : new PayloadDecryptError()
      }
    }
  }

  return { kind: 'none' }
}

export function encryptPayload(payload: ChallengePayload, inputs: ActionInputs, pr: PullRequestInfo): string {
  const key = derivePayloadKey(inputs.openchaSecret, { owner: pr.baseOwner, repo: pr.baseRepo })
  return encryptJson(payload, key, {
    owner: pr.baseOwner,
    repo: pr.baseRepo,
    prNumber: pr.number,
    purpose: PAYLOAD_PURPOSE
  })
}

export function decryptPayload(token: string, inputs: ActionInputs, pr: PullRequestInfo): unknown {
  const key = derivePayloadKey(inputs.openchaSecret, { owner: pr.baseOwner, repo: pr.baseRepo })
  return decryptJson(token, key, {
    owner: pr.baseOwner,
    repo: pr.baseRepo,
    prNumber: pr.number,
    purpose: PAYLOAD_PURPOSE
  })
}

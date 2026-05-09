export function isChallengeIssuanceEvent(action: string): boolean {
  return action === 'opened' || action === 'reopened'
}

export function isEnforcementEvent(action: string): boolean {
  return action === 'ready_for_review' || action === 'unlabeled' || action === 'synchronize'
}

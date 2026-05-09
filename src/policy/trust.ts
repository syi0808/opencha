import type { OpenchaConfig } from '../config/defaults'
import type { RepositoryPermission } from '../github/gateway'

export type TrustDecision =
  | { trusted: true; reason: 'permission' | 'trusted_user' | 'trusted_bot' }
  | { trusted: false; reason: 'permission' | 'lookup_failed' }

export function decideTrust(input: {
  actor: string
  permission: RepositoryPermission | null
  permissionLookupFailed?: boolean
  config: OpenchaConfig
}): TrustDecision {
  if (input.permissionLookupFailed) {
    return { trusted: false, reason: 'lookup_failed' }
  }

  if (input.permission === 'admin' || input.permission === 'maintain' || input.permission === 'write') {
    return { trusted: true, reason: 'permission' }
  }

  if (containsLogin(input.config.trustedUsers, input.actor)) {
    return { trusted: true, reason: 'trusted_user' }
  }

  if (containsLogin(input.config.trustedBots, input.actor)) {
    return { trusted: true, reason: 'trusted_bot' }
  }

  return { trusted: false, reason: 'permission' }
}

export function containsLogin(values: readonly string[], login: string): boolean {
  return values.some((value) => value.toLowerCase() === login.toLowerCase())
}

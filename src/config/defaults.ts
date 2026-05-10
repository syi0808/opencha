import { CODE_COUNT_DEFAULT } from '../challenge/types'

export const DEFAULT_TRUSTED_BOTS = [
  'dependabot[bot]',
  'renovate[bot]',
  'github-actions[bot]',
  'pre-commit-ci[bot]'
] as const

export interface OpenchaConfig {
  trustedUsers: string[]
  trustedBots: string[]
  labels: {
    verifying: string
    needsMaintainer: string
  }
  challenge: {
    codeCount: number
    maxAttempts: number
    cooldownSeconds: number
    rotateOnWrongAnswer: boolean
  }
  assets: {
    branch: string
    cleanupPassedAssets: boolean
  }
  policy: {
    reverifyOnPush: boolean
  }
}

export const DEFAULT_CONFIG: OpenchaConfig = {
  trustedUsers: [],
  trustedBots: [...DEFAULT_TRUSTED_BOTS],
  labels: {
    verifying: 'opencha: verifying',
    needsMaintainer: 'opencha: needs maintainer'
  },
  challenge: {
    codeCount: CODE_COUNT_DEFAULT,
    maxAttempts: 5,
    cooldownSeconds: 30,
    rotateOnWrongAnswer: false
  },
  assets: {
    branch: 'opencha-assets',
    cleanupPassedAssets: true
  },
  policy: {
    reverifyOnPush: false
  }
}

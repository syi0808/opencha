import type * as core from '@actions/core'
import { ConfigError } from '../errors'

export interface ActionInputs {
  githubToken: string
  openchaSecret: string
}

export interface CoreInputApi {
  getInput(name: string, options?: core.InputOptions): string
  setSecret(secret: string): void
}

export function readActionInputs(coreApi: CoreInputApi): ActionInputs {
  const githubToken = coreApi.getInput('github-token', { required: true }).trim()
  const openchaSecret = coreApi.getInput('opencha-secret', { required: true })
  coreApi.setSecret(openchaSecret)

  if (openchaSecret.length < 32) {
    throw new ConfigError('OpenCHA is not configured correctly: opencha-secret must be at least 32 characters.')
  }

  return { githubToken, openchaSecret }
}

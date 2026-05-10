import type * as core from '@actions/core'

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
  const openchaSecret = coreApi.getInput('opencha-secret', { required: true, trimWhitespace: false })
  coreApi.setSecret(openchaSecret)

  return { githubToken, openchaSecret }
}

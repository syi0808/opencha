import YAML from 'yaml'
import type { ActionRunReport } from '../action/result'
import type { GitHubGateway } from '../github/gateway'
import { DEFAULT_CONFIG, type OpenchaConfig } from './defaults'
import { parseOpenchaConfig } from './schema'

export interface ConfigRepoRef {
  owner: string
  repo: string
  ref: string
}

export async function loadOpenchaConfig(
  gateway: GitHubGateway,
  repoRef: ConfigRepoRef,
  report: ActionRunReport
): Promise<OpenchaConfig> {
  const content = await gateway.readFile(repoRef.owner, repoRef.repo, '.github/opencha.yml', repoRef.ref)

  if (content === null) {
    return DEFAULT_CONFIG
  }

  const raw = YAML.parse(content)
  const parsed = parseOpenchaConfig(raw)
  for (const warning of parsed.warnings) {
    report.warn(warning)
  }

  return parsed.config
}

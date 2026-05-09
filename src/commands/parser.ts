import type { OpenchaCommand } from './types'

export function parseOpenchaCommand(body: string): OpenchaCommand {
  const firstLine = body.split(/\r?\n/, 1)[0]?.trim() ?? ''
  if (!firstLine.startsWith('/opencha')) {
    return { kind: 'none' }
  }

  const [, subcommand, rest = ''] = firstLine.match(/^\/opencha(?:\s+(\S+)(?:\s+(.+))?)?$/) ?? []
  if (!subcommand) {
    return { kind: 'unknown', name: '' }
  }

  if (subcommand === 'answer') {
    const answer = rest.trim()
    return answer ? { kind: 'answer', answer } : { kind: 'unknown', name: 'answer' }
  }

  if (subcommand === 'approve') {
    return { kind: 'approve' }
  }

  if (subcommand === 'reset') {
    return { kind: 'reset' }
  }

  return { kind: 'unknown', name: subcommand }
}

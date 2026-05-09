import { parseOpenchaCommand } from '../src/commands/parser'

describe('OpenCHA command parser', () => {
  it('parses supported commands from the first line', () => {
    expect(parseOpenchaCommand('/opencha answer Ab C1')).toEqual({ kind: 'answer', answer: 'Ab C1' })
    expect(parseOpenchaCommand('/opencha approve')).toEqual({ kind: 'approve' })
    expect(parseOpenchaCommand('/opencha reset')).toEqual({ kind: 'reset' })
  })

  it('ignores non-first-line commands and unknown subcommands', () => {
    expect(parseOpenchaCommand('hello\n/opencha answer ABCD')).toEqual({ kind: 'none' })
    expect(parseOpenchaCommand('/opencha retry')).toEqual({ kind: 'unknown', name: 'retry' })
  })
})

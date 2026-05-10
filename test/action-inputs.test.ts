import { readActionInputs, type CoreInputApi } from '../src/action/inputs'

describe('action inputs', () => {
  it('accepts opencha-secret without a minimum length', () => {
    const masked: string[] = []
    const optionsByName = new Map<string, unknown>()
    const coreApi: CoreInputApi = {
      getInput: (name, options) => {
        optionsByName.set(name, options)
        if (name === 'github-token') return ' token '
        if (name === 'opencha-secret') return ' x '
        throw new Error(`Unexpected input ${name}`)
      },
      setSecret: (secret) => masked.push(secret)
    }

    expect(readActionInputs(coreApi)).toEqual({
      githubToken: 'token',
      openchaSecret: ' x '
    })
    expect(masked).toEqual([' x '])
    expect(optionsByName.get('opencha-secret')).toEqual({ required: true, trimWhitespace: false })
  })
})

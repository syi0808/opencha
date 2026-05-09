import { ConfigError } from '../src/errors'
import { DEFAULT_TRUSTED_BOTS } from '../src/config/defaults'
import { parseOpenchaConfig } from '../src/config/schema'

describe('OpenCHA config', () => {
  it('uses defaults and merges trusted bots', () => {
    const parsed = parseOpenchaConfig({
      trusted_bots: ['my-bot[bot]']
    })

    expect(parsed.config.trustedBots).toEqual([...DEFAULT_TRUSTED_BOTS, 'my-bot[bot]'])
    expect(parsed.config.challenge.maxAttempts).toBe(5)
    expect(parsed.config.assets.branch).toBe('opencha-assets')
  })

  it('warns for unknown fields without failing', () => {
    const parsed = parseOpenchaConfig({
      challange: {},
      challenge: {
        max_attempts: 3,
        typo: true
      }
    })

    expect(parsed.config.challenge.maxAttempts).toBe(3)
    expect(parsed.warnings).toContain('Unknown OpenCHA config field ignored: challange')
    expect(parsed.warnings).toContain('Unknown OpenCHA config field ignored: challenge.typo')
  })

  it('fails closed for invalid known values', () => {
    expect(() => parseOpenchaConfig({ challenge: { max_attempts: -1 } })).toThrow(ConfigError)
  })
})

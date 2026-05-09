import { extractEncryptedPayload, renderChallengeComment, renderPassedChallengeComment } from '../src/state/comments'
import type { ChallengePayload } from '../src/state/payload'

describe('OpenCHA comments', () => {
  it('extracts encrypted payload markers', () => {
    expect(extractEncryptedPayload('<!-- opencha:challenge -->\n<!-- opencha:payload abc_DEF-123 -->')).toBe('abc_DEF-123')
    expect(extractEncryptedPayload('normal comment')).toBeNull()
  })

  it('renders challenge and passed comments without leaking internals', () => {
    const payload = samplePayload()
    const body = renderChallengeComment({
      assetUrl: 'https://raw.githubusercontent.com/o/r/opencha-assets/pr-1/challenge-abc.gif',
      targetIndex: 3,
      payload,
      encryptedPayload: 'encrypted',
      now: new Date('2026-01-01T00:00:00.000Z')
    })

    expect(body).toContain('/opencha answer YOUR_CODE')
    expect(body).toContain('Enter the 3rd code')
    expect(body).not.toContain(payload.answerHash)
    expect(renderPassedChallengeComment({ ...payload, passed: true, passedBy: 'alice' }, 'encrypted')).toContain(
      'passed by @alice'
    )
  })
})

function samplePayload(): ChallengePayload {
  return {
    schema: 1,
    challengeId: 'challenge',
    challengeVersion: 1,
    seed: 'seed',
    challengeParams: {
      length: 5,
      decoyCount: 4,
      animationFrames: 8,
      charset: 'ABCDEFGHJKLMNPQRTUVWXY346789',
      noiseLevel: 'medium',
      targetIndex: 3
    },
    answerSalt: 'salt',
    answerHash: 'hash',
    attempts: 1,
    maxAttempts: 5,
    cooldownSeconds: 30,
    cooldownUntil: null,
    issuedAt: '2026-01-01T00:00:00.000Z',
    passed: false,
    passedAt: null,
    passedBy: null,
    passMethod: null,
    draftedByOpencha: true,
    asset: {
      url: 'https://raw.githubusercontent.com/o/r/opencha-assets/pr-1/challenge-abc.gif',
      assetRef: '{"backend":"branch","branch":"opencha-assets","path":"pr-1/challenge-abc.gif"}'
    },
    exceeded: false
  }
}

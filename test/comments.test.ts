import {
  extractEncryptedPayload,
  renderChallengeComment,
  renderExceededComment,
  renderPassComment,
  renderPassedChallengeComment
} from '../src/state/comments'
import { parseChallengePayload, type ChallengePayload } from '../src/state/payload'

describe('OpenCHA comments', () => {
  it('recovers persisted state from a rendered body', () => {
    expect(extractEncryptedPayload(renderBody('abc_DEF-123'))).toBe('abc_DEF-123')
    expect(extractEncryptedPayload('normal comment')).toBeNull()
  })

  it('rejects repeated persisted state entries', () => {
    const body = renderBody('first')
    const repeatedLine = stateLine(body, 'first').replace('first', 'second')

    expect(() => extractEncryptedPayload(`${body}\n${repeatedLine}`)).toThrow()
  })

  it('renders challenge and completion comments', () => {
    const payload = samplePayload()
    const body = renderChallengeComment({
      assetUrl: 'https://raw.githubusercontent.com/o/r/opencha-assets/pr-1/challenge-abc.gif',
      targetIndex: 3,
      payload,
      encryptedPayload: 'encrypted',
      now: new Date('2026-01-01T00:00:00.000Z')
    })

    expect(body).toContain('## 🧩 OpenCHA verification')
    expect(body).toContain('> [!IMPORTANT]')
    expect(body).toContain('| Status | Target | Attempts |')
    expect(body).toContain('/opencha answer YOUR_CODE')
    expect(body).toContain('**3rd code**')
    expect(body).toContain('<details>')
    expect(body).toContain('<kbd>/opencha approve</kbd>')
    expect(body).not.toContain(payload.answerHash)
    expect(extractEncryptedPayload(body)).toBe('encrypted')
    expect(renderPassedChallengeComment({ ...payload, passed: true, passedBy: 'alice' }, 'encrypted')).toContain(
      'passed by @alice'
    )
    expect(renderPassComment({ ...payload, passed: true, passedBy: 'alice', passMethod: 'answer' })).toContain(
      '## ✅ OpenCHA passed'
    )
    expect(renderExceededComment({ ...payload, exceeded: true, attempts: 5 }, 'encrypted')).toContain(
      '## 🚫 OpenCHA needs a maintainer'
    )
  })

  it('renders temporal pointer challenge comments without ordinal target copy', () => {
    const payload = sampleTemporalPayload()
    const body = renderChallengeComment({
      assetUrl: 'https://raw.githubusercontent.com/o/r/opencha-assets/pr-1/challenge-abc.gif',
      payload,
      encryptedPayload: 'encrypted',
      now: new Date('2026-01-01T00:00:00.000Z')
    })

    expect(body).toContain('| Status | Challenge | Attempts |')
    expect(body).toContain('8-cell ring grid')
    expect(body).toContain('center pointer')
    expect(body).toContain('Record the character')
    expect(body).toContain('<table cellspacing="0" cellpadding="0">')
    expect(body).toContain('OpenCHA pointer')
    expect(body).toContain('OpenCHA pointer" width="230" height="230"')
    expect(body).toContain('OpenCHA cell NW')
    expect(body).toContain('OpenCHA cell W" width="190" height="340"')
    expect(body).toContain('OpenCHA cell N" width="270" height="190"')
    expect(body).toContain('/opencha answer YOUR_CODE')
    expect(body).not.toContain('1st code')
    expect(body).not.toContain('2nd code')
    expect(body).not.toContain('3rd code')
    expect(body).not.toContain('ABCDE')
    expect(body).not.toContain(payload.answerHash)
    expect(extractEncryptedPayload(body)).toBe('encrypted')
  })

  it('keeps old temporal pointer payloads on the single-image fallback path', () => {
    const payload: ChallengePayload = {
      ...sampleTemporalPayload(),
      challengeParams: {
        kind: 'temporal-pointer',
        codeLength: 5,
        ringSize: 18,
        captureCount: 5,
        decoyPauseCount: 0,
        frameDelayMs: 90,
        charset: 'ABCDEFGHJKLMNPQRTUVWXY346789',
        noiseLevel: 'medium'
      },
      asset: {
        url: 'https://raw.githubusercontent.com/o/r/opencha-assets/pr-1/challenge-abc.gif',
        assetRef: '{"backend":"branch","branch":"opencha-assets","path":"pr-1/challenge-abc.gif"}'
      }
    }
    const body = renderChallengeComment({
      assetUrl: 'https://raw.githubusercontent.com/o/r/opencha-assets/pr-1/challenge-abc.gif',
      payload,
      encryptedPayload: 'encrypted',
      now: new Date('2026-01-01T00:00:00.000Z')
    })

    expect(parseChallengePayload(payload).challengeParams).toMatchObject({ ringSize: 18 })
    expect(body).toContain('Watch arrow pauses')
    expect(body).toContain('![OpenCHA challenge]')
    expect(body).not.toContain('<table>')
  })

  it('parses matching legacy and temporal payload versions only', () => {
    expect(parseChallengePayload(samplePayload()).challengeVersion).toBe(1)
    expect(parseChallengePayload(sampleTemporalPayload()).challengeVersion).toBe(2)
    expect(() =>
      parseChallengePayload({
        ...sampleTemporalPayload(),
        challengeParams: samplePayload().challengeParams
      })
    ).toThrow()
    expect(() =>
      parseChallengePayload({
        ...samplePayload(),
        challengeParams: sampleTemporalPayload().challengeParams
      })
    ).toThrow()
  })

  it('renders cooldown availability as an absolute UTC timestamp', () => {
    const body = renderChallengeComment({
      assetUrl: 'https://raw.githubusercontent.com/o/r/opencha-assets/pr-1/challenge-abc.gif',
      targetIndex: 3,
      payload: {
        ...samplePayload(),
        cooldownUntil: '2026-10-24T14:29:29.000Z'
      },
      encryptedPayload: 'encrypted',
      now: new Date('2026-10-24T14:28:59.000Z')
    })

    expect(body).toContain('> Next attempt available at 2026-10-24 14:29:29 UTC.')
    expect(body).not.toContain('Next attempt available in about')
  })
})

function renderBody(encryptedPayload: string): string {
  return renderChallengeComment({
    assetUrl: 'https://raw.githubusercontent.com/o/r/opencha-assets/pr-1/challenge-abc.gif',
    targetIndex: 3,
    payload: samplePayload(),
    encryptedPayload,
    now: new Date('2026-01-01T00:00:00.000Z')
  })
}

function stateLine(body: string, token: string): string {
  const line = body.split('\n').find((line) => line.includes(token))
  if (!line) throw new Error('Expected rendered state line.')
  return line
}

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

function sampleTemporalPayload(): ChallengePayload {
  return {
    schema: 1,
    challengeId: 'challenge',
    challengeVersion: 2,
    seed: 'seed',
    challengeParams: {
      kind: 'temporal-pointer',
      layout: 'direction-grid',
      codeLength: 5,
      cellCodeLengths: [3, 2, 3, 2, 3, 2, 3, 2],
      ringSize: 20,
      captureCount: 5,
      decoyPauseCount: 0,
      frameDelayMs: 90,
      charset: 'ABCDEFGHJKLMNPQRTUVWXY346789',
      noiseLevel: 'medium'
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
      assetRef: '{"backend":"branch","branch":"opencha-assets","path":"pr-1/challenge-abc.gif"}',
      layout: {
        kind: 'direction-grid',
        center: 'https://raw.githubusercontent.com/o/r/opencha-assets/pr-1/challenge-center.gif',
        cells: [
          { direction: 'N', url: 'https://raw.githubusercontent.com/o/r/opencha-assets/pr-1/challenge-n.gif' },
          { direction: 'NE', url: 'https://raw.githubusercontent.com/o/r/opencha-assets/pr-1/challenge-ne.gif' },
          { direction: 'E', url: 'https://raw.githubusercontent.com/o/r/opencha-assets/pr-1/challenge-e.gif' },
          { direction: 'SE', url: 'https://raw.githubusercontent.com/o/r/opencha-assets/pr-1/challenge-se.gif' },
          { direction: 'S', url: 'https://raw.githubusercontent.com/o/r/opencha-assets/pr-1/challenge-s.gif' },
          { direction: 'SW', url: 'https://raw.githubusercontent.com/o/r/opencha-assets/pr-1/challenge-sw.gif' },
          { direction: 'W', url: 'https://raw.githubusercontent.com/o/r/opencha-assets/pr-1/challenge-w.gif' },
          { direction: 'NW', url: 'https://raw.githubusercontent.com/o/r/opencha-assets/pr-1/challenge-nw.gif' }
        ]
      }
    },
    exceeded: false
  }
}

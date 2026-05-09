import { createChallenge } from '../../src/challenge/generate'
import { encodeGif } from '../../src/challenge/gif'
import { renderChallengeFrames } from '../../src/challenge/render'

describe('challenge GIF encoder', () => {
  it('returns deterministic GIF89a bytes for timestamp-independent inputs', () => {
    const challenge = createChallenge({ seed: 'gif-seed', answerSalt: 'salt' }).display
    const first = encodeGif(renderChallengeFrames(challenge))
    const second = encodeGif(renderChallengeFrames(challenge))

    expect(Buffer.from(first.subarray(0, 6)).toString('ascii')).toBe('GIF89a')
    expect(first).toEqual(second)
    expect(first.byteLength).toBeGreaterThan(1000)
    expect(first.byteLength).toBeLessThan(1024 * 1024)
  })

  it('rejects empty frame lists', () => {
    expect(() => encodeGif([])).toThrow('cannot encode GIF without frames')
  })
})

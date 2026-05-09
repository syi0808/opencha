import { hashAnswer, hashNormalizedAnswer, normalizeAnswer, verifyAnswer } from '../../src/challenge/answer'

describe('challenge answer helpers', () => {
  it('normalizes submitted answers', () => {
    expect(normalizeAnswer(' Ab cD ')).toBe('ABCD')
    expect(normalizeAnswer('\ta b\nc\r\n')).toBe('ABC')
  })

  it('keeps unexpected non-whitespace characters in the normalized value', () => {
    const salt = 'salt'
    const expectedHash = hashAnswer('ABCD', salt)

    expect(normalizeAnswer('AB-CD')).toBe('AB-CD')
    expect(verifyAnswer('AB-CD', salt, expectedHash)).toBe(false)
  })

  it('hashes deterministically with salt', () => {
    expect(hashNormalizedAnswer('ABCD', 'salt-a')).toBe(hashNormalizedAnswer('ABCD', 'salt-a'))
    expect(hashNormalizedAnswer('ABCD', 'salt-a')).not.toBe(hashNormalizedAnswer('ABCD', 'salt-b'))
  })

  it('verifies normalized answers in constant-time-compatible form', () => {
    const salt = 'answer-salt'
    const expectedHash = hashAnswer('ABCD', salt)

    expect(verifyAnswer(' a b c d ', salt, expectedHash)).toBe(true)
    expect(verifyAnswer('ABCE', salt, expectedHash)).toBe(false)
  })
})

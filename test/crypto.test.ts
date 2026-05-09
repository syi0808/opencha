import { decryptJson, encryptJson } from '../src/crypto/envelope'
import { derivePayloadKey } from '../src/crypto/keys'
import { PayloadDecryptError } from '../src/errors'

describe('encrypted payload envelope', () => {
  const context = { owner: 'owner', repo: 'repo', prNumber: 123, purpose: 'challenge-payload' }
  const key = derivePayloadKey('x'.repeat(32), { owner: 'owner', repo: 'repo' })

  it('round-trips JSON and uses a fresh nonce', () => {
    const first = encryptJson({ ok: true }, key, context)
    const second = encryptJson({ ok: true }, key, context)

    expect(first).not.toBe(second)
    expect(decryptJson(first, key, context)).toEqual({ ok: true })
  })

  it('rejects wrong context', () => {
    const token = encryptJson({ ok: true }, key, context)

    expect(() => decryptJson(token, key, { ...context, prNumber: 124 })).toThrow(PayloadDecryptError)
  })

  it('rejects tampered payloads', () => {
    const token = encryptJson({ ok: true }, key, context)
    const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`

    expect(() => decryptJson(tampered, key, context)).toThrow(PayloadDecryptError)
  })
})

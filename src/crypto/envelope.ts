import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { PayloadDecryptError } from '../errors'
import { fromBase64Url, toBase64Url } from './base64'

export interface EnvelopeContext {
  owner: string
  repo: string
  prNumber: number
  purpose: string
}

export interface EncryptedEnvelope {
  v: 1
  alg: 'A256GCM'
  nonce: string
  ciphertext: string
  tag: string
}

export function encryptJson(value: unknown, key: Buffer, context: EnvelopeContext): string {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  cipher.setAAD(Buffer.from(associatedData(context), 'utf8'))
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  const envelope: EncryptedEnvelope = {
    v: 1,
    alg: 'A256GCM',
    nonce: toBase64Url(nonce),
    ciphertext: toBase64Url(ciphertext),
    tag: toBase64Url(tag)
  }

  return toBase64Url(JSON.stringify(envelope))
}

export function decryptJson<T>(token: string, key: Buffer, context: EnvelopeContext): T {
  try {
    const envelope = JSON.parse(fromBase64Url(token).toString('utf8')) as Partial<EncryptedEnvelope>
    if (envelope.v !== 1 || envelope.alg !== 'A256GCM' || !envelope.nonce || !envelope.ciphertext || !envelope.tag) {
      throw new PayloadDecryptError()
    }

    const decipher = createDecipheriv('aes-256-gcm', key, fromBase64Url(envelope.nonce))
    decipher.setAAD(Buffer.from(associatedData(context), 'utf8'))
    decipher.setAuthTag(fromBase64Url(envelope.tag))
    const plaintext = Buffer.concat([
      decipher.update(fromBase64Url(envelope.ciphertext)),
      decipher.final()
    ])

    return JSON.parse(plaintext.toString('utf8')) as T
  } catch (error) {
    if (error instanceof PayloadDecryptError) {
      throw error
    }
    throw new PayloadDecryptError()
  }
}

function associatedData(context: EnvelopeContext): string {
  return `opencha:v1:${context.owner}/${context.repo}#${context.prNumber}:${context.purpose}`
}

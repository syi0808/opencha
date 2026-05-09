import { hkdfSync } from 'node:crypto'

export interface PayloadKeyContext {
  owner: string
  repo: string
}

export function derivePayloadKey(secret: string, context: PayloadKeyContext): Buffer {
  return Buffer.from(hkdfSync(
    'sha256',
    Buffer.from(secret, 'utf8'),
    Buffer.from(`opencha:v1:${context.owner}/${context.repo}`, 'utf8'),
    Buffer.from('opencha payload encryption v1', 'utf8'),
    32
  ))
}

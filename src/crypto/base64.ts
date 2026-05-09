export function toBase64Url(bytes: Buffer | Uint8Array | string): string {
  return Buffer.from(bytes).toString('base64url')
}

export function fromBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

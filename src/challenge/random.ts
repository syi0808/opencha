import { createHash } from 'node:crypto'

export class SeededRandom {
  private counter = 0
  private buffer = new Uint8Array(0)
  private offset = 0

  constructor(private readonly seed: string) {}

  nextFloat(): number {
    const value = this.nextUint32()
    return value / 0x100000000
  }

  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError('maxExclusive must be a positive integer')
    }

    return Math.floor(this.nextFloat() * maxExclusive)
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError('cannot pick from an empty array')
    }

    return items[this.nextInt(items.length)] as T
  }

  private nextUint32(): number {
    const bytes = this.nextBytes(4)
    return (
      (bytes[0] as number) * 0x1000000 +
      (bytes[1] as number) * 0x10000 +
      (bytes[2] as number) * 0x100 +
      (bytes[3] as number)
    )
  }

  private nextBytes(length: number): Uint8Array {
    const output = new Uint8Array(length)

    for (let i = 0; i < length; i++) {
      if (this.offset >= this.buffer.length) {
        this.refill()
      }

      output[i] = this.buffer[this.offset] as number
      this.offset += 1
    }

    return output
  }

  private refill(): void {
    this.buffer = createHash('sha256')
      .update(this.seed)
      .update(':')
      .update(String(this.counter))
      .digest()
    this.counter += 1
    this.offset = 0
  }
}

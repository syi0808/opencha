declare module 'gifenc' {
  export type Palette = number[][]

  export interface GifEncoder {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: {
        palette?: Palette
        delay?: number
        repeat?: number
        colorDepth?: number
      }
    ): void
    finish(): void
    bytes(): Uint8Array
  }

  export function GIFEncoder(options?: { initialCapacity?: number; auto?: boolean }): GifEncoder
  export function applyPalette(rgba: Uint8Array, palette: Palette, format?: string): Uint8Array
}

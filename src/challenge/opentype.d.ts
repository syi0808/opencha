declare module 'opentype.js' {
  export interface Font {
    unitsPerEm: number
    ascender: number
    descender: number
    charToGlyph(char: string): Glyph
  }

  export interface Glyph {
    advanceWidth: number
    getPath(x: number, y: number, fontSize: number): Path
  }

  export interface Path {
    commands: PathCommand[]
  }

  export type PathCommand =
    | { type: 'M'; x: number; y: number }
    | { type: 'L'; x: number; y: number }
    | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
    | { type: 'Q'; x1: number; y1: number; x: number; y: number }
    | { type: 'Z' }

  const opentype: {
    parse(buffer: ArrayBuffer): Font
  }

  export default opentype
}

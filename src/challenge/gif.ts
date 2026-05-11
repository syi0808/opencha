import { applyPalette, GIFEncoder, type Palette } from 'gifenc'
import { type Frame } from './render'

const PALETTE: Palette = [
  [240, 239, 234],
  [41, 44, 48],
  [72, 50, 112],
  [31, 84, 94],
  [118, 58, 43],
  [54, 87, 50],
  [39, 68, 132],
  [103, 48, 88],
  [110, 116, 122],
  [176, 170, 160],
  [170, 64, 54],
  [255, 255, 255],
  [0, 0, 0],
  [211, 205, 196]
]

export function encodeGif(frames: readonly Frame[]): Uint8Array {
  if (frames.length === 0) {
    throw new Error('cannot encode GIF without frames')
  }

  const first = frames[0] as Frame
  const encoder = GIFEncoder({ initialCapacity: first.width * first.height * frames.length })

  for (const frame of frames) {
    if (frame.width !== first.width || frame.height !== first.height) {
      throw new Error('all GIF frames must have identical dimensions')
    }

    encoder.writeFrame(applyPalette(frame.rgba, PALETTE, 'rgb444'), frame.width, frame.height, {
      palette: PALETTE,
      delay: frame.delayMs,
      repeat: 0,
      colorDepth: 4
    })
  }

  encoder.finish()
  return encoder.bytes()
}

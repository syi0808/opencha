import { BITMAP_FONT } from '../../src/challenge/bitmap-font'
import { createChallenge } from '../../src/challenge/generate'
import { CODE_HOLD_FRAMES, FRAME_HEIGHT, FRAME_WIDTH, renderChallengeFrames } from '../../src/challenge/render'
import { ANIMATION_FRAMES, CHALLENGE_CHARSET, DECOY_COUNT } from '../../src/challenge/types'

describe('challenge renderer', () => {
  it('has glyphs for every challenge character', () => {
    for (const char of CHALLENGE_CHARSET) {
      expect(BITMAP_FONT[char], `missing glyph for ${char}`).toBeDefined()
    }
  })

  it('renders stable non-empty frame arrays', () => {
    const challenge = createChallenge({ seed: 'render-seed', answerSalt: 'salt' }).display
    const frames = renderChallengeFrames(challenge)

    expect(ANIMATION_FRAMES).toBeGreaterThan(8)
    expect(frames).toHaveLength((DECOY_COUNT + 1) * CODE_HOLD_FRAMES + DECOY_COUNT * ANIMATION_FRAMES)

    for (const frame of frames) {
      expect(frame.width).toBe(FRAME_WIDTH)
      expect(frame.height).toBe(FRAME_HEIGHT)
      expect(frame.rgba).toHaveLength(FRAME_WIDTH * FRAME_HEIGHT * 4)
      expect(frame.delayMs).toBeGreaterThanOrEqual(60)
      expect(frame.delayMs).toBeLessThanOrEqual(140)
    }
  })

  it('draws pixels that differ from the background', () => {
    const challenge = createChallenge({ seed: 'nonblank-seed', answerSalt: 'salt' }).display
    const [frame] = renderChallengeFrames(challenge)
    expect(frame).toBeDefined()

    const rgba = frame!.rgba
    let changed = 0

    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i] !== 240 || rgba[i + 1] !== 239 || rgba[i + 2] !== 234 || rgba[i + 3] !== 255) {
        changed += 1
      }
    }

    expect(changed).toBeGreaterThan(100)
  })
})

import {
  ASCII_ART_FONTS,
  hasAsciiArtGlyph,
  renderAsciiCodeArt,
  selectAsciiArtFont
} from '../../src/challenge/ascii-art-fonts'
import { createChallenge } from '../../src/challenge/generate'
import { CODE_HOLD_FRAMES, FRAME_HEIGHT, FRAME_WIDTH, renderChallengeFrames } from '../../src/challenge/render'
import { ANIMATION_FRAMES, CHALLENGE_CHARSET, DECOY_COUNT } from '../../src/challenge/types'

describe('challenge renderer', () => {
  it('has ASCII-art glyphs for every challenge character across every font', () => {
    for (const char of CHALLENGE_CHARSET) {
      expect(hasAsciiArtGlyph(char), `missing glyph for ${char}`).toBe(true)

      for (const font of ASCII_ART_FONTS) {
        const art = renderAsciiCodeArt(char, font)
        expect(art.rows.join(''), `empty ${font.name} glyph for ${char}`).toMatch(/\S/)
      }
    }
  })

  it('selects deterministic varied ASCII-art fonts', () => {
    const selected = Array.from({ length: 32 }, (_unused, index) =>
      selectAsciiArtFont('font-variety-seed', index).name
    )
    const repeated = Array.from({ length: 32 }, (_unused, index) =>
      selectAsciiArtFont('font-variety-seed', index).name
    )

    expect(selected).toEqual(repeated)
    expect(new Set(selected).size).toBeGreaterThan(1)
  })

  it('uses a broad printable ASCII palette for generated text art', () => {
    expect(ASCII_ART_FONTS.length).toBeGreaterThanOrEqual(6)

    const allSymbols = new Set<string>()

    for (const font of ASCII_ART_FONTS) {
      const art = renderAsciiCodeArt('A3K9X', font)
      const fontSymbols = new Set(art.rows.join('').replaceAll(' ', '').split(''))

      expect(fontSymbols.size, `${font.name} symbol count`).toBeGreaterThanOrEqual(3)

      for (const symbol of fontSymbols) {
        const codePoint = symbol.charCodeAt(0)
        expect(codePoint, `${font.name} ${symbol}`).toBeGreaterThanOrEqual(33)
        expect(codePoint, `${font.name} ${symbol}`).toBeLessThanOrEqual(126)
        allSymbols.add(symbol)
      }
    }

    expect(allSymbols.size).toBeGreaterThanOrEqual(12)
  })

  it('keeps every ASCII-art font within the GIF frame', () => {
    const code = CHALLENGE_CHARSET.slice(0, 5)

    for (const font of ASCII_ART_FONTS) {
      const art = renderAsciiCodeArt(code, font)

      expect(art.widthPx, `${font.name} width`).toBeLessThanOrEqual(FRAME_WIDTH)
      expect(art.heightPx, `${font.name} height`).toBeLessThanOrEqual(FRAME_HEIGHT)
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

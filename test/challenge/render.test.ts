import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  ASCII_ART_FONTS,
  ASCII_ART_SYMBOL_PALETTE,
  hasAsciiArtGlyph,
  renderAsciiCodeArt,
  selectAsciiArtFont
} from '../../src/challenge/ascii-art-fonts'
import { createChallenge } from '../../src/challenge/generate'
import {
  CODE_HOLD_FRAMES,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  hasTinyAsciiGlyph,
  renderChallengeFrames
} from '../../src/challenge/render'
import { ANIMATION_FRAMES, CHALLENGE_CHARSET, CODE_LENGTH_MAX } from '../../src/challenge/types'

describe('challenge renderer', () => {
  it('bundles the TTF font files used by the renderer', () => {
    for (const font of ASCII_ART_FONTS) {
      const path = join(process.cwd(), 'src', 'challenge', 'fonts', font.filename)

      expect(existsSync(path), `missing ${font.filename}`).toBe(true)
      expect(statSync(path).size, `${font.filename} size`).toBeGreaterThan(100 * 1024)
    }
  })

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

  it('uses embedded TTF fonts and a printable ASCII density palette', () => {
    expect(ASCII_ART_FONTS.map((font) => font.name)).toEqual([
      'noto-sans-bold',
      'noto-serif-bold',
      'anton-regular',
      'oswald-bold'
    ])
    expect(ASCII_ART_SYMBOL_PALETTE.length).toBeGreaterThanOrEqual(30)

    const allSymbols = new Set<string>()
    const allowedSymbols = new Set<string>(ASCII_ART_SYMBOL_PALETTE)
    const heavySymbols = new Set(['@', '$', '#'])

    for (const symbol of ASCII_ART_SYMBOL_PALETTE) {
      expect(hasTinyAsciiGlyph(symbol), `missing tiny renderer glyph for ${symbol}`).toBe(true)
    }

    for (const font of ASCII_ART_FONTS) {
      const art = renderAsciiCodeArt('A3K9X7', font)
      const fontSymbols = new Set(art.rows.join('').replaceAll(' ', '').split(''))

      expect(fontSymbols.size, `${font.name} symbol count`).toBeGreaterThanOrEqual(3)
      expect(
        [...fontSymbols].filter((symbol) => heavySymbols.has(symbol)).length,
        `${font.name} heavy symbol count`
      ).toBe(0)

      for (const symbol of fontSymbols) {
        const codePoint = symbol.charCodeAt(0)
        expect(codePoint, `${font.name} ${symbol}`).toBeGreaterThanOrEqual(33)
        expect(codePoint, `${font.name} ${symbol}`).toBeLessThanOrEqual(126)
        expect(allowedSymbols.has(symbol), `${font.name} ${symbol}`).toBe(true)
        allSymbols.add(symbol)
      }
    }

    expect(allSymbols.size).toBeGreaterThanOrEqual(6)
  })

  it('mixes affine character styles and cutouts within one seeded code', () => {
    const font = ASCII_ART_FONTS[0]!
    const options = { seed: 'mixed-character-seed', codeIndex: 2 }
    const art = renderAsciiCodeArt('A3K9X7', font, options)
    const repeated = renderAsciiCodeArt('A3K9X7', font, options)

    expect(art.rows).toEqual(repeated.rows)
    expect(art.characterStyles).toEqual(repeated.characterStyles)
    expect(art.characterStyles.map((style) => style.char).join('')).toBe('A3K9X7')
    expect(new Set(art.characterStyles.map((style) => style.fontName)).size).toBeGreaterThan(1)
    expect(new Set(art.characterStyles.map((style) => style.fontSize)).size).toBeGreaterThan(1)
    expect(new Set(art.characterStyles.map((style) => style.rotationDegrees)).size).toBeGreaterThan(1)
    expect(new Set(art.characterStyles.map((style) => style.jitterX)).size).toBeGreaterThan(1)
    expect(new Set(art.characterStyles.map((style) => style.jitterY)).size).toBeGreaterThan(1)
    expect(new Set(art.characterStyles.map((style) => style.scaleX)).size).toBeGreaterThan(1)
    expect(new Set(art.characterStyles.map((style) => style.scaleY)).size).toBeGreaterThan(1)
    expect(new Set(art.characterStyles.map((style) => style.shearX)).size).toBeGreaterThan(1)
    expect(new Set(art.characterStyles.map((style) => style.overlapPx)).size).toBeGreaterThan(1)
    expect(new Set(art.characterStyles.map((style) => style.holeCount)).size).toBeGreaterThan(1)
    expect(
      new Set(
        art.characterStyles.map(
          (style) => `${style.fontName}:${style.fontSize}:${style.rotationDegrees}`
        )
      ).size
    ).toBe(art.characterStyles.length)

    for (const style of art.characterStyles) {
      expect(style.fontSize).toBeGreaterThanOrEqual(36)
      expect(style.fontSize).toBeLessThanOrEqual(44)
      expect(style.rotationDegrees).toBeGreaterThanOrEqual(-7)
      expect(style.rotationDegrees).toBeLessThanOrEqual(7)
      expect(style.jitterX).toBeGreaterThanOrEqual(-3)
      expect(style.jitterX).toBeLessThanOrEqual(3)
      expect(style.jitterY).toBeGreaterThanOrEqual(-2)
      expect(style.jitterY).toBeLessThanOrEqual(2)
      expect(style.scaleX).toBeGreaterThanOrEqual(0.9)
      expect(style.scaleX).toBeLessThanOrEqual(1.1)
      expect(style.scaleY).toBeGreaterThanOrEqual(0.92)
      expect(style.scaleY).toBeLessThanOrEqual(1.02)
      expect(style.shearX).toBeGreaterThanOrEqual(-0.16)
      expect(style.shearX).toBeLessThanOrEqual(0.16)
      expect(style.overlapPx).toBeGreaterThanOrEqual(0)
      expect(style.overlapPx).toBeLessThanOrEqual(8)
      expect(style.holeCount).toBeGreaterThanOrEqual(1)
      expect(style.holeCount).toBeLessThanOrEqual(3)
      expect(style.advancePx).toBeGreaterThan(0)
    }
  })

  it('reflects distinct TTF glyph outlines in the generated ASCII art', () => {
    const [notoSans, _notoSerif, anton, oswald] = ASCII_ART_FONTS
    const sansArt = renderAsciiCodeArt('OPENCHA', notoSans!)
    const antonArt = renderAsciiCodeArt('OPENCHA', anton!)
    const oswaldArt = renderAsciiCodeArt('OPENCHA', oswald!)

    expect(sansArt.rows.join('\n')).not.toBe(antonArt.rows.join('\n'))
    expect(sansArt.columns, 'Noto Sans width').not.toBe(antonArt.columns)
    expect(oswaldArt.columns, 'Oswald width').not.toBe(antonArt.columns)
  })

  it('keeps every ASCII-art font within the GIF frame', () => {
    const code = CHALLENGE_CHARSET.slice(0, CODE_LENGTH_MAX)

    for (const font of ASCII_ART_FONTS) {
      const art = renderAsciiCodeArt(code, font)

      expect(art.widthPx, `${font.name} width`).toBeLessThanOrEqual(FRAME_WIDTH)
      expect(art.heightPx, `${font.name} height`).toBeLessThanOrEqual(FRAME_HEIGHT)
    }

    const mixedArt = renderAsciiCodeArt(code, ASCII_ART_FONTS[0]!, {
      seed: 'mixed-frame-bounds-seed',
      codeIndex: 0
    })
    expect(mixedArt.widthPx, 'mixed width').toBeLessThanOrEqual(FRAME_WIDTH)
    expect(mixedArt.heightPx, 'mixed height').toBeLessThanOrEqual(FRAME_HEIGHT)
  })

  it('renders dense multi-row ASCII art for the maximum code length', () => {
    const code = CHALLENGE_CHARSET.slice(0, CODE_LENGTH_MAX)

    for (const font of ASCII_ART_FONTS) {
      const art = renderAsciiCodeArt(code, font)
      const visibleSymbols = art.rows.join('').replaceAll(' ', '').length

      expect(art.rowCount, `${font.name} rows`).toBeGreaterThanOrEqual(28)
      expect(art.columns, `${font.name} columns`).toBeGreaterThanOrEqual(130)
      expect(visibleSymbols, `${font.name} visible symbol density`).toBeGreaterThanOrEqual(480)
    }
  })

  it('renders stable non-empty frame arrays', () => {
    const challenge = createChallenge({ seed: 'render-seed', answerSalt: 'salt' }).display
    const frames = renderChallengeFrames(challenge)

    expect(ANIMATION_FRAMES).toBeGreaterThan(8)
    expect(frames).toHaveLength(
      challenge.codes.length * CODE_HOLD_FRAMES + (challenge.codes.length - 1) * ANIMATION_FRAMES
    )

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

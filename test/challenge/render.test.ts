import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  ASCII_ART_CHARACTER_COLORS,
  ASCII_ART_FONTS,
  ASCII_ART_SYMBOL_PALETTE,
  hasAsciiArtGlyph,
  renderAsciiCodeArt,
  selectAsciiArtFont
} from '../../src/challenge/ascii-art-fonts'
import { createChallenge, createLegacySlideChallenge } from '../../src/challenge/generate'
import {
  CODE_HOLD_FRAMES,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  TEMPORAL_POINTER_LOCK_COLOR,
  hasTinyAsciiGlyph,
  renderChallengeFrames
} from '../../src/challenge/render'
import { visibleStringsForTemporalPointerFrame } from '../../src/challenge/temporal-pointer'
import {
  ANIMATION_FRAMES,
  CHALLENGE_CHARSET,
  CODE_LENGTH_MAX,
  LEGACY_SLIDE_CHALLENGE_VERSION,
  TEMPORAL_POINTER_CHALLENGE_VERSION
} from '../../src/challenge/types'

describe('challenge renderer', () => {
  it('bundles the TTF font files used by the renderer', () => {
    for (const font of ASCII_ART_FONTS) {
      const path = join(process.cwd(), 'src', 'challenge', 'fonts', font.filename)

      expect(existsSync(path), `missing ${font.filename}`).toBe(true)
      expect(statSync(path).size, `${font.filename} size`).toBeGreaterThan(100 * 1024)
    }
  })

  it('has ASCII-art glyphs for every challenge character across every font', () => {
    for (const char of `${CHALLENGE_CHARSET}${CHALLENGE_CHARSET.toLowerCase()}`) {
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
      expect(style.jitterX).toBeGreaterThanOrEqual(-2)
      expect(style.jitterX).toBeLessThanOrEqual(2)
      expect(style.jitterY).toBeGreaterThanOrEqual(-1)
      expect(style.jitterY).toBeLessThanOrEqual(1)
      expect(style.scaleX).toBeGreaterThanOrEqual(0.95)
      expect(style.scaleX).toBeLessThanOrEqual(1.05)
      expect(style.scaleY).toBeGreaterThanOrEqual(0.96)
      expect(style.scaleY).toBeLessThanOrEqual(1.02)
      expect(style.shearX).toBeGreaterThanOrEqual(-0.08)
      expect(style.shearX).toBeLessThanOrEqual(0.08)
      expect(style.overlapPx).toBeGreaterThanOrEqual(0)
      expect(style.overlapPx).toBeLessThanOrEqual(3)
      expect(style.holeCount).toBeGreaterThanOrEqual(1)
      expect(style.holeCount).toBeLessThanOrEqual(2)
      expect(style.advancePx).toBeGreaterThan(0)
      expect(ASCII_ART_CHARACTER_COLORS.map(colorKey)).toContain(colorKey(style.color))
      expect(contrastRatio(style.color, [240, 239, 234, 255])).toBeGreaterThanOrEqual(4.5)
    }

    expect(new Set(art.characterStyles.map((style) => colorKey(style.color))).size).toBeGreaterThan(1)
    expect(art.characterCells).toHaveLength(art.rows.length)
    for (const [rowIndex, cells] of art.characterCells.entries()) {
      expect(cells, `character cell row ${rowIndex}`).toHaveLength(art.columns)
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
      expect(art.columns, `${font.name} columns`).toBeGreaterThanOrEqual(CODE_LENGTH_MAX * 18)
      expect(visibleSymbols, `${font.name} visible symbol density`).toBeGreaterThanOrEqual(CODE_LENGTH_MAX * 65)
    }
  })

  it('renders stable non-empty frame arrays', () => {
    const challenge = createLegacySlideChallenge({ seed: 'render-seed', answerSalt: 'salt' }).display
    if (challenge.version !== LEGACY_SLIDE_CHALLENGE_VERSION) {
      throw new Error('expected legacy slide display')
    }
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

  it('renders temporal pointer frames from the generated timeline', () => {
    const challenge = createChallenge({ seed: 'temporal-render-seed', answerSalt: 'salt' }).display
    if (challenge.version !== TEMPORAL_POINTER_CHALLENGE_VERSION) {
      throw new Error('expected temporal pointer display')
    }

    const frames = renderChallengeFrames(challenge)
    expect(frames).toHaveLength(challenge.timeline.length)

    for (const frame of frames) {
      expect(frame.width).toBe(FRAME_WIDTH)
      expect(frame.height).toBe(FRAME_HEIGHT)
      expect(frame.rgba).toHaveLength(FRAME_WIDTH * FRAME_HEIGHT * 4)
      expect(frame.delayMs).toBe(challenge.params.frameDelayMs)
    }
  })

  it('draws pixels that differ from the background', () => {
    const challenge = createChallenge({ seed: 'nonblank-seed', answerSalt: 'salt' }).display
    if (challenge.version !== TEMPORAL_POINTER_CHALLENGE_VERSION) {
      throw new Error('expected temporal pointer display')
    }

    const frames = renderChallengeFrames(challenge)
    const captureIndex = challenge.timeline.findIndex((cue) => cue.kind === 'capture')
    const sampleIndexes = [0, Math.floor(frames.length / 2), captureIndex]

    for (const index of sampleIndexes) {
      const frame = frames[index]
      expect(frame, `frame ${index}`).toBeDefined()
      expect(countChangedPixels(frame!.rgba), `changed pixels for frame ${index}`).toBeGreaterThan(100)
    }
  })

  it('draws temporal capture cues without drawing the answer sequence', () => {
    const challenge = createChallenge({ seed: 'temporal-cue-seed', answerSalt: 'salt' }).display
    if (challenge.version !== TEMPORAL_POINTER_CHALLENGE_VERSION) {
      throw new Error('expected temporal pointer display')
    }

    const frames = renderChallengeFrames(challenge)
    const captureFrameIndex = challenge.timeline.findIndex((cue) => cue.kind === 'capture')
    const nearMissFrameIndex = challenge.timeline.findIndex((cue) => cue.kind === 'near-miss')

    expect(captureFrameIndex).toBeGreaterThanOrEqual(0)
    expect(nearMissFrameIndex).toBeGreaterThanOrEqual(0)
    expect(countColorPixels(frames[captureFrameIndex]!.rgba, TEMPORAL_POINTER_LOCK_COLOR)).toBeGreaterThan(20)
    expect(countColorPixels(frames[nearMissFrameIndex]!.rgba, TEMPORAL_POINTER_LOCK_COLOR)).toBe(0)

    for (const cue of challenge.timeline) {
      for (const visible of visibleStringsForTemporalPointerFrame(challenge, cue)) {
        expect(visible).not.toContain(challenge.answer)
      }
    }
  })

  it('draws seeded challenge text with multiple readable character colors', () => {
    const challenge = createLegacySlideChallenge({ seed: 'frame-color-seed', answerSalt: 'salt' }).display
    if (challenge.version !== LEGACY_SLIDE_CHALLENGE_VERSION) {
      throw new Error('expected legacy slide display')
    }
    const [frame] = renderChallengeFrames(challenge)
    if (!frame) throw new Error('expected at least one frame')

    const textColorKeys = new Set(ASCII_ART_CHARACTER_COLORS.map(colorKey))
    const seenTextColors = new Set<string>()

    for (let index = 0; index < frame.rgba.length; index += 4) {
      const key = `${frame.rgba[index]},${frame.rgba[index + 1]},${frame.rgba[index + 2]},${frame.rgba[index + 3]}`
      if (textColorKeys.has(key)) seenTextColors.add(key)
    }

    expect(seenTextColors.size).toBeGreaterThan(1)
  })
})

function countChangedPixels(rgba: Uint8Array): number {
  let changed = 0

  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] !== 240 || rgba[i + 1] !== 239 || rgba[i + 2] !== 234 || rgba[i + 3] !== 255) {
      changed += 1
    }
  }

  return changed
}

function countColorPixels(rgba: Uint8Array, color: readonly [number, number, number, number]): number {
  let count = 0

  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i] === color[0] && rgba[i + 1] === color[1] && rgba[i + 2] === color[2] && rgba[i + 3] === color[3]) {
      count += 1
    }
  }

  return count
}

function colorKey(color: readonly [number, number, number, number]): string {
  return color.join(',')
}

function contrastRatio(
  foreground: readonly [number, number, number, number],
  background: readonly [number, number, number, number]
): number {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

function relativeLuminance(color: readonly [number, number, number, number]): number {
  const [red, green, blue] = color
  const [r, g, b] = [red, green, blue].map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

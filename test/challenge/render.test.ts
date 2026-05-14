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
  TEMPORAL_POINTER_GRID_TABLE_ROWS,
  temporalPointerGridCharacterAnchorRatio,
  temporalPointerGridCharacterAngleDegrees,
  temporalPointerGridImageRect,
  temporalPointerGridReadableCharacterRatio,
  temporalPointerGridDisplaySize
} from '../../src/challenge/temporal-grid-layout'
import {
  CODE_HOLD_FRAMES,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  TEMPORAL_DIRECTION_CELL_LOOP_FRAMES,
  TEMPORAL_SIDE_CELL_FRAME_HEIGHT,
  TEMPORAL_SIDE_CELL_FRAME_WIDTH,
  TEMPORAL_SYMBOL_MIN_VISIBLE_RATIO,
  hasTinyAsciiGlyph,
  renderChallengeAssets,
  renderChallengeFrames,
  type Frame,
  temporalSymbolArtForFrame
} from '../../src/challenge/render'
import { visibleStringsForTemporalPointerFrame } from '../../src/challenge/temporal-pointer'
import {
  ANIMATION_FRAMES,
  CHALLENGE_CHARSET,
  CODE_LENGTH_MAX,
  LEGACY_SLIDE_CHALLENGE_VERSION,
  TEMPORAL_POINTER_CHALLENGE_VERSION,
  type TemporalPointerGridSlot
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

  it('renders temporal pointer grid assets from the generated timeline', () => {
    const challenge = createChallenge({ seed: 'temporal-render-seed', answerSalt: 'salt' }).display
    if (challenge.version !== TEMPORAL_POINTER_CHALLENGE_VERSION) {
      throw new Error('expected temporal pointer display')
    }

    const assets = renderChallengeAssets(challenge)
    expect(assets).toHaveLength(9)
    expect(assets.map((asset) => asset.slot)).toEqual(['center', 'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])
    expect(FRAME_WIDTH).toBe(FRAME_HEIGHT)

    for (const asset of assets) {
      expect(asset.frames).toHaveLength(
        asset.slot === 'center' ? challenge.timeline.length : TEMPORAL_DIRECTION_CELL_LOOP_FRAMES
      )
      for (const frame of asset.frames) {
        const expectedSize = asset.slot === 'W' || asset.slot === 'E'
          ? { width: TEMPORAL_SIDE_CELL_FRAME_WIDTH, height: TEMPORAL_SIDE_CELL_FRAME_HEIGHT }
          : { width: FRAME_WIDTH, height: FRAME_HEIGHT }

        expect(frame.width, `${asset.slot} width`).toBe(expectedSize.width)
        expect(frame.height, `${asset.slot} height`).toBe(expectedSize.height)
        expect(frame.rgba).toHaveLength(expectedSize.width * expectedSize.height * 4)
        expect(frame.delayMs).toBe(challenge.params.frameDelayMs)
      }
    }
  }, 10000)

  it('places temporal grid GIFs with non-uniform sizes and character-centered pointer targets', () => {
    expect(temporalPointerGridDisplaySize('center')).toEqual({ width: 230, height: 230 })
    expect(temporalPointerGridDisplaySize('W')).toEqual({ width: 190, height: 340 })
    expect(temporalPointerGridDisplaySize('E')).toEqual({ width: 190, height: 340 })
    expect(temporalPointerGridDisplaySize('N')).toEqual({ width: 270, height: 190 })
    expect(temporalPointerGridDisplaySize('NE')).toEqual({ width: 230, height: 230 })

    const renderedSlots = TEMPORAL_POINTER_GRID_TABLE_ROWS.flat()
    const sizeKeys = new Set(renderedSlots.map((slot) => {
      const size = temporalPointerGridDisplaySize(slot)
      return `${size.width}x${size.height}`
    }))
    expect(sizeKeys.size).toBeGreaterThan(2)

    for (const slot of renderedSlots) {
      if (slot === 'center') continue
      const characterCount = slot.length === 1 ? 3 : 2
      for (let characterIndex = 0; characterIndex < characterCount; characterIndex++) {
        const anchor = temporalPointerGridCharacterAnchorRatio(slot, characterIndex, characterCount)
        const readable = temporalPointerGridReadableCharacterRatio(slot, characterIndex, characterCount)
        const angle = temporalPointerGridCharacterAngleDegrees(slot, characterIndex, characterCount)
        const expectedAngle = readableCharacterAngleDegrees(slot, characterIndex, characterCount)

        expect(anchor, `${slot} ${characterIndex} pointer anchor`).toEqual(readable)
        expect(angularDistanceDegrees(angle, expectedAngle), `${slot} ${characterIndex} pointer angle`).toBeLessThan(0.000001)
        expect(anchor.x, `${slot} ${characterIndex} anchor x`).toBeGreaterThan(0.08)
        expect(anchor.x, `${slot} ${characterIndex} anchor x`).toBeLessThan(0.92)
        expect(anchor.y, `${slot} ${characterIndex} anchor y`).toBeGreaterThan(0.08)
        expect(anchor.y, `${slot} ${characterIndex} anchor y`).toBeLessThan(0.92)
      }
    }

    const westAnchors = [0, 1, 2].map((index) => temporalPointerGridCharacterAnchorRatio('W', index, 3))
    expect(westAnchors[0]!.y).toBeLessThan(westAnchors[1]!.y)
    expect(westAnchors[1]!.y).toBeLessThan(westAnchors[2]!.y)
    expect(westAnchors.map((anchor) => anchor.x)).toEqual([0.5, 0.5, 0.5])
    expect(westAnchors[1]!.y - westAnchors[0]!.y).toBeGreaterThan(0.38)
    expect(westAnchors[2]!.y - westAnchors[1]!.y).toBeGreaterThan(0.38)

    const eastAnchors = [0, 1, 2].map((index) => temporalPointerGridCharacterAnchorRatio('E', index, 3))
    expect(eastAnchors.map((anchor) => anchor.x)).toEqual([0.5, 0.5, 0.5])
    expect(eastAnchors[0]!.y).toBeLessThan(eastAnchors[1]!.y)
    expect(eastAnchors[1]!.y).toBeLessThan(eastAnchors[2]!.y)

    const northAnchors = [0, 1, 2].map((index) => temporalPointerGridCharacterAnchorRatio('N', index, 3))
    expect(northAnchors[0]!.x).toBeLessThan(northAnchors[1]!.x)
    expect(northAnchors[1]!.x).toBeLessThan(northAnchors[2]!.x)

    const diagonalDirections = [
      ['NE', 1, -1],
      ['SE', 1, 1],
      ['SW', -1, 1],
      ['NW', -1, -1]
    ] as const

    for (const [slot, xDirection, yDirection] of diagonalDirections) {
      const anchors = [0, 1].map((index) => temporalPointerGridCharacterAnchorRatio(slot, index, 2))
      const readable = [0, 1].map((index) => temporalPointerGridReadableCharacterRatio(slot, index, 2))
      const anchorDeltaX = anchors[1]!.x - anchors[0]!.x
      const anchorDeltaY = anchors[1]!.y - anchors[0]!.y
      const readableDeltaX = readable[1]!.x - readable[0]!.x
      const readableDeltaY = readable[1]!.y - readable[0]!.y

      expect(Math.sign(anchorDeltaX), `${slot} anchor x direction`).toBe(xDirection)
      expect(Math.sign(anchorDeltaY), `${slot} anchor y direction`).toBe(yDirection)
      expect(Math.sign(readableDeltaX), `${slot} readable x direction`).toBe(xDirection)
      expect(Math.sign(readableDeltaY), `${slot} readable y direction`).toBe(yDirection)
      expect(Math.abs(readableDeltaX), `${slot} readable x separation`).toBeGreaterThan(0.18)
      expect(Math.abs(readableDeltaX), `${slot} readable x separation`).toBeLessThan(0.28)
      expect(Math.abs(readableDeltaY), `${slot} readable y separation`).toBeGreaterThan(0.18)
      expect(Math.abs(readableDeltaY), `${slot} readable y separation`).toBeLessThan(0.28)
      for (const point of readable) {
        expect(point.x, `${slot} centered x`).toBeGreaterThanOrEqual(0.4)
        expect(point.x, `${slot} centered x`).toBeLessThanOrEqual(0.6)
        expect(point.y, `${slot} centered y`).toBeGreaterThanOrEqual(0.4)
        expect(point.y, `${slot} centered y`).toBeLessThanOrEqual(0.6)
      }
    }
  })

  it('draws every character in each temporal grid frame at readable separated positions', () => {
    const challenge = createChallenge({ seed: 'temporal-all-characters-seed', answerSalt: 'salt' }).display
    if (challenge.version !== TEMPORAL_POINTER_CHALLENGE_VERSION) {
      throw new Error('expected temporal pointer display')
    }

    const frame = renderChallengeAssets(challenge).find((asset) => asset.slot === 'W')?.frames[0]
    if (!frame) throw new Error('expected W cell frame')

    const textColorKeys = new Set(ASCII_ART_CHARACTER_COLORS.map(colorKey))
    const readableAnchors = [0, 1, 2].map((index) => temporalPointerGridReadableCharacterRatio('W', index, 3))

    for (const [index, anchor] of readableAnchors.entries()) {
      const centerX = Math.round(anchor.x * frame.width)
      const centerY = Math.round(anchor.y * frame.height)
      const visiblePixels = countPalettePixelsInRect(frame, textColorKeys, centerX - 70, centerY - 90, centerX + 70, centerY + 90)

      expect(visiblePixels, `visible readable character ${index}`).toBeGreaterThan(40)
    }

    expect(readableAnchors[1]!.y - readableAnchors[0]!.y).toBeGreaterThan(0.35)
    expect(readableAnchors[2]!.y - readableAnchors[1]!.y).toBeGreaterThan(0.35)
  })

  it('applies deterministic frame-varying ASCII stroke interference to temporal symbols', () => {
    const challenge = createChallenge({ seed: 'temporal-interference-seed', answerSalt: 'salt' }).display
    if (challenge.version !== TEMPORAL_POINTER_CHALLENGE_VERSION) {
      throw new Error('expected temporal pointer display')
    }

    let varyingSymbols = 0
    let symbolsWithAddedStrokes = 0

    for (let symbolIndex = 0; symbolIndex < Math.min(6, challenge.wheelSymbols.length); symbolIndex++) {
      const symbol = challenge.wheelSymbols[symbolIndex] as string
      const art = renderAsciiCodeArt(symbol, selectAsciiArtFont(challenge.seed, symbolIndex))
      const first = temporalSymbolArtForFrame(art, challenge, symbolIndex, 3)
      const repeated = temporalSymbolArtForFrame(art, challenge, symbolIndex, 3)
      const next = temporalSymbolArtForFrame(art, challenge, symbolIndex, 4)
      const originalVisibleCells = countAsciiCells(art.rows)

      expect(first.rows).toEqual(repeated.rows)
      expect(first.characterCells).toEqual(repeated.characterCells)
      expect(countAsciiCells(first.rows), `visible cells for symbol ${symbolIndex}`).toBeGreaterThanOrEqual(
        Math.ceil(originalVisibleCells * TEMPORAL_SYMBOL_MIN_VISIBLE_RATIO)
      )

      if (first.rows.join('\n') !== next.rows.join('\n')) varyingSymbols += 1
      if (
        Math.max(
          countAddedAsciiCells(art.rows, first.rows),
          countAddedAsciiCells(art.rows, next.rows)
        ) > 0
      ) {
        symbolsWithAddedStrokes += 1
      }
    }

    expect(varyingSymbols).toBeGreaterThan(0)
    expect(symbolsWithAddedStrokes).toBeGreaterThan(0)
  })

  it('draws temporal grid symbols without cell borders and keeps the shrinking center timeline border', () => {
    const challenge = createChallenge({ seed: 'temporal-style-seed', answerSalt: 'salt' }).display
    if (challenge.version !== TEMPORAL_POINTER_CHALLENGE_VERSION) {
      throw new Error('expected temporal pointer display')
    }

    const assets = renderChallengeAssets(challenge)
    const centerFrames = assets.find((asset) => asset.slot === 'center')?.frames ?? []
    const firstFrame = centerFrames[0]
    const finalFrame = centerFrames[centerFrames.length - 1]
    if (!firstFrame || !finalFrame) throw new Error('expected temporal frames')

    const textColorKeys = new Set(ASCII_ART_CHARACTER_COLORS.map(colorKey))
    const seenTextColors = new Set<string>()

    for (const asset of assets.filter((asset) => asset.slot !== 'center')) {
      const frame = asset.frames[0]
      if (!frame) continue
      for (let index = 0; index < frame.rgba.length; index += 4) {
        const key = `${frame.rgba[index]},${frame.rgba[index + 1]},${frame.rgba[index + 2]},${frame.rgba[index + 3]}`
        if (textColorKeys.has(key)) seenTextColors.add(key)
      }
    }

    expect(seenTextColors.size).toBeGreaterThan(1)
    for (const key of seenTextColors) {
      expect(contrastRatio(colorFromKey(key), [240, 239, 234, 255]), `contrast for ${key}`).toBeGreaterThanOrEqual(
        4.5
      )
    }

    const firstCellFrame = assets.find((asset) => asset.slot === 'W')?.frames[0]
    if (!firstCellFrame) throw new Error('expected temporal cell frame')
    expect(countTimelineBorderPixels(firstCellFrame, [41, 44, 48, 255])).toBeLessThan(120)

    const firstBorderPixels = countTimelineBorderPixels(firstFrame, [41, 44, 48, 255])
    const finalBorderPixels = countTimelineBorderPixels(finalFrame, [41, 44, 48, 255])
    expect(firstBorderPixels).toBeGreaterThan(finalBorderPixels + 1200)
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

  it('draws temporal pause cues without target highlights or the answer sequence', () => {
    const challenge = createChallenge({ seed: 'temporal-cue-seed', answerSalt: 'salt' }).display
    if (challenge.version !== TEMPORAL_POINTER_CHALLENGE_VERSION) {
      throw new Error('expected temporal pointer display')
    }

    const frames = renderChallengeFrames(challenge)
    const captureFrameIndex = challenge.timeline.findIndex((cue) => cue.kind === 'capture')

    expect(captureFrameIndex).toBeGreaterThanOrEqual(0)
    expect(challenge.timeline.some((cue) => cue.kind === 'near-miss')).toBe(false)
    expect(countColorPixels(frames[captureFrameIndex]!.rgba, [170, 64, 54, 255])).toBe(0)
    expect(countColorPixels(frames[captureFrameIndex]!.rgba, [255, 255, 255, 255])).toBe(0)

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

function countColorPixelsInRect(
  frame: Pick<Frame, 'width' | 'height' | 'rgba'>,
  color: readonly [number, number, number, number],
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): number {
  let count = 0
  const left = Math.max(0, minX)
  const top = Math.max(0, minY)
  const right = Math.min(frame.width - 1, maxX)
  const bottom = Math.min(frame.height - 1, maxY)

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const offset = (y * frame.width + x) * 4
      if (
        frame.rgba[offset] === color[0] &&
        frame.rgba[offset + 1] === color[1] &&
        frame.rgba[offset + 2] === color[2] &&
        frame.rgba[offset + 3] === color[3]
      ) {
        count += 1
      }
    }
  }

  return count
}

function countPalettePixelsInRect(
  frame: Pick<Frame, 'width' | 'height' | 'rgba'>,
  colors: ReadonlySet<string>,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): number {
  let count = 0
  const left = Math.max(0, minX)
  const top = Math.max(0, minY)
  const right = Math.min(frame.width - 1, maxX)
  const bottom = Math.min(frame.height - 1, maxY)

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const offset = (y * frame.width + x) * 4
      const key = `${frame.rgba[offset]},${frame.rgba[offset + 1]},${frame.rgba[offset + 2]},${frame.rgba[offset + 3]}`
      if (colors.has(key)) count += 1
    }
  }

  return count
}

function countTimelineBorderPixels(
  frame: Pick<Frame, 'width' | 'height' | 'rgba'>,
  color: readonly [number, number, number, number]
): number {
  const right = frame.width - 8
  const bottom = frame.height - 8

  return (
    countColorPixelsInRect(frame, color, 8, 8, right, 14) +
    countColorPixelsInRect(frame, color, right - 6, 8, right, bottom) +
    countColorPixelsInRect(frame, color, 8, bottom - 6, right, bottom) +
    countColorPixelsInRect(frame, color, 8, 8, 14, bottom)
  )
}

function countAsciiCells(rows: readonly string[]): number {
  return rows.reduce((count, row) => count + row.replaceAll(' ', '').length, 0)
}

function countAddedAsciiCells(originalRows: readonly string[], variantRows: readonly string[]): number {
  const height = Math.max(originalRows.length, variantRows.length)
  let count = 0

  for (let row = 0; row < height; row++) {
    const original = originalRows[row] ?? ''
    const variant = variantRows[row] ?? ''
    const width = Math.max(original.length, variant.length)

    for (let col = 0; col < width; col++) {
      if ((original[col] ?? ' ') === ' ' && (variant[col] ?? ' ') !== ' ') {
        count += 1
      }
    }
  }

  return count
}

function colorKey(color: readonly [number, number, number, number]): string {
  return color.join(',')
}

function colorFromKey(key: string): [number, number, number, number] {
  const [red, green, blue, alpha] = key.split(',').map(Number)
  return [red ?? 0, green ?? 0, blue ?? 0, alpha ?? 255]
}

function readableCharacterAngleDegrees(
  slot: TemporalPointerGridSlot,
  characterIndex: number,
  characterCount: number
): number {
  const center = temporalPointerGridImageRect('center')
  const cell = temporalPointerGridImageRect(slot)
  const readable = temporalPointerGridReadableCharacterRatio(slot, characterIndex, characterCount)
  const centerX = center.left + center.width / 2
  const centerY = center.top + center.height / 2
  const characterX = cell.left + readable.x * cell.width
  const characterY = cell.top + readable.y * cell.height

  return (Math.atan2(characterY - centerY, characterX - centerX) * 180) / Math.PI
}

function angularDistanceDegrees(left: number, right: number): number {
  const delta = Math.abs(normalizeDegrees(left) - normalizeDegrees(right))
  return Math.min(delta, 360 - delta)
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360
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

export const LEGACY_SLIDE_CHALLENGE_VERSION = 1
export const TEMPORAL_POINTER_CHALLENGE_VERSION = 2
export const CHALLENGE_VERSION = TEMPORAL_POINTER_CHALLENGE_VERSION
export const TEMPORAL_POINTER_KIND = 'temporal-pointer'
export const TEMPORAL_POINTER_GRID_LAYOUT = 'direction-grid'
export const TEMPORAL_POINTER_GRID_SLOTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
export const TEMPORAL_POINTER_DIRECTIONS = TEMPORAL_POINTER_GRID_SLOTS
export const TEMPORAL_POINTER_GRID_CENTER_IMAGE_SIZE = 184
export const TEMPORAL_GRID_CELL_CODE_LENGTH_MIN = 2
export const TEMPORAL_GRID_CELL_CODE_LENGTH_MAX = 3
export const CHALLENGE_CHARSET = 'ABCDEFGHJKLMNPQRTUVWXY346789'
export const CODE_LENGTH_MIN = 5
export const CODE_LENGTH_MAX = 6
export const CODE_COUNT_MIN = 3
export const CODE_COUNT_MAX = 7
export const CODE_COUNT_DEFAULT = 5
export const ANIMATION_FRAMES = 16
export const TARGET_INDEX_MIN = 2
export const TARGET_INDEX_MAX = CODE_COUNT_MAX
export const NOISE_LEVEL = 'medium'
export const LOWERCASE_CONFUSABLE_CHARS = 'FTHN'

export type LegacySlideChallengeVersion = typeof LEGACY_SLIDE_CHALLENGE_VERSION
export type TemporalPointerChallengeVersion = typeof TEMPORAL_POINTER_CHALLENGE_VERSION
export type ChallengeVersion = LegacySlideChallengeVersion | TemporalPointerChallengeVersion
export type ChallengeNoiseLevel = typeof NOISE_LEVEL
export type TemporalPointerGridSlot = (typeof TEMPORAL_POINTER_GRID_SLOTS)[number]
export type TemporalPointerDirection = TemporalPointerGridSlot

export interface LegacySlideChallengeParams {
  codeCount?: number
  codeLengths: number[]
  length?: number
  decoyCount: number
  animationFrames: typeof ANIMATION_FRAMES
  charset: typeof CHALLENGE_CHARSET
  noiseLevel: ChallengeNoiseLevel
  targetIndex: number
}

export interface TemporalPointerChallengeParams {
  kind: typeof TEMPORAL_POINTER_KIND
  layout: typeof TEMPORAL_POINTER_GRID_LAYOUT
  codeLength: number
  cellCodeLengths?: number[]
  ringSize: number
  captureCount: number
  decoyPauseCount: number
  frameDelayMs: number
  charset: typeof CHALLENGE_CHARSET
  noiseLevel: ChallengeNoiseLevel
}

export type ChallengeParams = LegacySlideChallengeParams | TemporalPointerChallengeParams

export interface TemporalPointerFrameCue {
  frameIndex: number
  pointerAngleDegrees: number
  pointedSymbolIndex: number
  kind: 'rotation' | 'near-miss' | 'capture'
  captureIndex: number | null
  completedCaptures: number
}

export interface TemporalPointerCharacterTarget {
  targetIndex: number
  slot: TemporalPointerGridSlot
  slotIndex: number
  characterIndex: number
  character: string
  angleDegrees: number
}

export interface LegacySlideDisplayModel {
  version: LegacySlideChallengeVersion
  seed: string
  codes: string[]
  targetIndex: number
  answer: string
  params: LegacySlideChallengeParams
}

export interface TemporalPointerDisplayModel {
  version: TemporalPointerChallengeVersion
  kind: typeof TEMPORAL_POINTER_KIND
  seed: string
  answer: string
  wheelSymbols: string[]
  characterTargets: TemporalPointerCharacterTarget[]
  captureTargets: TemporalPointerCharacterTarget[]
  captureSlots: TemporalPointerGridSlot[]
  captureDirections: TemporalPointerDirection[]
  timeline: TemporalPointerFrameCue[]
  params: TemporalPointerChallengeParams
}

export type ChallengeDisplayModel = LegacySlideDisplayModel | TemporalPointerDisplayModel

export interface ChallengePayloadFields {
  challengeVersion: ChallengeVersion
  seed: string
  challengeParams: ChallengeParams
  answerSalt: string
  answerHash: string
}

export interface GeneratedChallenge {
  display: ChallengeDisplayModel
  payload: ChallengePayloadFields
}

export interface CreateChallengeOptions {
  seed?: string
  answerSalt?: string
  codeCount?: number
}

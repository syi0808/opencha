export const CHALLENGE_VERSION = 1
export const CHALLENGE_CHARSET = 'ABCDEFGHJKLMNPQRTUVWXY346789'
export const CODE_LENGTH_MIN = 4
export const CODE_LENGTH_MAX = 7
export const CODE_COUNT_MIN = 3
export const CODE_COUNT_MAX = 7
export const CODE_COUNT_DEFAULT = 5
export const ANIMATION_FRAMES = 16
export const TARGET_INDEX_MIN = 2
export const TARGET_INDEX_MAX = CODE_COUNT_MAX
export const NOISE_LEVEL = 'medium'

export type ChallengeVersion = typeof CHALLENGE_VERSION
export type ChallengeNoiseLevel = typeof NOISE_LEVEL

export interface ChallengeParams {
  codeCount: number
  codeLengths: number[]
  length?: number
  decoyCount: number
  animationFrames: typeof ANIMATION_FRAMES
  charset: typeof CHALLENGE_CHARSET
  noiseLevel: ChallengeNoiseLevel
  targetIndex: number
}

export interface ChallengeDisplayModel {
  version: ChallengeVersion
  seed: string
  codes: string[]
  targetIndex: number
  answer: string
  params: ChallengeParams
}

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

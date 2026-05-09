export const CHALLENGE_VERSION = 1
export const CHALLENGE_CHARSET = 'ABCDEFGHJKLMNPQRTUVWXY346789'
export const CHALLENGE_LENGTH = 5
export const DECOY_COUNT = 4
export const ANIMATION_FRAMES = 8
export const TARGET_INDEX_MIN = 2
export const TARGET_INDEX_MAX = 5
export const NOISE_LEVEL = 'medium'

export type ChallengeVersion = typeof CHALLENGE_VERSION
export type ChallengeNoiseLevel = typeof NOISE_LEVEL

export interface ChallengeParams {
  length: typeof CHALLENGE_LENGTH
  decoyCount: typeof DECOY_COUNT
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
}

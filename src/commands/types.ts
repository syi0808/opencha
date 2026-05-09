export type OpenchaCommand =
  | { kind: 'answer'; answer: string }
  | { kind: 'approve' }
  | { kind: 'reset' }
  | { kind: 'unknown'; name: string }
  | { kind: 'none' }

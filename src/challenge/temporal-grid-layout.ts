import {
  TEMPORAL_POINTER_GRID_CENTER_IMAGE_SIZE,
  TEMPORAL_POINTER_GRID_SLOTS,
  type TemporalPointerCharacterTarget,
  type TemporalPointerGridSlot
} from './types'

export interface TemporalPointerGridDisplaySize {
  width: number
  height: number
}

export interface TemporalPointerGridImageRect extends TemporalPointerGridDisplaySize {
  left: number
  top: number
}

export type TemporalPointerGridRenderedSlot = TemporalPointerGridSlot | 'center'

export const TEMPORAL_POINTER_GRID_TABLE_ROWS = [
  ['NW', 'N', 'NE'],
  ['W', 'center', 'E'],
  ['SW', 'S', 'SE']
] as const satisfies readonly (readonly TemporalPointerGridRenderedSlot[])[]

export const TEMPORAL_POINTER_GRID_CELL_DISPLAY_SIZES: Record<
  TemporalPointerGridSlot,
  TemporalPointerGridDisplaySize
> = {
  N: { width: 270, height: 190 },
  NE: { width: 230, height: 230 },
  E: { width: 190, height: 270 },
  SE: { width: 230, height: 230 },
  S: { width: 270, height: 190 },
  SW: { width: 230, height: 230 },
  W: { width: 190, height: 270 },
  NW: { width: 230, height: 230 }
}

export const TEMPORAL_POINTER_GRID_CENTER_DISPLAY_SIZE: TemporalPointerGridDisplaySize = {
  width: TEMPORAL_POINTER_GRID_CENTER_IMAGE_SIZE,
  height: TEMPORAL_POINTER_GRID_CENTER_IMAGE_SIZE
}

const TEMPORAL_POINTER_GRID_CODE_RING_RADIUS = 270
const TEMPORAL_POINTER_GRID_SLOT_CENTER_ANGLES: Record<TemporalPointerGridSlot, number> = {
  N: -90,
  NE: -45,
  E: 0,
  SE: 45,
  S: 90,
  SW: 135,
  W: 180,
  NW: 225
}
const TEMPORAL_POINTER_GRID_CARDINAL_CHARACTER_SPAN_DEGREES = 38
const TEMPORAL_POINTER_GRID_DIAGONAL_CHARACTER_SPAN_DEGREES = 12

export function temporalPointerGridDisplaySize(
  slot: TemporalPointerGridRenderedSlot
): TemporalPointerGridDisplaySize {
  return slot === 'center'
    ? TEMPORAL_POINTER_GRID_CENTER_DISPLAY_SIZE
    : TEMPORAL_POINTER_GRID_CELL_DISPLAY_SIZES[slot]
}

export function temporalPointerGridTargetAngleDegrees(slot: TemporalPointerGridSlot): number {
  return TEMPORAL_POINTER_GRID_SLOT_CENTER_ANGLES[slot]
}

export function temporalPointerGridTargetAngleDegreesByIndex(index: number): number {
  return temporalPointerGridDefaultCharacterTargets()[index]?.angleDegrees ?? -90
}

export function temporalPointerGridClosestSlotIndex(angleDegrees: number): number {
  let selectedIndex = 0
  let selectedDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index < TEMPORAL_POINTER_GRID_SLOTS.length; index++) {
    const slot = TEMPORAL_POINTER_GRID_SLOTS[index] as TemporalPointerGridSlot
    const distance = angularDistanceDegrees(angleDegrees, temporalPointerGridTargetAngleDegrees(slot))
    if (distance < selectedDistance) {
      selectedDistance = distance
      selectedIndex = index
    }
  }

  return selectedIndex
}

export function temporalPointerGridCodeAnchorRatio(slot: TemporalPointerGridSlot): { x: number; y: number } {
  return temporalPointerGridAnchorRatioForAngle(slot, temporalPointerGridTargetAngleDegrees(slot))
}

export function temporalPointerGridCharacterAnchorRatio(
  slot: TemporalPointerGridSlot,
  characterIndex: number,
  characterCount: number
): { x: number; y: number } {
  return temporalPointerGridAnchorRatioForAngle(
    slot,
    temporalPointerGridCharacterAngleDegrees(slot, characterIndex, characterCount)
  )
}

export function temporalPointerGridReadableCharacterRatio(
  slot: TemporalPointerGridSlot,
  characterIndex: number,
  characterCount: number
): { x: number; y: number } {
  const distributed = spreadRatio(characterIndex, characterCount)

  switch (slot) {
    case 'N':
      return { x: distributed, y: 0.48 }
    case 'S':
      return { x: distributed, y: 0.52 }
    case 'W':
      return { x: verticalReadableColumnRatio('W', characterIndex), y: distributed }
    case 'E':
      return { x: verticalReadableColumnRatio('E', characterIndex), y: distributed }
    case 'NW':
      return diagonalReadableRatio(characterIndex, characterCount, [
        { x: 0.25, y: 0.75 },
        { x: 0.75, y: 0.25 }
      ])
    case 'NE':
      return diagonalReadableRatio(characterIndex, characterCount, [
        { x: 0.25, y: 0.25 },
        { x: 0.75, y: 0.75 }
      ])
    case 'SE':
      return diagonalReadableRatio(characterIndex, characterCount, [
        { x: 0.75, y: 0.25 },
        { x: 0.25, y: 0.75 }
      ])
    case 'SW':
      return diagonalReadableRatio(characterIndex, characterCount, [
        { x: 0.75, y: 0.75 },
        { x: 0.25, y: 0.25 }
      ])
  }
}

export function temporalPointerGridCharacterAngleDegrees(
  slot: TemporalPointerGridSlot,
  characterIndex: number,
  characterCount: number
): number {
  const offsets = temporalPointerGridCharacterAngleOffsets(slot, characterCount)
  return temporalPointerGridTargetAngleDegrees(slot) + (offsets[characterIndex] ?? 0)
}

export function temporalPointerGridCharacterTargets(
  codes: readonly string[]
): TemporalPointerCharacterTarget[] {
  const targets: TemporalPointerCharacterTarget[] = []

  for (let slotIndex = 0; slotIndex < TEMPORAL_POINTER_GRID_SLOTS.length; slotIndex++) {
    const slot = TEMPORAL_POINTER_GRID_SLOTS[slotIndex] as TemporalPointerGridSlot
    const code = codes[slotIndex] ?? ''

    for (let characterIndex = 0; characterIndex < code.length; characterIndex++) {
      targets.push({
        targetIndex: targets.length,
        slot,
        slotIndex,
        characterIndex,
        character: code[characterIndex] as string,
        angleDegrees: temporalPointerGridCharacterAngleDegrees(slot, characterIndex, code.length)
      })
    }
  }

  return targets
}

export function temporalPointerGridClosestCharacterTargetIndex(
  angleDegrees: number,
  targets: readonly Pick<TemporalPointerCharacterTarget, 'angleDegrees'>[]
): number {
  let selectedIndex = 0
  let selectedDistance = Number.POSITIVE_INFINITY

  for (let index = 0; index < targets.length; index++) {
    const target = targets[index]
    if (!target) continue

    const distance = angularDistanceDegrees(angleDegrees, target.angleDegrees)
    if (distance < selectedDistance) {
      selectedDistance = distance
      selectedIndex = index
    }
  }

  return selectedIndex
}

function temporalPointerGridAnchorRatioForAngle(
  slot: TemporalPointerGridSlot,
  angleDegrees: number
): { x: number; y: number } {
  const metrics = temporalPointerGridTableMetrics()
  const rect = temporalPointerGridImageRect(slot)
  const radians = degreesToRadians(angleDegrees)
  const targetX = metrics.centerX + Math.cos(radians) * TEMPORAL_POINTER_GRID_CODE_RING_RADIUS
  const targetY = metrics.centerY + Math.sin(radians) * TEMPORAL_POINTER_GRID_CODE_RING_RADIUS

  return {
    x: (targetX - rect.left) / rect.width,
    y: (targetY - rect.top) / rect.height
  }
}

function temporalPointerGridDefaultCharacterTargets(): TemporalPointerCharacterTarget[] {
  const defaultCodes = TEMPORAL_POINTER_GRID_SLOTS.map((slot) => 'X'.repeat(defaultCharacterCount(slot)))
  return temporalPointerGridCharacterTargets(defaultCodes)
}

function temporalPointerGridCharacterAngleOffsets(
  slot: TemporalPointerGridSlot,
  characterCount: number
): number[] {
  if (characterCount <= 1) return [0]

  const span = slot.length === 1
    ? TEMPORAL_POINTER_GRID_CARDINAL_CHARACTER_SPAN_DEGREES
    : TEMPORAL_POINTER_GRID_DIAGONAL_CHARACTER_SPAN_DEGREES
  const start = -span / 2
  const step = span / (characterCount - 1)
  const offsets = Array.from({ length: characterCount }, (_unused, index) => start + step * index)

  return shouldReverseCharacterOffsets(slot) ? offsets.reverse() : offsets
}

function shouldReverseCharacterOffsets(slot: TemporalPointerGridSlot): boolean {
  return slot === 'S' || slot === 'W'
}

function defaultCharacterCount(slot: TemporalPointerGridSlot): number {
  return slot.length === 1 ? 3 : 2
}

function spreadRatio(index: number, count: number): number {
  if (count <= 1) return 0.5

  const start = 0.12
  const end = 0.88
  return start + ((end - start) * index) / (count - 1)
}

function verticalReadableColumnRatio(slot: 'E' | 'W', index: number): number {
  const isOuterColumn = index % 2 === 0

  if (slot === 'W') return isOuterColumn ? 0.32 : 0.58
  return isOuterColumn ? 0.68 : 0.42
}

function diagonalReadableRatio(
  index: number,
  count: number,
  points: readonly [{ x: number; y: number }, { x: number; y: number }]
): { x: number; y: number } {
  if (count <= 1) return { x: 0.5, y: 0.5 }

  const progress = index / (count - 1)
  const [start, end] = points
  return {
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress
  }
}

export function temporalPointerGridImageRect(slot: TemporalPointerGridRenderedSlot): TemporalPointerGridImageRect {
  const metrics = temporalPointerGridTableMetrics()
  const position = temporalPointerGridPosition(slot)
  const size = temporalPointerGridDisplaySize(slot)
  const cellLeft = metrics.columnOffsets[position.col] as number
  const cellTop = metrics.rowOffsets[position.row] as number
  const cellWidth = metrics.columnWidths[position.col] as number
  const cellHeight = metrics.rowHeights[position.row] as number

  return {
    left: cellLeft + (cellWidth - size.width) / 2,
    top: cellTop + (cellHeight - size.height) / 2,
    width: size.width,
    height: size.height
  }
}

function temporalPointerGridTableMetrics(): {
  columnWidths: readonly number[]
  rowHeights: readonly number[]
  columnOffsets: readonly number[]
  rowOffsets: readonly number[]
  centerX: number
  centerY: number
} {
  const columnWidths = [0, 0, 0]
  const rowHeights = [0, 0, 0]

  for (let row = 0; row < TEMPORAL_POINTER_GRID_TABLE_ROWS.length; row++) {
    const slots = TEMPORAL_POINTER_GRID_TABLE_ROWS[row]
    if (!slots) continue

    for (let col = 0; col < slots.length; col++) {
      const slot = slots[col] as TemporalPointerGridRenderedSlot
      const size = temporalPointerGridDisplaySize(slot)
      columnWidths[col] = Math.max(columnWidths[col] as number, size.width)
      rowHeights[row] = Math.max(rowHeights[row] as number, size.height)
    }
  }

  const columnOffsets = offsetsFor(columnWidths)
  const rowOffsets = offsetsFor(rowHeights)

  return {
    columnWidths,
    rowHeights,
    columnOffsets,
    rowOffsets,
    centerX: (columnOffsets[1] as number) + (columnWidths[1] as number) / 2,
    centerY: (rowOffsets[1] as number) + (rowHeights[1] as number) / 2
  }
}

function temporalPointerGridPosition(slot: TemporalPointerGridRenderedSlot): { row: number; col: number } {
  for (let row = 0; row < TEMPORAL_POINTER_GRID_TABLE_ROWS.length; row++) {
    const slots = TEMPORAL_POINTER_GRID_TABLE_ROWS[row]
    if (!slots) continue

    for (let col = 0; col < slots.length; col++) {
      if (slots[col] === slot) return { row, col }
    }
  }

  throw new Error(`Unknown temporal pointer grid slot: ${slot}`)
}

function offsetsFor(lengths: readonly number[]): number[] {
  const offsets: number[] = []
  let current = 0

  for (const length of lengths) {
    offsets.push(current)
    current += length
  }

  return offsets
}

function angularDistanceDegrees(left: number, right: number): number {
  const delta = Math.abs(normalizeDegrees(left) - normalizeDegrees(right))
  return Math.min(delta, 360 - delta)
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180
}

export const CLASSIC_SLICE_TOOL_ID = 'classic-knife' as const
export const RAINBOW_SLICE_TOOL_ID = 'rainbow-knife' as const

export const SLICE_TOOL_IDS = [
  CLASSIC_SLICE_TOOL_ID,
  RAINBOW_SLICE_TOOL_ID,
] as const

export type SliceToolId = (typeof SLICE_TOOL_IDS)[number]

export const DEFAULT_SLICE_TOOL_ID: SliceToolId = CLASSIC_SLICE_TOOL_ID
export const SELECTED_SLICE_TOOL_STORAGE_KEY =
  'oneul-mwo-sseol-selected-slice-tool-v1'

export const RAINBOW_TRAIL_COLORS = Object.freeze([
  0xff5b78,
  0xff984d,
  0xffd84d,
  0x55df86,
  0x4dd9ed,
  0x668cff,
  0xc77dff,
] as const)

export type SliceToolPreferenceStorage = Pick<
  Storage,
  'getItem' | 'setItem'
>

export function isSliceToolId(value: unknown): value is SliceToolId {
  return SLICE_TOOL_IDS.some((toolId) => toolId === value)
}

export function loadSelectedSliceTool(
  storage: SliceToolPreferenceStorage | null,
): SliceToolId {
  if (!storage) {
    return DEFAULT_SLICE_TOOL_ID
  }

  try {
    const stored = storage.getItem(SELECTED_SLICE_TOOL_STORAGE_KEY)
    return isSliceToolId(stored) ? stored : DEFAULT_SLICE_TOOL_ID
  } catch {
    return DEFAULT_SLICE_TOOL_ID
  }
}

export function saveSelectedSliceTool(
  storage: SliceToolPreferenceStorage | null,
  toolId: SliceToolId,
): void {
  if (!storage) {
    return
  }

  try {
    storage.setItem(SELECTED_SLICE_TOOL_STORAGE_KEY, toolId)
  } catch {
    // Tool selection stays usable in memory when storage is unavailable.
  }
}

export function getRainbowTrailColor(segmentIndex: number): number {
  const safeIndex = Number.isFinite(segmentIndex)
    ? Math.max(0, Math.floor(segmentIndex))
    : 0
  return RAINBOW_TRAIL_COLORS[safeIndex % RAINBOW_TRAIL_COLORS.length]!
}

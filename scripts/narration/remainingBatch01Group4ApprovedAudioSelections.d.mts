export interface RemainingBatch01Group4ApprovedSelection {
  readonly menuId:
    | 'dakgalbi'
    | 'bossam'
    | 'bulgogi'
    | 'fried-chicken'
    | 'pizza'
    | 'dak-hanmari'
  readonly tone: 'deadpan' | 'alert' | 'epic'
  readonly catalogText: string
  readonly spokenText: string
  readonly sourcePreviewPath: string
  readonly targetAssetPath: string
  readonly byteLength: number
  readonly sha256: string
  readonly mpegFrameCount: number
  readonly exactDurationSeconds: number
  readonly modelId: 'flash' | 'mai-voice-2'
  readonly model: 'MAI-Voice-2-Flash' | 'MAI-Voice-2'
  readonly voiceId: 'junho'
  readonly voiceShortName: string
  readonly style: 'joyful' | 'determined'
  readonly styleDegree: number
  readonly rate: string
  readonly pitch: string
  readonly structure: 'one-block' | 'adjacent-two-block'
  readonly segments: readonly string[]
  readonly sourceManifest: typeof REMAINING_BATCH_01_GROUP_4_SOURCE_MANIFEST
  readonly approvalEvidence: Readonly<{
    userStatement: string
    reviewedAt: '2026-08-10'
  }>
  readonly humanApproved: true
  readonly approvalState: 'unconditional-raw-take-approved'
  readonly deploymentStatus: 'active'
  readonly currentlyDeployed: true
  readonly byteCopyVerified: true
  readonly postprocessingApplied: false
  readonly additionalAzureRequests: 0
}

export const REMAINING_BATCH_01_GROUP_4_APPROVAL_QUOTE: string
export const REMAINING_BATCH_01_GROUP_4_SOURCE_MANIFEST: Readonly<{
  path: string
  byteLength: 42007
  sha256: string
  schemaVersion: 2
  generatedAt: string
  region: 'southeastasia'
  outputFormat: 'audio-24khz-160kbitrate-mono-mp3'
  totalSynthesisRequests: 28
  retries: 0
  postprocessingApplied: false
}>
export const REMAINING_BATCH_01_GROUP_4_APPROVED_NARRATION_SELECTIONS:
  readonly RemainingBatch01Group4ApprovedSelection[]
export const REMAINING_BATCH_01_GROUP_4_WITHHELD_JOKBAL_SELECTION: Readonly<{
  menuId: 'jokbal'
  oldCatalogText: string
  requestedCatalogText: string
  tone: 'playful'
  sourcePreviewPath: string
  byteLength: number
  sha256: string
  mpegFrameCount: number
  exactDurationSeconds: number
  originalPerformance: Readonly<{
    modelId: 'flash'
    model: 'MAI-Voice-2-Flash'
    voiceShortName: 'ko-KR-Junho:MAI-Voice-2-Flash'
    style: 'joyful'
    styleDegree: 0.48
    rate: '+22%'
    pitch: '+0%'
    structure: 'adjacent-two-block'
    segments: readonly string[]
  }>
  userFeedback: string
  approvalState: 'retake-requested-copy-missing-important-word'
  humanApproved: false
  deploymentStatus: 'withheld-source-not-integrated'
  currentlyDeployed: false
  runtimeIntegrationAttempted: false
}>

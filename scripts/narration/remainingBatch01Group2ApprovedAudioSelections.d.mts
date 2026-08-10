export interface RemainingBatch01Group2ApprovedSelection {
  readonly menuId: string
  readonly tone: string
  readonly catalogText: string
  readonly spokenText: string
  readonly sourcePreviewPath: string
  readonly targetAssetPath: string
  readonly byteLength: number
  readonly sha256: string
  readonly mpegFrameCount: number
  readonly exactDurationSeconds: number
  readonly model: 'MAI-Voice-2-Flash'
  readonly voiceId: 'junho' | 'haena'
  readonly voiceShortName:
    | 'ko-KR-Junho:MAI-Voice-2-Flash'
    | 'ko-KR-Haena:MAI-Voice-2-Flash'
  readonly style: 'joyful' | 'determined'
  readonly styleDegree: number
  readonly rate: string
  readonly pitch: string
  readonly structure: 'one-block' | 'adjacent-two-block'
  readonly segments: readonly string[]
  readonly durationReview: {
    readonly status:
      | 'human-approved-raw-take'
      | 'human-listening-exception'
    readonly exactDurationSeconds: number
    readonly userAcceptedRawTake: true
    readonly trimApplied: false
  }
  readonly sourceManifest: {
    readonly path: string
    readonly byteLength: number
    readonly sha256: string
    readonly schemaVersion: 2
    readonly generatedAt: string
    readonly region: 'southeastasia'
    readonly outputFormat: 'audio-24khz-160kbitrate-mono-mp3'
    readonly totalSynthesisRequests: 28
    readonly retries: 0
    readonly postprocessingApplied: false
  }
  readonly humanApproved: true
  readonly approvalState: 'unconditional-raw-take-approved'
  readonly approvalEvidence: {
    readonly userStatement: string
    readonly reviewedAt: '2026-08-10'
  }
  readonly deploymentStatus: 'active'
  readonly currentlyDeployed: true
  readonly byteCopyVerified: true
  readonly postprocessingApplied: false
  readonly additionalAzureRequests: 0
}

export const REMAINING_BATCH_01_GROUP_2_APPROVAL_QUOTE: string
export const REMAINING_BATCH_01_GROUP_2_SOURCE_MANIFEST: RemainingBatch01Group2ApprovedSelection['sourceManifest']
export const REMAINING_BATCH_01_GROUP_2_APPROVED_NARRATION_SELECTIONS: readonly RemainingBatch01Group2ApprovedSelection[]
export const REMAINING_BATCH_01_GROUP_2_REJECTED_KALGUKSU: Readonly<{
  menuId: 'kalguksu'
  rejectedCatalogText: string
  rejectedSourcePreviewPath: string
  rejectedByteLength: number
  rejectedSha256: string
  rejectedMpegFrameCount: number
  rejectedExactDurationSeconds: number
  replacementCatalogText: '칼은 위협용!'
  userStatement: string
  humanApproved: false
  deploymentStatus: 'rejected-source-not-integrated'
  currentlyDeployed: false
  runtimeIntegrationAttempted: false
}>

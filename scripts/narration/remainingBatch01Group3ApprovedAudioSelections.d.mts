export interface RemainingBatch01Group3ApprovedSelection {
  readonly menuId:
    | 'gimbap'
    | 'sandwich'
    | 'korean-toast'
    | 'samgyeopsal'
    | 'grilled-galbi'
  readonly tone: 'deadpan' | 'alert' | 'playful'
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
  readonly voiceId: 'junho' | 'haena'
  readonly voiceShortName: string
  readonly style: 'joyful' | 'determined'
  readonly styleDegree: number
  readonly rate: string
  readonly pitch: string
  readonly structure: 'one-block' | 'adjacent-two-block'
  readonly segments: readonly string[]
  readonly neutralNoImpersonation: boolean
  readonly sourceManifest: typeof REMAINING_BATCH_01_GROUP_3_SOURCE_MANIFEST
  readonly approvalEvidence: {
    readonly userStatement: string
    readonly reviewedAt: '2026-08-10'
  }
  readonly humanApproved: true
  readonly approvalState: 'unconditional-raw-take-approved'
  readonly deploymentStatus: 'active'
  readonly currentlyDeployed: true
  readonly byteCopyVerified: true
  readonly postprocessingApplied: false
  readonly additionalAzureRequests: 0
}

export interface RemainingBatch01Group3WithheldSelection {
  readonly menuId: 'tteokbokki' | 'hamburger'
  readonly catalogText: string
  readonly sourcePreviewPath: string
  readonly byteLength: number
  readonly sha256: string
  readonly mpegFrameCount: number
  readonly exactDurationSeconds: number
  readonly userFeedback: string
  readonly approvalState:
    | 'retake-requested-leading-copy-clipped'
    | 'retake-requested-faster-repetition'
  readonly humanApproved: false
  readonly deploymentStatus: 'withheld-source-not-integrated'
  readonly currentlyDeployed: false
  readonly runtimeIntegrationAttempted: false
}

export const REMAINING_BATCH_01_GROUP_3_APPROVAL_QUOTE: string
export const REMAINING_BATCH_01_GROUP_3_SOURCE_MANIFEST: {
  readonly path: string
  readonly byteLength: 42007
  readonly sha256: string
  readonly schemaVersion: 2
  readonly generatedAt: string
  readonly region: 'southeastasia'
  readonly outputFormat: 'audio-24khz-160kbitrate-mono-mp3'
  readonly totalSynthesisRequests: 28
  readonly retries: 0
  readonly postprocessingApplied: false
}
export const REMAINING_BATCH_01_GROUP_3_APPROVED_NARRATION_SELECTIONS:
  readonly RemainingBatch01Group3ApprovedSelection[]
export const REMAINING_BATCH_01_GROUP_3_WITHHELD_NARRATION_SELECTIONS:
  readonly RemainingBatch01Group3WithheldSelection[]

export interface RemainingBatch01Group1SourceManifest {
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

export interface RemainingBatch01Group1ApprovedSelection {
  readonly menuId: string
  readonly catalogText: string
  readonly spokenText: string
  readonly sourcePreviewPath: string
  readonly targetAssetPath: string
  readonly byteLength: number
  readonly sha256: string
  readonly mpegFrameCount: number
  readonly exactDurationSeconds: number
  readonly model: 'MAI-Voice-2-Flash' | 'MAI-Voice-2'
  readonly voiceId: 'junho'
  readonly voiceShortName:
    | 'ko-KR-Junho:MAI-Voice-2-Flash'
    | 'ko-KR-Junho:MAI-Voice-2'
  readonly style: 'joyful' | 'determined'
  readonly styleDegree: number
  readonly rate: string
  readonly pitch: string
  readonly structure: 'one-block' | 'adjacent-two-block'
  readonly segments: readonly string[]
  readonly sourceManifest: RemainingBatch01Group1SourceManifest
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

export const REMAINING_BATCH_01_GROUP_1_APPROVAL_QUOTE: string
export const REMAINING_BATCH_01_GROUP_1_KIMCHI_VOICE_APPROVAL_QUOTE: string
export const REMAINING_BATCH_01_GROUP_1_SOURCE_MANIFEST: RemainingBatch01Group1SourceManifest
export const REMAINING_BATCH_01_GROUP_1_APPROVED_NARRATION_SELECTIONS: readonly RemainingBatch01Group1ApprovedSelection[]
export const REMAINING_BATCH_01_GROUP_1_CONDITIONAL_KIMCHI_FRIED_RICE: Readonly<{
  menuId: 'kimchi-fried-rice'
  catalogText: string
  spokenText: string
  sourcePreviewPath: string
  byteLength: number
  sha256: string
  mpegFrameCount: number
  exactDurationSeconds: number
  model: 'MAI-Voice-2-Flash'
  voiceId: 'haena'
  voiceShortName: 'ko-KR-Haena:MAI-Voice-2-Flash'
  style: 'joyful'
  styleDegree: number
  rate: string
  pitch: string
  structure: 'one-block'
  segments: readonly string[]
  humanApproved: false
  conditionalHumanApproval: true
  approvalState: 'leading-silence-trim-required'
  trimInstruction: string
  approvalEvidence: {
    readonly userStatement: string
    readonly performanceLockStatement: string
    readonly reviewedAt: '2026-08-10'
  }
  deploymentStatus: 'source-withheld-after-approved-local-trim'
  currentlyDeployed: false
  runtimeIntegrationAttempted: false
}>

export const REMAINING_BATCH_01_GROUP_1_APPROVED_KIMCHI_FRIED_RICE_TRIM: Readonly<{
  menuId: 'kimchi-fried-rice'
  catalogText: string
  spokenText: string
  sourceRaw: typeof REMAINING_BATCH_01_GROUP_1_CONDITIONAL_KIMCHI_FRIED_RICE
  sourceTrimCandidatePath: string
  targetAssetPath: string
  trimManifest: {
    readonly path: string
    readonly byteLength: number
    readonly sha256: string
    readonly schemaVersion: 1
    readonly generatedAt: string
  }
  byteLength: number
  sha256: string
  container: 'WAVE'
  encoding: 'IEEE 32-bit float PCM'
  sampleRate: 24000
  channels: 1
  sampleCount: number
  exactDurationSeconds: number
  retainedPcmSha256: string
  trim: {
    readonly mode: 'leading-only'
    readonly removedLeadingSamples: number
    readonly removedLeadingSeconds: number
    readonly removedTailSamples: 0
    readonly retainedNaturalHeadSamples: number
    readonly retainedNaturalHeadSeconds: number
    readonly fadesApplied: false
    readonly normalized: false
    readonly resampled: false
    readonly gainApplied: false
    readonly retainedPcmBitExact: true
    readonly sourceOutputMismatchSamples: 0
  }
  model: 'MAI-Voice-2-Flash'
  voiceId: 'haena'
  voiceShortName: 'ko-KR-Haena:MAI-Voice-2-Flash'
  style: 'joyful'
  styleDegree: number
  rate: string
  pitch: string
  structure: 'one-block'
  segments: readonly string[]
  humanApproved: true
  approvalState: 'conditional-leading-gap-trim-satisfied'
  approvalEvidence: {
    readonly userStatement: string
    readonly performanceLockStatement: string
    readonly reviewedAt: '2026-08-10'
  }
  deploymentStatus: 'active'
  currentlyDeployed: true
  byteCopyVerified: true
  postprocessingApplied: 'leading-only-local-pcm-trim'
  additionalAzureRequests: 0
}>

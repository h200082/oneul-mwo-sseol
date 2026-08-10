export interface ShabuShabuSilenceTrimApprovedNarrationSelection {
  readonly menuId: 'shabu-shabu'
  readonly catalogText: string
  readonly spokenText: string
  readonly sourcePreviewPath: string
  readonly targetAssetPath: string
  readonly originalSlowRetakePath: string
  readonly localEditManifestPath: string
  readonly historicalAssetPath: string
  readonly byteLength: number
  readonly sha256: string
  readonly sampleRate: 24000
  readonly channels: 1
  readonly sampleCount: number
  readonly actualDurationSeconds: number
  readonly container: 'WAVE'
  readonly encoding: 'IEEE 32-bit float PCM'
  readonly voiceId: 'junho'
  readonly voiceShortName: string
  readonly style: 'determined'
  readonly styleDegree: number
  readonly rate: string
  readonly pitch: string
  readonly localEdit: Readonly<{
    decoder: string
    detectedHeadSeconds: number
    detectedTailSeconds: number
    retainedHeadSeconds: number
    retainedTailSeconds: number
    removedHeadSeconds: number
    removedTailSeconds: number
    boundaryFadeSeconds: number
    activeSpeechEstimateSeconds: number
    longestInternalGapSeconds: number
    activeSpeechFloat32Sha256: string
    activeSpeechPcmBitExact: true
    activeSpeechMismatchSamples: 0
    additionalAzureRequests: 0
    wordAligned: false
  }>
  readonly humanApproved: true
  readonly approvalEvidence: Readonly<{
    userStatement: '샤부샤부 좋아 맘에들어'
    reviewedAt: string
  }>
  readonly deploymentStatus: 'active'
  readonly currentlyDeployed: true
  readonly durationReview: Readonly<{
    status: 'human-approved-boundary-silence-trim'
    activeSpeechTargetMinimumSeconds: number
    activeSpeechTargetMaximumSeconds: number
    hardMaximumSeconds: number
    note: string
  }>
}

export const SHABU_SHABU_SILENCE_TRIM_APPROVED_NARRATION_SELECTIONS:
  readonly ShabuShabuSilenceTrimApprovedNarrationSelection[]

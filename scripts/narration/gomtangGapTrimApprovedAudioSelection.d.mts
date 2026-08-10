export interface GomtangGapTrimApprovedNarrationSelection {
  readonly menuId: 'gomtang'
  readonly catalogText: string
  readonly spokenText: string
  readonly sourcePreviewPath: string
  readonly targetAssetPath: string
  readonly originalSlowRetakePath: string
  readonly localEditManifestPath: string
  readonly localEditManifestByteLength: number
  readonly localEditManifestSha256: string
  readonly historicalAssetPath: string
  readonly historicalAssetSha256: string
  readonly byteLength: number
  readonly sha256: string
  readonly pcmSha256: string
  readonly sampleRate: 24000
  readonly channels: 1
  readonly sampleCount: number
  readonly actualDurationSeconds: number
  readonly container: 'WAVE'
  readonly encoding: 'IEEE 32-bit float PCM'
  readonly voiceId: 'junho'
  readonly voiceShortName: string
  readonly style: 'joyful'
  readonly styleDegree: number
  readonly rate: string
  readonly pitch: string
  readonly originalSlowRetake: Readonly<{
    byteLength: number
    sha256: string
    pcmSha256: string
    sampleCount: number
    actualDurationSeconds: number
  }>
  readonly localEdit: Readonly<{
    decoder: string
    rmsWindowMilliseconds: number
    rmsHopMilliseconds: number
    selectionThresholdDbfs: number
    removedIntervals: readonly Readonly<{
      startSample: number
      endSample: number
      startSeconds: number
      endSeconds: number
      durationSeconds: number
      retainedGapSeconds: number
      joinDelta: number
    }>[]
    totalRemovedSamples: number
    totalRemovedSeconds: number
    maximumInternalGapSecondsAtMinus45: number
    maximumInternalGapSecondsAtMinus40: number
    retainedPcmBitExact: true
    retainedSampleMismatchCount: 0
    resampled: false
    normalized: false
    faded: false
    headAndTailPreserved: true
    additionalAzureRequests: 0
    wordAligned: false
  }>
  readonly humanApproved: true
  readonly approvalEvidence: Readonly<{
    preliminaryUserStatement: string
    userStatement: '곰탕은 맘에들어.'
    reviewedAt: string
  }>
  readonly deploymentStatus: 'active'
  readonly currentlyDeployed: true
  readonly durationReview: Readonly<{
    status: 'human-listening-exception-after-local-gap-trim'
    targetHardMaximumSeconds: number
    actualDurationSeconds: number
    note: string
  }>
}

export const GOMTANG_GAP_TRIM_APPROVED_NARRATION_SELECTIONS:
  readonly GomtangGapTrimApprovedNarrationSelection[]

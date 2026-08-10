export interface CheonggukjangPunchAdjustedApprovedNarrationSelection {
  readonly menuId: 'cheonggukjang'
  readonly catalogText: string
  readonly spokenText: string
  readonly sourcePreviewPath: string
  readonly targetAssetPath: string
  readonly originalAzurePreviewPath: string
  readonly baseSynthesisManifestPath: string
  readonly localAdjustmentManifestPath: string
  readonly byteLength: number
  readonly sha256: string
  readonly mpegFrameCount: number
  readonly actualDurationSeconds: number
  readonly outputFormat: string
  readonly voiceId: 'junho'
  readonly voiceShortName: string
  readonly style: 'joyful'
  readonly styleDegree: number
  readonly rate: string
  readonly pitch: string
  readonly localAdjustment: Readonly<{
    variant: 'B'
    method: 'mpeg-layer-iii-global-gain'
    requestedSteadyAttenuationDb: number
    appliedSteadyAttenuationDb: number
    intervalStartSeconds: number
    intervalEndSeconds: number
    rampSeconds: number
    additionalAzureRequests: 0
    wordAligned: false
  }>
  readonly humanApproved: true
  readonly approvalEvidence: Readonly<{
    userStatement: '청국장은 B가 좋아'
    reviewedAt: string
  }>
  readonly deploymentStatus: 'active'
  readonly currentlyDeployed: true
  readonly durationReview: Readonly<{
    status: 'human-listening-exception'
    targetMinimumSeconds: number
    targetMaximumSeconds: number
    hardMaximumSeconds: number
    note: string
  }>
}

export const CHEONGGUKJANG_PUNCH_ADJUSTED_APPROVED_NARRATION_SELECTIONS:
  readonly CheonggukjangPunchAdjustedApprovedNarrationSelection[]

export interface FinalRetakeGapTrimRejectedNarrationSelection {
  readonly menuId: 'pasta' | 'bulgogi-deopbap'
  readonly catalogText: string
  readonly rawFinalRetakePath: string
  readonly rawFinalRetakeSha256: string
  readonly localCandidatePath: string
  readonly localCandidateSha256: string
  readonly reviewStatus: 'rejected-after-user-listening'
  readonly humanApproved: false
  readonly runtimeIntegrationProhibited: true
  readonly currentlyDeployed: false
  readonly reviewedAt: string
}

export const FINAL_RETAKE_GAP_TRIM_REJECTED_NARRATION_SELECTIONS:
  readonly FinalRetakeGapTrimRejectedNarrationSelection[]

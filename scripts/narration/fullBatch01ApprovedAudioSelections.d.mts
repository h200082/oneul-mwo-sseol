export type FullBatch01ApprovedSelectionId =
  | 'doenjang-jjigae'
  | 'sundubu-jjigae'
  | 'gamjatang'
  | 'seolleongtang'
  | 'galbitang'
  | 'samgyetang'
  | 'kongnamul-gukbap'

export interface FullBatch01ApprovedAudioSelection {
  readonly menuId: FullBatch01ApprovedSelectionId
  readonly sourcePreviewPath: string
  readonly targetAssetPath: string
  readonly byteLength: number
  readonly sha256: string
  readonly approximateDurationSeconds: number
  readonly humanApproved: true
  readonly deploymentStatus: 'active'
  readonly currentlyDeployed: true
  readonly selection:
    | 'full-batch-01'
    | 'full-batch-01-retake-01'
    | 'full-batch-01-retake-03'
    | 'seolleongtang-copy-pilot-01-b'
  readonly durationReview: {
    readonly status: 'within-hard-maximum' | 'human-listening-exception'
    readonly targetHardMaximumSeconds: 2
    readonly note?: string
  }
}

export interface FullBatch01RetiredAudioSelection {
  readonly menuId: 'gomtang'
  readonly sourcePreviewPath: string
  readonly targetAssetPath: string
  readonly byteLength: number
  readonly sha256: string
  readonly approximateDurationSeconds: number
  readonly humanApproved: true
  readonly deploymentStatus: 'retired-catalog-copy-mismatch'
  readonly currentlyDeployed: false
  readonly historicalCatalogText: '곰은 없고 진국만 있다!'
  readonly retirementReason: string
  readonly selection: 'full-batch-01-retake-01'
  readonly durationReview: {
    readonly status: 'within-hard-maximum'
    readonly targetHardMaximumSeconds: 2
  }
}

export const FULL_BATCH_01_APPROVED_NARRATION_SELECTIONS:
  readonly FullBatch01ApprovedAudioSelection[]

export const FULL_BATCH_01_RETIRED_NARRATION_SELECTIONS:
  readonly FullBatch01RetiredAudioSelection[]

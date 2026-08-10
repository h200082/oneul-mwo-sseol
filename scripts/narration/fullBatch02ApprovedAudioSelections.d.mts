export type FullBatch02ApprovedSelectionId =
  | 'dwaeji-gukbap'
  | 'sundae-guk'
  | 'home-style-baekban'
  | 'bibimbap'
  | 'chicken-mayo-deopbap'

export interface FullBatch02ApprovedAudioSelection {
  readonly menuId: FullBatch02ApprovedSelectionId
  readonly catalogText: string
  readonly spokenText: string
  readonly sourcePreviewPath: string
  readonly targetAssetPath: string
  readonly byteLength: number
  readonly sha256: string
  readonly actualDurationSeconds: number
  readonly voiceId: 'junho'
  readonly voiceShortName: 'ko-KR-Junho:MAI-Voice-2-Flash'
  readonly style: 'joyful' | 'determined'
  readonly styleDegree: number
  readonly rate: '+45%' | '+50%'
  readonly pitch: '+0%'
  readonly selection: 'full-batch-02'
  readonly humanApproved: true
  readonly approvalEvidence: {
    readonly userStatement: '나머지는 괜찮다'
    readonly reviewedAt: '2026-08-09'
  }
  readonly deploymentStatus: 'active'
  readonly currentlyDeployed: true
  readonly durationReview: {
    readonly status:
      | 'within-target'
      | 'within-hard-maximum'
      | 'human-listening-exception'
    readonly targetMinimumSeconds: 1.2
    readonly targetMaximumSeconds: 1.8
    readonly hardMaximumSeconds: 2
    readonly note?: string
  }
}

export const FULL_BATCH_02_APPROVED_NARRATION_SELECTIONS:
  readonly FullBatch02ApprovedAudioSelection[]

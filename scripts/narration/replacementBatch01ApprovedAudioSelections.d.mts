export interface ReplacementBatch01ApprovedAudioSelection {
  readonly menuId: 'jeyuk-deopbap'
  readonly catalogText: '제육덮밥 메뉴 고민 강제 종료!'
  readonly spokenText: '제육덮밥 메뉴 고민 강제 종료!'
  readonly sourcePreviewPath: string
  readonly targetAssetPath: string
  readonly supersededPreviewPath: string
  readonly replacementReason: 'listening-retake'
  readonly byteLength: 43_680
  readonly sha256: string
  readonly mpegFrameCount: 91
  readonly actualDurationSeconds: 2.184
  readonly outputFormat: 'audio-24khz-160kbitrate-mono-mp3'
  readonly voiceId: 'junho'
  readonly voiceShortName: 'ko-KR-Junho:MAI-Voice-2-Flash'
  readonly style: 'joyful'
  readonly styleDegree: 0.62
  readonly rate: '+45%'
  readonly pitch: '-1%'
  readonly selection: 'replacement-batch-01'
  readonly humanApproved: true
  readonly approvalEvidence: {
    readonly userStatement: '제육덮밥은 새 음원이 나아'
    readonly reviewedAt: '2026-08-09'
  }
  readonly deploymentStatus: 'active'
  readonly currentlyDeployed: true
  readonly durationReview: {
    readonly status: 'human-listening-exception'
    readonly targetMinimumSeconds: 1.2
    readonly targetMaximumSeconds: 1.8
    readonly hardMaximumSeconds: 2
    readonly note: string
  }
}

export const REPLACEMENT_BATCH_01_APPROVED_NARRATION_SELECTIONS:
  readonly ReplacementBatch01ApprovedAudioSelection[]

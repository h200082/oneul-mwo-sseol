export type FinalTiebreakApprovedSelectionId =
  | 'pasta'
  | 'bulgogi-deopbap'

export interface FinalTiebreakRevealPin {
  readonly path: string
  readonly byteLength: number
  readonly sha256: string
}

export interface FinalTiebreakApprovedAudioSelection {
  readonly menuId: FinalTiebreakApprovedSelectionId
  readonly catalogText: string
  readonly spokenText: string
  readonly sourcePreviewPath: string
  readonly targetAssetPath: string
  readonly generationSourcePath: string
  readonly generationManifest: {
    readonly path: string
    readonly byteLength: number
    readonly sha256: string
  }
  readonly firstBlind: {
    readonly publicPath: string
    readonly pair: 'pair-01' | 'pair-02'
    readonly side: 'Y'
    readonly revealMap: FinalTiebreakRevealPin
    readonly userStatementExact: string
  }
  readonly finalTiebreak: {
    readonly publicPath: string
    readonly pair: 'pair-01' | 'pair-02'
    readonly side: 'R'
    readonly revealMap: FinalTiebreakRevealPin
    readonly userStatementExact: string
  }
  readonly byteLength: number
  readonly sha256: string
  readonly mpegFrameCount: number
  readonly actualDurationSeconds: number
  readonly outputFormat: 'audio-24khz-160kbitrate-mono-mp3'
  readonly model: 'MAI-Voice-2-Flash' | 'MAI-Voice-2'
  readonly voiceId: 'junho'
  readonly voiceShortName:
    | 'ko-KR-Junho:MAI-Voice-2-Flash'
    | 'ko-KR-Junho:MAI-Voice-2'
  readonly style: 'joyful'
  readonly styleDegree: 0.56 | 0.6
  readonly rate: '+22%' | '+28%'
  readonly pitch: '+0%'
  readonly structure:
    | 'adjacent-two-blocks-no-break'
    | 'one-full-block'
  readonly segments: readonly string[] | null
  readonly expressAsBlocks: 1 | 2
  readonly prosodyBlocks: 1 | 2
  readonly explicitBreaks: 0
  readonly selection: 'two-stage-blind-final-tiebreak'
  readonly humanApproved: true
  readonly approvalEvidence: {
    readonly firstBlindUserStatementExact: string
    readonly finalTiebreakUserStatementExact: string
    readonly reviewedAt: '2026-08-10'
  }
  readonly postprocessingApplied: false
  readonly additionalAzureRequests: 0
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

export const FINAL_TIEBREAK_APPROVED_NARRATION_SELECTIONS:
  readonly FinalTiebreakApprovedAudioSelection[]

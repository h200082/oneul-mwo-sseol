export const JOKBAL_COPY_RETAKE_01_PRIOR_FEEDBACK_QUOTE: string
export const JOKBAL_COPY_RETAKE_01_APPROVAL_QUOTE: '족발 승인할게'

export const JOKBAL_COPY_RETAKE_01_APPROVED_AUDIO_SELECTION: Readonly<{
  menuId: 'jokbal'
  catalogText: '발을 먹는데? 손이 더 바쁘다!'
  spokenText: '발을 먹는데? 손이 더 바쁘다!'
  tone: 'playful'
  sourcePreviewPath: string
  targetAssetPath: string
  byteLength: 51840
  sha256: string
  mpegFrameCount: 108
  exactDurationSeconds: 2.592
  sourceManifest: Readonly<{
    path: string
    byteLength: 3359
    sha256: string
    schemaVersion: 2
    generatedAt: string
    region: 'southeastasia'
    outputFormat: string
    ssmlCharacters: 333
    maximumEstimatedCostUsd: 0.007326
    voiceListPreflightRequests: 1
    synthesisRequests: 1
    retries: 0
    postprocessingApplied: false
    runtimeIntegrationAttempted: false
  }>
  rejectedPredecessor: Readonly<{
    path: string
    byteLength: 54720
    sha256: string
    mpegFrameCount: 114
    exactDurationSeconds: 2.736
    catalogText: string
    approvalState: 'rejected-copy-missing-important-word'
    currentlyDeployed: false
  }>
  modelId: 'flash'
  model: 'MAI-Voice-2-Flash'
  voiceId: 'junho'
  voiceShortName: 'ko-KR-Junho:MAI-Voice-2-Flash'
  style: 'joyful'
  styleDegree: 0.48
  rate: '+22%'
  pitch: '+0%'
  structure: 'one-block'
  segments: readonly ['발을 먹는데? 손이 더 바쁘다!']
  delivery: Readonly<{
    oneVoice: true
    oneExpressAs: true
    oneProsody: true
    explicitBreaks: 0
    subTagsUsed: false
    phonemeTagsUsed: false
    emphasisTagsUsed: false
    voiceSwitches: 0
  }>
  listeningQa: Readonly<{
    exactImportantWordRequired: '더'
    automaticLexicalAlignmentUsed: false
    questionToPunchGapTargetMilliseconds: readonly [180, 420]
    rejectQuestionToPunchGapAboveMilliseconds: 500
    measuredQuestionToPunchGapRangeMilliseconds: readonly [520, 535]
    predecessorMeasuredGapRangeMilliseconds: readonly [825, 840]
    maximumSecondToFirstLoudnessDeltaDb: 3
    measuredSecondToFirstLoudnessDeltaRangeDb: readonly [-1.2, -0.9]
    shoutLikeSecondPhraseRejected: true
    humanOverrideStatus: 'approved-after-direct-listening'
    overrideReason: string
  }>
  approvalEvidence: Readonly<{
    priorFeedbackStatement: string
    userStatement: '족발 승인할게'
    reviewedAt: '2026-08-10'
  }>
  humanApproved: true
  approvalState: 'human-listening-approved-with-gap-exception'
  deploymentStatus: 'active'
  currentlyDeployed: true
  byteCopyVerified: true
  postprocessingApplied: false
  additionalAzureRequests: 0
}>

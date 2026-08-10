export const TTEOKBOKKI_ONSET_RETAKE_PRIOR_FEEDBACK_QUOTE: string
export const TTEOKBOKKI_ONSET_RETAKE_APPROVAL_QUOTE: 'B 승인'

export const TTEOKBOKKI_ONSET_RETAKE_APPROVED_AUDIO_SELECTION: Readonly<{
  menuId: 'tteokbokki'
  tone: 'alert'
  catalogText: string
  spokenText: string
  parentSource: Readonly<{
    path: string
    byteLength: number
    sha256: string
    mpegFrameCount: number
    exactDurationSeconds: number
    approvalState: string
    parentManifest: Readonly<{
      path: string
      byteLength: number
      sha256: string
      schemaVersion: 2
    }>
  }>
  abManifest: Readonly<{
    path: string
    byteLength: number
    sha256: string
    schemaVersion: 2
    generatedAt: string
    region: 'southeastasia'
    outputFormat: string
    ssmlCharacters: number
    maximumEstimatedCostUsd: number
    voiceListPreflightRequests: number
    synthesisRequests: number
    retries: 0
    postprocessingApplied: false
    runtimeIntegrationAttempted: false
  }>
  delivery: Readonly<{
    modelId: 'flash'
    model: 'MAI-Voice-2-Flash'
    voiceId: 'haena'
    voiceShortName: 'ko-KR-Haena:MAI-Voice-2-Flash'
    style: 'joyful'
    styleDegree: 0.5
    pitch: '-1%'
    structure: 'adjacent-two-block'
    segments: readonly string[]
    leadingBreakMilliseconds: 100
    oneVoicePerClip: true
    expressAsPerClip: 2
    prosodyPerClip: 2
    otherBreaksPerClip: 0
    subTagsUsed: false
    phonemeTagsUsed: false
    emphasisTagsUsed: false
    voiceSwitchesPerClip: 0
    brandReview: 'metadata-only'
  }>
  rejectedCandidate: Readonly<{
    candidateId: 'A'
    sourcePath: string
    rates: readonly string[]
    byteLength: number
    sha256: string
    mpegFrameCount: number
    exactDurationSeconds: number
    approvalState: string
    currentlyDeployed: false
  }>
  selectedCandidate: Readonly<{
    candidateId: 'B'
    sourcePath: string
    targetAssetPath: string
    rates: readonly string[]
    byteLength: number
    sha256: string
    mpegFrameCount: number
    exactDurationSeconds: number
  }>
  approvalEvidence: Readonly<{
    priorFeedbackStatement: string
    userStatement: 'B 승인'
    reviewedAt: string
  }>
  humanApproved: true
  approvalState: 'approved-ab-candidate-b'
  deploymentStatus: 'active'
  currentlyDeployed: true
  byteCopyVerified: true
  postprocessingApplied: false
  additionalAzureRequests: 0
}>

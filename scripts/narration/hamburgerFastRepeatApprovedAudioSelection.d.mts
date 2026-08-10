export const HAMBURGER_FAST_REPEAT_APPROVAL_QUOTE: string

export const HAMBURGER_FAST_REPEAT_APPROVED_AUDIO_SELECTION: Readonly<{
  menuId: 'hamburger'
  tone: 'epic'
  catalogText: string
  spokenText: string
  sourcePerformance: Readonly<{
    modelId: 'flash'
    model: 'MAI-Voice-2-Flash'
    voiceId: 'haena'
    voiceShortName: 'ko-KR-Haena:MAI-Voice-2-Flash'
    style: 'joyful'
    styleDegree: 0.42
    rate: '+16%'
    pitch: '-2%'
    structure: 'one-block'
    segments: readonly string[]
  }>
  originalSource: Readonly<{
    path: string
    byteLength: number
    sha256: string
    mpegFrameCount: number
    exactDurationSeconds: number
    decodedPcm: Readonly<{
      sampleRate: number
      channels: number
      sampleCount: number
      peakDbfs: number
      clippingSamples: number
    }>
    parentManifest: Readonly<{
      path: string
      byteLength: number
      sha256: string
      schemaVersion: number
    }>
  }>
  trimManifest: Readonly<{
    path: string
    byteLength: number
    sha256: string
    schemaVersion: number
    purpose: string
    generatedAt: string
    networkRequests: number
    azureRequests: number
  }>
  selectedCandidate: Readonly<{
    sourcePath: string
    targetAssetPath: string
    container: 'WAVE'
    encoding: 'IEEE 32-bit float PCM'
    sampleRate: number
    channels: number
    sampleCount: number
    exactDurationSeconds: number
    byteLength: number
    sha256: string
    pcmSha256: string
    peakDbfs: number
    clippingSamples: number
  }>
  trimContract: Readonly<{
    mode: string
    targetRemainingGapSeconds: number
    removals: readonly Readonly<{
      removeStartSample: number
      removeEndSample: number
      removedSamples: number
      remainingGapSeconds: number
      joinDelta: number
    }>[]
    keptSegments: readonly (readonly [number, number])[]
    retainedPcmBitExact: boolean
    retainedPcmMismatchSamples: number
    chromeWavRedecodeMismatchSamples: number
    sourceHeadPreserved: boolean
    sourceTailPreserved: boolean
    allSpokenPcmPreserved: boolean
    fadesApplied: boolean
    normalized: boolean
    resampled: boolean
    gainApplied: boolean
    wordAligned: boolean
  }>
  approvalEvidence: Readonly<{
    userStatement: string
    reviewedAt: string
  }>
  humanApproved: true
  approvalState: string
  deploymentStatus: 'active'
  currentlyDeployed: true
  byteCopyVerified: true
  postprocessingApplied: string
  additionalAzureRequests: 0
}>

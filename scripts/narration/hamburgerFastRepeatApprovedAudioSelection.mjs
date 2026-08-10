export const HAMBURGER_FAST_REPEAT_APPROVAL_QUOTE =
  '햄버거도 승인할게'

export const HAMBURGER_FAST_REPEAT_APPROVED_AUDIO_SELECTION = Object.freeze({
  menuId: 'hamburger',
  tone: 'epic',
  catalogText: '햄부기! 햄부기! 햄부기!',
  spokenText: '햄부기! 햄부기! 햄부기!',
  sourcePerformance: Object.freeze({
    modelId: 'flash',
    model: 'MAI-Voice-2-Flash',
    voiceId: 'haena',
    voiceShortName: 'ko-KR-Haena:MAI-Voice-2-Flash',
    style: 'joyful',
    styleDegree: 0.42,
    rate: '+16%',
    pitch: '-2%',
    structure: 'one-block',
    segments: Object.freeze(['햄부기! 햄부기! 햄부기!']),
  }),
  originalSource: Object.freeze({
    path: 'tmp/narration-preview/remaining-batch-01/hamburger.mp3',
    byteLength: 83_520,
    sha256:
      'cb0977a8a37f398974ac49675e944ba3ff25a44252746014467a814f486e7219',
    mpegFrameCount: 174,
    exactDurationSeconds: 4.176,
    decodedPcm: Object.freeze({
      sampleRate: 24_000,
      channels: 1,
      sampleCount: 100_224,
      peakDbfs: -3.5017247050780584,
      clippingSamples: 0,
    }),
    parentManifest: Object.freeze({
      path:
        'tmp/narration-preview/remaining-batch-01/remaining-batch-01-manifest.json',
      byteLength: 42_007,
      sha256:
        'c2a6a2846c37a76c1fcf4a8e7f1e7f6255248d007d0712288ec934736cbf107e',
      schemaVersion: 2,
    }),
  }),
  trimManifest: Object.freeze({
    path:
      'tmp/narration-preview/hamburger-fast-repeat-trim-01/hamburger-fast-repeat-trim-01-manifest.json',
    byteLength: 9_898,
    sha256:
      '434ea7754878cb2affe8c7c6c528361a88990b062060ec0dfe4ad508cc0abd07',
    schemaVersion: 1,
    purpose: 'local-listening-candidate-only',
    generatedAt: '2026-08-10T05:57:53.870Z',
    networkRequests: 0,
    azureRequests: 0,
  }),
  selectedCandidate: Object.freeze({
    sourcePath:
      'tmp/narration-preview/hamburger-fast-repeat-trim-01/hamburger-fast-repeat-trim-01.wav',
    targetAssetPath:
      'src/assets/narration/hamburger-fast-repeat-trim.wav',
    container: 'WAVE',
    encoding: 'IEEE 32-bit float PCM',
    sampleRate: 24_000,
    channels: 1,
    sampleCount: 56_050,
    exactDurationSeconds: 2.3354166666666667,
    byteLength: 224_244,
    sha256:
      'db5aba82c39a1c5ebaa5c0f417b6394815ace3a4710bf527c240b6af0aa3a35f',
    pcmSha256:
      '77b1f1df1593d62bb14bea23e8e8407e3d8ec047aad1fef458b23025e576f3d0',
    peakDbfs: -3.5017247050780584,
    clippingSamples: 0,
  }),
  trimContract: Object.freeze({
    mode: 'two-internal-low-energy-centers',
    targetRemainingGapSeconds: 0.12,
    removals: Object.freeze([
      Object.freeze({
        removeStartSample: 15_346,
        removeEndSample: 40_445,
        removedSamples: 25_099,
        remainingGapSeconds: 0.11920833333333333,
        joinDelta: 7.010385161265731e-7,
      }),
      Object.freeze({
        removeStartSample: 56_938,
        removeEndSample: 76_013,
        removedSamples: 19_075,
        remainingGapSeconds: 0.12020833333333333,
        joinDelta: 0.00000554060625290731,
      }),
    ]),
    keptSegments: Object.freeze([
      Object.freeze([0, 15_346]),
      Object.freeze([40_445, 56_938]),
      Object.freeze([76_013, 100_224]),
    ]),
    retainedPcmBitExact: true,
    retainedPcmMismatchSamples: 0,
    chromeWavRedecodeMismatchSamples: 0,
    sourceHeadPreserved: true,
    sourceTailPreserved: true,
    allSpokenPcmPreserved: true,
    fadesApplied: false,
    normalized: false,
    resampled: false,
    gainApplied: false,
    wordAligned: false,
  }),
  approvalEvidence: Object.freeze({
    userStatement: HAMBURGER_FAST_REPEAT_APPROVAL_QUOTE,
    reviewedAt: '2026-08-10',
  }),
  humanApproved: true,
  approvalState: 'approved-local-internal-gap-trim',
  deploymentStatus: 'active',
  currentlyDeployed: true,
  byteCopyVerified: true,
  postprocessingApplied:
    'decoded-pcm-internal-low-energy-gap-removal-only',
  additionalAzureRequests: 0,
})

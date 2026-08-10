export const KALGUKSU_COPY_RETAKE_01_APPROVAL_QUOTE =
  '괜찮아 승인할게 다음꺼도 얼른 진행하자'

export const KALGUKSU_COPY_RETAKE_01_APPROVED_AUDIO_SELECTION = Object.freeze({
  menuId: 'kalguksu',
  catalogText: '칼은 위협용!',
  spokenText: '칼은 위협용!',
  sourcePreviewPath:
    'tmp/narration-preview/kalguksu-copy-retake-01/kalguksu.mp3',
  targetAssetPath: 'src/assets/narration/kalguksu-copy-retake-01.mp3',
  byteLength: 28_320,
  sha256:
    'B01D2033A30E36F6F30C0D4F73B3FA23673EAEA6B9605512720394898A506F25',
  mpegFrameCount: 59,
  exactDurationSeconds: 1.416,
  sourceManifest: Object.freeze({
    path:
      'tmp/narration-preview/kalguksu-copy-retake-01/kalguksu-copy-retake-01-manifest.json',
    byteLength: 2_956,
    sha256:
      '7A7EDE36DEF3D24E1BEC4511D8F8D52EF9B8370046CB3BFB780CCD00E322A761',
    schemaVersion: 2,
    generatedAt: '2026-08-10T05:15:25.926Z',
  }),
  rejectedPredecessor: Object.freeze({
    path: 'tmp/narration-preview/remaining-batch-01/kalguksu.mp3',
    byteLength: 77_760,
    sha256:
      '5AB16C2DF6ED341A498FA2D00DB3DDC0C90A5EC22968A27918043FED16E3438C',
    mpegFrameCount: 162,
    exactDurationSeconds: 3.888,
    catalogText: '칼은 이름에만, 국물은 따뜻!',
    deploymentStatus: 'rejected-source-not-integrated',
  }),
  tone: 'deadpan',
  modelId: 'flash',
  model: 'MAI-Voice-2-Flash',
  voiceId: 'junho',
  voiceShortName: 'ko-KR-Junho:MAI-Voice-2-Flash',
  style: 'determined',
  styleDegree: 0.36,
  rate: '+12%',
  pitch: '-1%',
  structure: 'one-block',
  segments: Object.freeze(['칼은 위협용!']),
  approvalEvidence: Object.freeze({
    userStatement: KALGUKSU_COPY_RETAKE_01_APPROVAL_QUOTE,
    reviewedAt: '2026-08-10',
  }),
  humanApproved: true,
  approvalState: 'human-listening-approved',
  deploymentStatus: 'active',
  currentlyDeployed: true,
  byteCopyVerified: true,
  postprocessingApplied: false,
  additionalAzureRequests: 0,
})

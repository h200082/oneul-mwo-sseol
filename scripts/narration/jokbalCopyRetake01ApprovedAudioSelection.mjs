export const JOKBAL_COPY_RETAKE_01_PRIOR_FEEDBACK_QUOTE =
  '족발은 "발을 먹는데? 손이 더 바쁘다" 에서 "더"가 빠졌어 중요한 요소야 수정해줘.  나머지는 다 맘에 들어'

export const JOKBAL_COPY_RETAKE_01_APPROVAL_QUOTE = '족발 승인할게'

export const JOKBAL_COPY_RETAKE_01_APPROVED_AUDIO_SELECTION = Object.freeze({
  menuId: 'jokbal',
  catalogText: '발을 먹는데? 손이 더 바쁘다!',
  spokenText: '발을 먹는데? 손이 더 바쁘다!',
  tone: 'playful',
  sourcePreviewPath:
    'tmp/narration-preview/jokbal-copy-retake-01/jokbal.mp3',
  targetAssetPath:
    'src/assets/narration/jokbal-copy-retake-01.mp3',
  byteLength: 51_840,
  sha256:
    '94D19FF391315524B09503A6962E13418FE5DD97ED098D7D9C9E116756B2B23D',
  mpegFrameCount: 108,
  exactDurationSeconds: 2.592,
  sourceManifest: Object.freeze({
    path:
      'tmp/narration-preview/jokbal-copy-retake-01/jokbal-copy-retake-01-manifest.json',
    byteLength: 3_359,
    sha256:
      'E33C781E071BEB700426FC2C03D7079033844EC4DD3991230853BBFA77C22F41',
    schemaVersion: 2,
    generatedAt: '2026-08-10T07:11:09.888Z',
    region: 'southeastasia',
    outputFormat: 'audio-24khz-160kbitrate-mono-mp3',
    ssmlCharacters: 333,
    maximumEstimatedCostUsd: 0.007326,
    voiceListPreflightRequests: 1,
    synthesisRequests: 1,
    retries: 0,
    postprocessingApplied: false,
    runtimeIntegrationAttempted: false,
  }),
  rejectedPredecessor: Object.freeze({
    path: 'tmp/narration-preview/remaining-batch-01/jokbal.mp3',
    byteLength: 54_720,
    sha256:
      '9D4505FE633998516A2AABE750920CE2CD14E98709CE87512D67B674D24966BD',
    mpegFrameCount: 114,
    exactDurationSeconds: 2.736,
    catalogText: '발을 먹는데 손이 바쁘다!',
    approvalState: 'rejected-copy-missing-important-word',
    currentlyDeployed: false,
  }),
  modelId: 'flash',
  model: 'MAI-Voice-2-Flash',
  voiceId: 'junho',
  voiceShortName: 'ko-KR-Junho:MAI-Voice-2-Flash',
  style: 'joyful',
  styleDegree: 0.48,
  rate: '+22%',
  pitch: '+0%',
  structure: 'one-block',
  segments: Object.freeze(['발을 먹는데? 손이 더 바쁘다!']),
  delivery: Object.freeze({
    oneVoice: true,
    oneExpressAs: true,
    oneProsody: true,
    explicitBreaks: 0,
    subTagsUsed: false,
    phonemeTagsUsed: false,
    emphasisTagsUsed: false,
    voiceSwitches: 0,
  }),
  listeningQa: Object.freeze({
    exactImportantWordRequired: '더',
    automaticLexicalAlignmentUsed: false,
    questionToPunchGapTargetMilliseconds: Object.freeze([180, 420]),
    rejectQuestionToPunchGapAboveMilliseconds: 500,
    measuredQuestionToPunchGapRangeMilliseconds: Object.freeze([520, 535]),
    predecessorMeasuredGapRangeMilliseconds: Object.freeze([825, 840]),
    maximumSecondToFirstLoudnessDeltaDb: 3,
    measuredSecondToFirstLoudnessDeltaRangeDb: Object.freeze([-1.2, -0.9]),
    shoutLikeSecondPhraseRejected: true,
    humanOverrideStatus: 'approved-after-direct-listening',
    overrideReason:
      'The final user approval accepts the measured 520–535 ms gap despite the automated 500 ms rejection threshold.',
  }),
  approvalEvidence: Object.freeze({
    priorFeedbackStatement: JOKBAL_COPY_RETAKE_01_PRIOR_FEEDBACK_QUOTE,
    userStatement: JOKBAL_COPY_RETAKE_01_APPROVAL_QUOTE,
    reviewedAt: '2026-08-10',
  }),
  humanApproved: true,
  approvalState: 'human-listening-approved-with-gap-exception',
  deploymentStatus: 'active',
  currentlyDeployed: true,
  byteCopyVerified: true,
  postprocessingApplied: false,
  additionalAzureRequests: 0,
})

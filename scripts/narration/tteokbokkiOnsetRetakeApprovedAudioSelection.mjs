export const TTEOKBOKKI_ONSET_RETAKE_PRIOR_FEEDBACK_QUOTE =
  '떡볶이는 앞에 "떡볶"이가 안들리고 앞부분이 짤린거 같아. 떡볶이는 짤린거 말고는 괜찮아. 햄버거는 햄부기 3번 반복하는데 더 빠르게 반복해줘. 이 둘 말고는 괜찮아'

export const TTEOKBOKKI_ONSET_RETAKE_APPROVAL_QUOTE = 'B 승인'

export const TTEOKBOKKI_ONSET_RETAKE_APPROVED_AUDIO_SELECTION = Object.freeze({
  menuId: 'tteokbokki',
  tone: 'alert',
  catalogText: '떡볶이 포획! 쿨피스 지원 요청!',
  spokenText: '떡볶이 포획! 쿨피스 지원 요청!',
  parentSource: Object.freeze({
    path: 'tmp/narration-preview/remaining-batch-01/tteokbokki.mp3',
    byteLength: 64_800,
    sha256:
      'e7d000e53d5623674c4d3054cb225df484728c49eea192afa4527e6ccfa611b7',
    mpegFrameCount: 135,
    exactDurationSeconds: 3.24,
    approvalState: 'rejected-onset-clipped',
    parentManifest: Object.freeze({
      path:
        'tmp/narration-preview/remaining-batch-01/remaining-batch-01-manifest.json',
      byteLength: 42_007,
      sha256:
        'c2a6a2846c37a76c1fcf4a8e7f1e7f6255248d007d0712288ec934736cbf107e',
      schemaVersion: 2,
    }),
  }),
  abManifest: Object.freeze({
    path:
      'tmp/narration-preview/tteokbokki-onset-retake-01/tteokbokki-onset-retake-01-manifest.json',
    byteLength: 4_819,
    sha256:
      '3a343828e04c68e5fb5438ce7f372196a6a035b34cd08c3bec3ac0af79c093f1',
    schemaVersion: 2,
    generatedAt: '2026-08-10T06:06:19.782Z',
    region: 'southeastasia',
    outputFormat: 'audio-24khz-160kbitrate-mono-mp3',
    ssmlCharacters: 934,
    maximumEstimatedCostUsd: 0.020548,
    voiceListPreflightRequests: 1,
    synthesisRequests: 2,
    retries: 0,
    postprocessingApplied: false,
    runtimeIntegrationAttempted: false,
  }),
  delivery: Object.freeze({
    modelId: 'flash',
    model: 'MAI-Voice-2-Flash',
    voiceId: 'haena',
    voiceShortName: 'ko-KR-Haena:MAI-Voice-2-Flash',
    style: 'joyful',
    styleDegree: 0.5,
    pitch: '-1%',
    structure: 'adjacent-two-block',
    segments: Object.freeze(['떡볶이 포획! ', '쿨피스 지원 요청!']),
    leadingBreakMilliseconds: 100,
    oneVoicePerClip: true,
    expressAsPerClip: 2,
    prosodyPerClip: 2,
    otherBreaksPerClip: 0,
    subTagsUsed: false,
    phonemeTagsUsed: false,
    emphasisTagsUsed: false,
    voiceSwitchesPerClip: 0,
    brandReview: 'metadata-only',
  }),
  rejectedCandidate: Object.freeze({
    candidateId: 'A',
    sourcePath:
      'tmp/narration-preview/tteokbokki-onset-retake-01/A.mp3',
    rates: Object.freeze(['+22%', '+22%']),
    byteLength: 57_120,
    sha256:
      '3363427c60805bfd84e244f33f35772e214faa53c524f8167b20f6e3f178581d',
    mpegFrameCount: 119,
    exactDurationSeconds: 2.856,
    approvalState: 'not-selected-after-ab-listening',
    currentlyDeployed: false,
  }),
  selectedCandidate: Object.freeze({
    candidateId: 'B',
    sourcePath:
      'tmp/narration-preview/tteokbokki-onset-retake-01/B.mp3',
    targetAssetPath:
      'src/assets/narration/tteokbokki-onset-retake-b.mp3',
    rates: Object.freeze(['+12%', '+22%']),
    byteLength: 64_800,
    sha256:
      '6b6b9ae5b73ae5afe86ebe8dbbcf4a4347674f889597a9fa8b721f6c3391cf87',
    mpegFrameCount: 135,
    exactDurationSeconds: 3.24,
  }),
  approvalEvidence: Object.freeze({
    priorFeedbackStatement: TTEOKBOKKI_ONSET_RETAKE_PRIOR_FEEDBACK_QUOTE,
    userStatement: TTEOKBOKKI_ONSET_RETAKE_APPROVAL_QUOTE,
    reviewedAt: '2026-08-10',
  }),
  humanApproved: true,
  approvalState: 'approved-ab-candidate-b',
  deploymentStatus: 'active',
  currentlyDeployed: true,
  byteCopyVerified: true,
  postprocessingApplied: false,
  additionalAzureRequests: 0,
})

/** Human-approved locally attenuated selection derived from the Azure batch-02 take. */
export const CHEONGGUKJANG_PUNCH_ADJUSTED_APPROVED_NARRATION_SELECTIONS =
  Object.freeze([
    Object.freeze({
      menuId: 'cheonggukjang',
      catalogText: '청국장 향부터 어그로 만렙!',
      spokenText: '청국장 향부터 어그로 만렙!',
      sourcePreviewPath:
        'tmp/narration-preview/cheonggukjang-punch-adjust-01/cheonggukjang-terminal-minus-5db.mp3',
      targetAssetPath: 'src/assets/narration/cheonggukjang.mp3',
      originalAzurePreviewPath:
        'tmp/narration-preview/full-batch-02/cheonggukjang.mp3',
      baseSynthesisManifestPath:
        'tmp/narration-preview/full-batch-02/full-batch-02-manifest.json',
      localAdjustmentManifestPath:
        'tmp/narration-preview/cheonggukjang-punch-adjust-01/cheonggukjang-punch-adjust-01-manifest.json',
      byteLength: 52_800,
      sha256:
        '9029284574B771A2042FCFE6804AB1633F1137C91D4F49D635E5871D99902874',
      mpegFrameCount: 110,
      actualDurationSeconds: 2.64,
      outputFormat: 'audio-24khz-160kbitrate-mono-mp3',
      voiceId: 'junho',
      voiceShortName: 'ko-KR-Junho:MAI-Voice-2-Flash',
      style: 'joyful',
      styleDegree: 0.8,
      rate: '+50%',
      pitch: '+0%',
      localAdjustment: Object.freeze({
        variant: 'B',
        method: 'mpeg-layer-iii-global-gain',
        requestedSteadyAttenuationDb: -5,
        appliedSteadyAttenuationDb: -4.5,
        intervalStartSeconds: 1.7725,
        intervalEndSeconds: 2.4175,
        rampSeconds: 0.024,
        additionalAzureRequests: 0,
        wordAligned: false,
      }),
      humanApproved: true,
      approvalEvidence: Object.freeze({
        userStatement: '청국장은 B가 좋아',
        reviewedAt: '2026-08-09',
      }),
      deploymentStatus: 'active',
      currentlyDeployed: true,
      durationReview: Object.freeze({
        status: 'human-listening-exception',
        targetMinimumSeconds: 1.2,
        targetMaximumSeconds: 1.8,
        hardMaximumSeconds: 2,
        note: 'The user approved variant B after listening despite its 2.640-second frame duration.',
      }),
    }),
  ])

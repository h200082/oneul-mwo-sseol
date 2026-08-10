/** Human-approved shabu-shabu take with only boundary silence locally trimmed. */
export const SHABU_SHABU_SILENCE_TRIM_APPROVED_NARRATION_SELECTIONS =
  Object.freeze([
    Object.freeze({
      menuId: 'shabu-shabu',
      catalogText: '채소도 먹었다고 주장 가능합니다!',
      spokenText: '채소도 먹었다고 주장 가능합니다!',
      sourcePreviewPath:
        'tmp/narration-preview/shabu-shabu-silence-trim-01/shabu-shabu-trimmed.wav',
      targetAssetPath: 'src/assets/narration/shabu-shabu.wav',
      originalSlowRetakePath:
        'tmp/narration-preview/slow-retake-batch-01/shabu-shabu.mp3',
      localEditManifestPath:
        'tmp/narration-preview/shabu-shabu-silence-trim-01/shabu-shabu-silence-trim-01-manifest.json',
      historicalAssetPath: 'src/assets/narration/shabu-shabu.mp3',
      byteLength: 175_244,
      sha256:
        'A6C3C08897A015C0CC973EAD300A69F3456DE1A835B4673F594B60E64504A2FA',
      sampleRate: 24_000,
      channels: 1,
      sampleCount: 43_800,
      actualDurationSeconds: 1.825,
      container: 'WAVE',
      encoding: 'IEEE 32-bit float PCM',
      voiceId: 'junho',
      voiceShortName: 'ko-KR-Junho:MAI-Voice-2-Flash',
      style: 'determined',
      styleDegree: 0.55,
      rate: '+20%',
      pitch: '-1%',
      localEdit: Object.freeze({
        decoder: 'Chrome Web Audio decodeAudioData',
        detectedHeadSeconds: 0.35,
        detectedTailSeconds: 0.267,
        retainedHeadSeconds: 0.075,
        retainedTailSeconds: 0.135,
        removedHeadSeconds: 0.275,
        removedTailSeconds: 0.132,
        boundaryFadeSeconds: 0.005,
        activeSpeechEstimateSeconds: 1.49,
        longestInternalGapSeconds: 0.065,
        activeSpeechFloat32Sha256:
          'F8C0BD31A38EDEFFB94711A37D98969BCB465C735A6FECA28784BAE177F86671',
        activeSpeechPcmBitExact: true,
        activeSpeechMismatchSamples: 0,
        additionalAzureRequests: 0,
        wordAligned: false,
      }),
      humanApproved: true,
      approvalEvidence: Object.freeze({
        userStatement: '샤부샤부 좋아 맘에들어',
        reviewedAt: '2026-08-10',
      }),
      deploymentStatus: 'active',
      currentlyDeployed: true,
      durationReview: Object.freeze({
        status: 'human-approved-boundary-silence-trim',
        activeSpeechTargetMinimumSeconds: 1.3,
        activeSpeechTargetMaximumSeconds: 1.55,
        hardMaximumSeconds: 2,
        note: 'The approved speech PCM is unchanged; only boundary silence was trimmed.',
      }),
    }),
  ])

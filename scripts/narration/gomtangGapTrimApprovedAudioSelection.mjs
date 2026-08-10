/** Human-approved gomtang take with only robust internal low-energy cores removed locally. */
export const GOMTANG_GAP_TRIM_APPROVED_NARRATION_SELECTIONS = Object.freeze([
  Object.freeze({
    menuId: 'gomtang',
    catalogText: '곰은 없어도 곰처럼 든든!',
    spokenText: '곰은 없어도 곰처럼 든든!',
    sourcePreviewPath:
      'tmp/narration-preview/gomtang-gap-trim-01/gomtang-gap-trim-01.wav',
    targetAssetPath: 'src/assets/narration/gomtang.wav',
    originalSlowRetakePath:
      'tmp/narration-preview/slow-retake-batch-01/gomtang.mp3',
    localEditManifestPath:
      'tmp/narration-preview/gomtang-gap-trim-01/gomtang-gap-trim-01-manifest.json',
    localEditManifestByteLength: 13_226,
    localEditManifestSha256:
      '2DDC09198C09D718C65BBCA0A57AF8124E9F159DBD8F7746DCB5822840E03AB3',
    historicalAssetPath: 'src/assets/narration/gomtang.mp3',
    historicalAssetSha256:
      '63CB397FD55E02EEF0B93E9B43425A7FC1C0E8E991C809E5E16EFE5F1333B5B9',
    byteLength: 225_876,
    sha256:
      '1148C05A7A088B5D59255C97DBF6252210E1E0437EA3A531434FAE0FDF2FDDB8',
    pcmSha256:
      '60998DA9FC859929952571DD4EFB72AED6D1200EF0A5579D4C274DF337601DAC',
    sampleRate: 24_000,
    channels: 1,
    sampleCount: 56_458,
    actualDurationSeconds: 2.3524166666666666,
    container: 'WAVE',
    encoding: 'IEEE 32-bit float PCM',
    voiceId: 'junho',
    voiceShortName: 'ko-KR-Junho:MAI-Voice-2-Flash',
    style: 'joyful',
    styleDegree: 0.55,
    rate: '+8%',
    pitch: '-1%',
    originalSlowRetake: Object.freeze({
      byteLength: 60_960,
      sha256:
        'B1F950F35C2F08806DE5F9E52A9661D4B0375B9169402F5E745F9FC32B9D04B9',
      pcmSha256:
        'DAD94DAB0F12FF97BA5BF26AF50128130D773CE0D4883B89905A9EB5EE0CEADD',
      sampleCount: 73_152,
      actualDurationSeconds: 3.048,
    }),
    localEdit: Object.freeze({
      decoder:
        'Chrome Web Audio API AudioContext.decodeAudioData via Playwright channel chrome',
      rmsWindowMilliseconds: 10,
      rmsHopMilliseconds: 5,
      selectionThresholdDbfs: -45,
      removedIntervals: Object.freeze([
        Object.freeze({
          startSample: 11_813,
          endSample: 22_042,
          startSeconds: 0.49220833333333336,
          endSeconds: 0.9184166666666667,
          durationSeconds: 0.42620833333333336,
          retainedGapSeconds: 0.13379166666666667,
          joinDelta: 0.0000018090631783707067,
        }),
        Object.freeze({
          startSample: 49_246,
          endSample: 55_711,
          startSeconds: 2.0519166666666666,
          endSeconds: 2.3212916666666668,
          durationSeconds: 0.269375,
          retainedGapSeconds: 0.135625,
          joinDelta: 0.0000021231680875644088,
        }),
      ]),
      totalRemovedSamples: 16_694,
      totalRemovedSeconds: 0.6955833333333333,
      maximumInternalGapSecondsAtMinus45: 0.135,
      maximumInternalGapSecondsAtMinus40: 0.14,
      retainedPcmBitExact: true,
      retainedSampleMismatchCount: 0,
      resampled: false,
      normalized: false,
      faded: false,
      headAndTailPreserved: true,
      additionalAzureRequests: 0,
      wordAligned: false,
    }),
    humanApproved: true,
    approvalEvidence: Object.freeze({
      preliminaryUserStatement: '곰탕도 발화부분은 괜찮은 거 같아',
      userStatement: '곰탕은 맘에들어.',
      reviewedAt: '2026-08-10',
    }),
    deploymentStatus: 'active',
    currentlyDeployed: true,
    durationReview: Object.freeze({
      status: 'human-listening-exception-after-local-gap-trim',
      targetHardMaximumSeconds: 2,
      actualDurationSeconds: 2.3524166666666666,
      note: 'The user approved the locally gap-trimmed take after listening; all retained PCM is bit-exact and only robust low-energy cores were removed.',
    }),
  }),
])

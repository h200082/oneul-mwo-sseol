/** Human-approved source pins from replacement narration batch 01. */
export const REPLACEMENT_BATCH_01_APPROVED_NARRATION_SELECTIONS =
  Object.freeze([
    Object.freeze({
      menuId: 'jeyuk-deopbap',
      catalogText: '제육덮밥 메뉴 고민 강제 종료!',
      spokenText: '제육덮밥 메뉴 고민 강제 종료!',
      sourcePreviewPath:
        'tmp/narration-preview/replacement-batch-01/jeyuk-deopbap.mp3',
      targetAssetPath: 'src/assets/narration/jeyuk-deopbap.mp3',
      supersededPreviewPath:
        'tmp/narration-preview/full-batch-02/jeyuk-deopbap.mp3',
      replacementReason: 'listening-retake',
      byteLength: 43_680,
      sha256:
        '96A12781D4278EB221BDC925D7B9F8AF92AC7F65716A252C1D0759B217E9EC3F',
      mpegFrameCount: 91,
      actualDurationSeconds: 2.184,
      outputFormat: 'audio-24khz-160kbitrate-mono-mp3',
      voiceId: 'junho',
      voiceShortName: 'ko-KR-Junho:MAI-Voice-2-Flash',
      style: 'joyful',
      styleDegree: 0.62,
      rate: '+45%',
      pitch: '-1%',
      selection: 'replacement-batch-01',
      humanApproved: true,
      approvalEvidence: Object.freeze({
        userStatement: '제육덮밥은 새 음원이 나아',
        reviewedAt: '2026-08-09',
      }),
      deploymentStatus: 'active',
      currentlyDeployed: true,
      durationReview: Object.freeze({
        status: 'human-listening-exception',
        targetMinimumSeconds: 1.2,
        targetMaximumSeconds: 1.8,
        hardMaximumSeconds: 2,
        note: 'The user approved this replacement after listening despite its 2.184-second frame duration.',
      }),
    }),
  ])

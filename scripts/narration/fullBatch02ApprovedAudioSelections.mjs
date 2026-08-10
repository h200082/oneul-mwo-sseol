/** Human-approved source pins from the second full narration batch. */
export const FULL_BATCH_02_APPROVED_NARRATION_SELECTIONS = Object.freeze([
  selection({
    menuId: 'dwaeji-gukbap',
    catalogText: '돼지국밥 한술에 부산 도착!',
    byteLength: 38_880,
    sha256: '46798287828F7F991835FFF7D532B64A3F46A4DAB0B8207607427A9DDE452B66',
    actualDurationSeconds: 1.944,
    style: 'joyful',
    styleDegree: 0.8,
    rate: '+50%',
    durationStatus: 'within-hard-maximum',
  }),
  selection({
    menuId: 'sundae-guk',
    catalogText: '순대국 든든 버프 풀충전!',
    byteLength: 51_360,
    sha256: '386B15214E6FE6A07530F1D4ED6BE4032EFBAC2CECE522A409730B882B865922',
    actualDurationSeconds: 2.568,
    style: 'joyful',
    styleDegree: 0.8,
    rate: '+50%',
    durationStatus: 'human-listening-exception',
  }),
  selection({
    menuId: 'home-style-baekban',
    catalogText: '백반 한상 반찬 슬롯 만렙!',
    byteLength: 47_040,
    sha256: '179D4F0056E9B41843AABFA46BCC13C0CA4C1E79D99177AC8F076D1F8BDC36EC',
    actualDurationSeconds: 2.352,
    style: 'joyful',
    styleDegree: 0.8,
    rate: '+50%',
    durationStatus: 'human-listening-exception',
  }),
  selection({
    menuId: 'bibimbap',
    catalogText: '고추장 아래 만민평등!',
    byteLength: 36_000,
    sha256: 'ADCA8D1CCAFF1856EF75BB2ED35A4B50EE23129DDD0E73390243A553BE776DA4',
    actualDurationSeconds: 1.8,
    style: 'determined',
    styleDegree: 0.75,
    rate: '+45%',
    durationStatus: 'within-target',
  }),
  selection({
    menuId: 'chicken-mayo-deopbap',
    catalogText: '치킨마요 소스줄은 생명줄!',
    byteLength: 40_800,
    sha256: '7F98D7CD654836EA3F788F78777551DE3C6F82C3C14B7FD48CBC6B8932467F3C',
    actualDurationSeconds: 2.04,
    style: 'joyful',
    styleDegree: 0.8,
    rate: '+50%',
    durationStatus: 'human-listening-exception',
  }),
])

function selection({ durationStatus, ...value }) {
  return Object.freeze({
    ...value,
    spokenText: value.catalogText,
    sourcePreviewPath: `tmp/narration-preview/full-batch-02/${value.menuId}.mp3`,
    targetAssetPath: `src/assets/narration/${value.menuId}.mp3`,
    voiceId: 'junho',
    voiceShortName: 'ko-KR-Junho:MAI-Voice-2-Flash',
    pitch: '+0%',
    selection: 'full-batch-02',
    humanApproved: true,
    approvalEvidence: Object.freeze({
      userStatement: '나머지는 괜찮다',
      reviewedAt: '2026-08-09',
    }),
    deploymentStatus: 'active',
    currentlyDeployed: true,
    durationReview: Object.freeze({
      status: durationStatus,
      targetMinimumSeconds: 1.2,
      targetMaximumSeconds: 1.8,
      hardMaximumSeconds: 2,
      ...(durationStatus === 'human-listening-exception'
        ? {
            note: 'The user approved this take after listening despite the automatic duration gate.',
          }
        : {}),
    }),
  })
}

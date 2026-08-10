const FIRST_BLIND_REVEAL = Object.freeze({
  path: 'tmp/narration-preview/replacement-pilot-02-blind-test-01/private/sealed-reveal-map.json',
  byteLength: 6_057,
  sha256: 'AB0AD3568A5C040A7B2C5CADF89DABDDEA1985FBA94ECA6EA7B8007CF485721D',
})

const FIRST_BLIND_USER_STATEMENT =
  'pair 1은 Y가 좋아, pair 2는 Y가 좋아, pair 3은 비슷한데 X가 조금 더 나아, pair 4는 Y가 좋아. pair 4 X는 밥에 강점이 갑자기 소리치듯 있고 문구 자체를 읽는게 어디에 강세를 줘야할지 잘 모르는 미숙한 느낌이 커. 제일 별로였어'

const FINAL_TIEBREAK_REVEAL = Object.freeze({
  path: 'tmp/narration-preview/replacement-pilot-02-final-tiebreak-blind-01/private/sealed-reveal-map.json',
  byteLength: 6_783,
  sha256: '25DD40E60653C2DFE801BFDC673EAAE9C5008920C8207E13B7C5D3492064804B',
})

const FINAL_TIEBREAK_USER_STATEMENT =
  '둘다 R이 더 자연스럽고 어떤 단어에 강세를 줘야 할지, 어떻게 이어나가야 할 지 아는느낌이야. 자연스러워'

/** Raw, human-approved winners from the two-stage blinded final comparison. */
export const FINAL_TIEBREAK_APPROVED_NARRATION_SELECTIONS = Object.freeze([
  Object.freeze({
    menuId: 'pasta',
    catalogText: '포크로 돌리면 갑자기 유럽!',
    spokenText: '포크로 돌리면 갑자기 유럽!',
    sourcePreviewPath:
      'tmp/narration-preview/replacement-pilot-02-final-tiebreak-blind-01/public/pair-01/R.mp3',
    targetAssetPath:
      'src/assets/narration/pasta-final-tiebreak.mp3',
    generationSourcePath:
      'tmp/narration-preview/replacement-pilot-02/pasta-B.mp3',
    generationManifest: Object.freeze({
      path: 'tmp/narration-preview/replacement-pilot-02/replacement-pilot-02-manifest.json',
      byteLength: 14_487,
      sha256:
        'BC44C41F5F17CDBC9293B397E76397017EB279B25CFCC6E59B4E6A7E47399DE8',
    }),
    firstBlind: Object.freeze({
      publicPath:
        'tmp/narration-preview/replacement-pilot-02-blind-test-01/public/pair-01/Y.mp3',
      pair: 'pair-01',
      side: 'Y',
      revealMap: FIRST_BLIND_REVEAL,
      userStatementExact: FIRST_BLIND_USER_STATEMENT,
    }),
    finalTiebreak: Object.freeze({
      publicPath:
        'tmp/narration-preview/replacement-pilot-02-final-tiebreak-blind-01/public/pair-01/R.mp3',
      pair: 'pair-01',
      side: 'R',
      revealMap: FINAL_TIEBREAK_REVEAL,
      userStatementExact: FINAL_TIEBREAK_USER_STATEMENT,
    }),
    byteLength: 49_920,
    sha256:
      'EDB4D142066DDCC6C75D7B58AD9FBB6D2AB85D7CE562CBBDEB6A824854947431',
    mpegFrameCount: 104,
    actualDurationSeconds: 2.496,
    outputFormat: 'audio-24khz-160kbitrate-mono-mp3',
    model: 'MAI-Voice-2-Flash',
    voiceId: 'junho',
    voiceShortName: 'ko-KR-Junho:MAI-Voice-2-Flash',
    style: 'joyful',
    styleDegree: 0.56,
    rate: '+22%',
    pitch: '+0%',
    structure: 'adjacent-two-blocks-no-break',
    segments: Object.freeze(['포크로 돌리면 ', '갑자기 유럽!']),
    expressAsBlocks: 2,
    prosodyBlocks: 2,
    explicitBreaks: 0,
    selection: 'two-stage-blind-final-tiebreak',
    humanApproved: true,
    approvalEvidence: Object.freeze({
      firstBlindUserStatementExact: FIRST_BLIND_USER_STATEMENT,
      finalTiebreakUserStatementExact:
        FINAL_TIEBREAK_USER_STATEMENT,
      reviewedAt: '2026-08-10',
    }),
    postprocessingApplied: false,
    additionalAzureRequests: 0,
    deploymentStatus: 'active',
    currentlyDeployed: true,
    durationReview: Object.freeze({
      status: 'human-listening-exception',
      targetMinimumSeconds: 1.2,
      targetMaximumSeconds: 1.8,
      hardMaximumSeconds: 2,
      note: 'The user approved this raw take after two blind stages despite its 2.496-second MPEG duration.',
    }),
  }),
  Object.freeze({
    menuId: 'bulgogi-deopbap',
    catalogText: '밥 위 무단점거 현행범!',
    spokenText: '밥 위 무단점거 현행범!',
    sourcePreviewPath:
      'tmp/narration-preview/replacement-pilot-02-final-tiebreak-blind-01/public/pair-02/R.mp3',
    targetAssetPath:
      'src/assets/narration/bulgogi-deopbap-final-tiebreak.mp3',
    generationSourcePath:
      'tmp/narration-preview/replacement-pilot-02-mai-voice-2/bulgogi-deopbap-A.mp3',
    generationManifest: Object.freeze({
      path: 'tmp/narration-preview/replacement-pilot-02-mai-voice-2/replacement-pilot-02-mai-voice-2-manifest.json',
      byteLength: 10_714,
      sha256:
        '88AE946E7BCEA7452E5BE1BC7A080B43504EE6F72463C37C1E03A1001E479213',
    }),
    firstBlind: Object.freeze({
      publicPath:
        'tmp/narration-preview/replacement-pilot-02-blind-test-01/public/pair-02/Y.mp3',
      pair: 'pair-02',
      side: 'Y',
      revealMap: FIRST_BLIND_REVEAL,
      userStatementExact: FIRST_BLIND_USER_STATEMENT,
    }),
    finalTiebreak: Object.freeze({
      publicPath:
        'tmp/narration-preview/replacement-pilot-02-final-tiebreak-blind-01/public/pair-02/R.mp3',
      pair: 'pair-02',
      side: 'R',
      revealMap: FINAL_TIEBREAK_REVEAL,
      userStatementExact: FINAL_TIEBREAK_USER_STATEMENT,
    }),
    byteLength: 36_960,
    sha256:
      'B37C038201C660C6FB58CF0345D017526E074EF900914B835441106A9909D1BD',
    mpegFrameCount: 77,
    actualDurationSeconds: 1.848,
    outputFormat: 'audio-24khz-160kbitrate-mono-mp3',
    model: 'MAI-Voice-2',
    voiceId: 'junho',
    voiceShortName: 'ko-KR-Junho:MAI-Voice-2',
    style: 'joyful',
    styleDegree: 0.6,
    rate: '+28%',
    pitch: '+0%',
    structure: 'one-full-block',
    segments: null,
    expressAsBlocks: 1,
    prosodyBlocks: 1,
    explicitBreaks: 0,
    selection: 'two-stage-blind-final-tiebreak',
    humanApproved: true,
    approvalEvidence: Object.freeze({
      firstBlindUserStatementExact: FIRST_BLIND_USER_STATEMENT,
      finalTiebreakUserStatementExact:
        FINAL_TIEBREAK_USER_STATEMENT,
      reviewedAt: '2026-08-10',
    }),
    postprocessingApplied: false,
    additionalAzureRequests: 0,
    deploymentStatus: 'active',
    currentlyDeployed: true,
    durationReview: Object.freeze({
      status: 'human-listening-exception',
      targetMinimumSeconds: 1.2,
      targetMaximumSeconds: 1.8,
      hardMaximumSeconds: 2,
      note: 'The user approved this raw take after two blind stages despite its 1.848-second MPEG duration.',
    }),
  }),
])

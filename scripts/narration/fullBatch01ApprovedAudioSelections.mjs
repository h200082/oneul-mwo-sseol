/**
 * Human-approved source pins from the first full narration batch.
 *
 * The active export contains only clips whose recorded copy still matches the
 * live catalog. Retired selections remain in a separate historical export.
 * Runtime inclusion is authoritative in menuNarrationAudioManifest.ts.
 */
export const FULL_BATCH_01_APPROVED_NARRATION_SELECTIONS = Object.freeze([
  selection({
    menuId: 'doenjang-jjigae',
    sourcePreviewPath:
      'tmp/narration-preview/full-batch-01-retake-01/doenjang-jjigae.mp3',
    byteLength: 35_520,
    sha256: '21C6A74CF04A18472110C1E8694D4D80E5D8D7136E442418E4BC202ABF05A63A',
    approximateDurationSeconds: 1.776,
    selection: 'full-batch-01-retake-01',
  }),
  selection({
    menuId: 'sundubu-jjigae',
    sourcePreviewPath:
      'tmp/narration-preview/full-batch-01/sundubu-jjigae.mp3',
    byteLength: 39_840,
    sha256: 'F7FAC8707F15323C97007012609A513CE8F7E1D5D2FF8A3A89E3C086986E4F8D',
    approximateDurationSeconds: 1.992,
    selection: 'full-batch-01',
  }),
  selection({
    menuId: 'gamjatang',
    sourcePreviewPath: 'tmp/narration-preview/full-batch-01/gamjatang.mp3',
    byteLength: 69_120,
    sha256: '5A24FAD64D4B82A6482C3BB7D6BA0B5838FE5805FA4E8E8320E66EBD5CC97A76',
    approximateDurationSeconds: 3.456,
    selection: 'full-batch-01',
    durationException:
      'Longer original take retained after human listening approval.',
  }),
  selection({
    menuId: 'seolleongtang',
    sourcePreviewPath:
      'tmp/narration-preview/seolleongtang-copy-pilot-01/B-gukbap-tank.mp3',
    byteLength: 48_480,
    sha256: 'DEB1856C1C63AACFC528DAD71A9B80660AF352319218EDD027746E7E118167F6',
    approximateDurationSeconds: 2.424,
    selection: 'seolleongtang-copy-pilot-01-b',
    durationException:
      'Candidate B approved as-is for naturalness pronunciation and emphasis; do not speed-resynthesize.',
  }),

  selection({
    menuId: 'galbitang',
    sourcePreviewPath: 'tmp/narration-preview/full-batch-01/galbitang.mp3',
    byteLength: 35_520,
    sha256: 'C52E856E8F68AA6A84F1160F172E6D46E96C11656E896F7A3CEE0BE3CC6ED020',
    approximateDurationSeconds: 1.776,
    selection: 'full-batch-01',
  }),
  selection({
    menuId: 'samgyetang',
    sourcePreviewPath:
      'tmp/narration-preview/full-batch-01-retake-03/samgyetang.mp3',
    byteLength: 35_520,
    sha256: '518D96B965B75225D0BC47B3C678868F5994A5C35EC6A6EF48FD64A98886CC9C',
    approximateDurationSeconds: 1.776,
    selection: 'full-batch-01-retake-03',
  }),
  selection({
    menuId: 'kongnamul-gukbap',
    sourcePreviewPath:
      'tmp/narration-preview/full-batch-01/kongnamul-gukbap.mp3',
    byteLength: 35_520,
    sha256: '67ADB756CCF7017FBD3E3E16903A5BD7FFEE96AB4343D425DA41A0A627A47D92',
    approximateDurationSeconds: 1.776,
    selection: 'full-batch-01',
  }),
])

export const FULL_BATCH_01_RETIRED_NARRATION_SELECTIONS = Object.freeze([
  retiredSelection({
    menuId: 'gomtang',
    historicalCatalogText: '곰은 없고 진국만 있다!',
    sourcePreviewPath:
      'tmp/narration-preview/full-batch-01-retake-01/gomtang.mp3',
    byteLength: 35_520,
    sha256: '63CB397FD55E02EEF0B93E9B43425A7FC1C0E8E991C809E5E16EFE5F1333B5B9',
    approximateDurationSeconds: 1.776,
    selection: 'full-batch-01-retake-01',
    retirementReason:
      'The live primary changed to 곰은 없어도 곰처럼 든든!; the old clip is provenance only and must not be mapped or regenerated.',
  }),
])

function selection({ durationException, ...value }) {
  return Object.freeze({
    ...value,
    targetAssetPath: `src/assets/narration/${value.menuId}.mp3`,
    humanApproved: true,
    deploymentStatus: 'active',
    currentlyDeployed: true,
    durationReview: Object.freeze({
      status: durationException
        ? 'human-listening-exception'
        : 'within-hard-maximum',
      targetHardMaximumSeconds: 2,
      ...(durationException ? { note: durationException } : {}),
    }),
  })
}

function retiredSelection({
  historicalCatalogText,
  retirementReason,
  ...value
}) {
  const historicalSelection = selection(value)
  return Object.freeze({
    ...historicalSelection,
    deploymentStatus: 'retired-catalog-copy-mismatch',
    currentlyDeployed: false,
    historicalCatalogText,
    retirementReason,
  })
}

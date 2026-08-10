#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

import { parseNarrationCatalog } from './azureSpeechBatch.mjs'
import { inspectRemainingBatch01Mp3 } from './azureRemainingBatch01.mjs'

export const HAMBURGER_REPEAT_TRIM_USER_FEEDBACK =
  '떡볶이는 앞에 "떡볶"이가 안들리고 앞부분이 짤린거 같아. 떡볶이는 짤린거 말고는 괜찮아. 햄버거는 햄부기 3번 반복하는데 더 빠르게 반복해줘. 이 둘 말고는 괜찮아'

export const HAMBURGER_REPEAT_TRIM_PATHS = Object.freeze({
  source: 'tmp/narration-preview/remaining-batch-01/hamburger.mp3',
  parentManifest:
    'tmp/narration-preview/remaining-batch-01/remaining-batch-01-manifest.json',
  catalog: 'src/data/menuNarrations.ts',
  activeAudioIds: 'src/data/menuNarrationAudioIds.ts',
  defaultOutputDirectory:
    'tmp/narration-preview/hamburger-fast-repeat-trim-01',
  outputFile: 'hamburger-fast-repeat-trim-01.wav',
  manifestFile: 'hamburger-fast-repeat-trim-01-manifest.json',
})

export const HAMBURGER_REPEAT_TRIM_SOURCE_PINS = Object.freeze({
  source: Object.freeze({
    byteLength: 83_520,
    sha256: 'cb0977a8a37f398974ac49675e944ba3ff25a44252746014467a814f486e7219',
    mpegFrameCount: 174,
    exactDurationSeconds: 4.176,
  }),
  parentManifest: Object.freeze({
    byteLength: 42_007,
    sha256: 'c2a6a2846c37a76c1fcf4a8e7f1e7f6255248d007d0712288ec934736cbf107e',
    schemaVersion: 2,
  }),
  catalog: Object.freeze({
    byteLength: 13_780,
    sha256: 'cd499819aa43a3c9bd97b4f4b1051d631f99ef6d7ebe461a1fb5e40d6ca196ca',
  }),
  activeAudioIds: Object.freeze({
    byteLength: 923,
    sha256: 'c0030a57f2fa71439c19643f99923d10f11db537beb431dc1a34e2b45b9aca3e',
    expectedCount: 41,
  }),
})

export const HAMBURGER_REPEAT_TRIM_PERFORMANCE = Object.freeze({
  menuId: 'hamburger',
  listeningGroup: 3,
  tone: 'epic',
  catalogText: '햄부기! 햄부기! 햄부기!',
  spokenText: '햄부기! 햄부기! 햄부기!',
  modelId: 'flash',
  model: 'MAI-Voice-2-Flash',
  voiceId: 'haena',
  voiceShortName: 'ko-KR-Haena:MAI-Voice-2-Flash',
  style: 'joyful',
  styleDegree: 0.42,
  rate: '+16%',
  pitch: '-2%',
  structure: 'one-block',
  segments: Object.freeze(['햄부기! 햄부기! 햄부기!']),
})

export const HAMBURGER_REPEAT_TRIM_CONTRACT = Object.freeze({
  sampleRate: 24_000,
  channels: 1,
  analysisWindowSeconds: 0.01,
  analysisHopSeconds: 0.005,
  thresholdsDbfs: Object.freeze([-45, -40]),
  targetRemainingGapSeconds: 0.12,
  boundarySearchSeconds: 0.006,
  maximumJoinDelta: 0.01,
  sourceSampleCount: 100_224,
  expectedGapsMinus45: Object.freeze([
    Object.freeze({ startSample: 13_800, endSampleExclusive: 41_760 }),
    Object.freeze({ startSample: 55_560, endSampleExclusive: 77_520 }),
  ]),
  expectedMainGapsMinus40: Object.freeze([
    Object.freeze({ startSample: 12_720, endSampleExclusive: 42_360 }),
    Object.freeze({ startSample: 54_600, endSampleExclusive: 78_600 }),
  ]),
  expectedRemovals: Object.freeze([
    Object.freeze({
      removeStartSample: 15_346,
      removeEndSample: 40_445,
    }),
    Object.freeze({
      removeStartSample: 56_938,
      removeEndSample: 76_013,
    }),
  ]),
  expectedOutputSampleCount: 56_050,
})

const scriptPath = fileURLToPath(import.meta.url)
const projectRoot = path.resolve(path.dirname(scriptPath), '..', '..')

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function float32Bytes(samples) {
  return Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)
}

function amplitudeToDbfs(amplitude) {
  return amplitude > 0
    ? 20 * Math.log10(amplitude)
    : Number.NEGATIVE_INFINITY
}

function validatePinnedBytes(bytes, pin, label) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error(`${label} must be bytes`)
  }
  if (bytes.byteLength !== pin.byteLength || sha256(bytes) !== pin.sha256) {
    throw new Error(`${label} identity changed`)
  }
}

function parseActiveAudioIds(source) {
  const match =
    /export const MENU_NARRATION_AUDIO_IDS = \[([\s\S]*?)\]\s+as const/u.exec(
      source,
    )
  if (!match?.[1]) throw new Error('Could not parse active narration audio IDs')
  const ids = [...match[1].matchAll(/'([a-z0-9-]+)'/g)].map(
    (entry) => entry[1],
  )
  if (ids.length === 0 || new Set(ids).size !== ids.length) {
    throw new Error('Active narration audio IDs are empty or duplicated')
  }
  return ids
}

export function validateHamburgerRepeatTrimSources({
  sourceBytes,
  parentManifestBytes,
  catalogBytes,
  activeAudioIdsBytes,
}) {
  validatePinnedBytes(
    sourceBytes,
    HAMBURGER_REPEAT_TRIM_SOURCE_PINS.source,
    'Hamburger source',
  )
  validatePinnedBytes(
    parentManifestBytes,
    HAMBURGER_REPEAT_TRIM_SOURCE_PINS.parentManifest,
    'Parent manifest',
  )
  validatePinnedBytes(
    catalogBytes,
    HAMBURGER_REPEAT_TRIM_SOURCE_PINS.catalog,
    'Narration catalog',
  )
  validatePinnedBytes(
    activeAudioIdsBytes,
    HAMBURGER_REPEAT_TRIM_SOURCE_PINS.activeAudioIds,
    'Active narration IDs',
  )

  const sourceInspection = inspectRemainingBatch01Mp3(sourceBytes)
  const sourcePin = HAMBURGER_REPEAT_TRIM_SOURCE_PINS.source
  if (
    sourceInspection.mpegFrameCount !== sourcePin.mpegFrameCount ||
    sourceInspection.exactDurationSeconds !== sourcePin.exactDurationSeconds
  ) {
    throw new Error('Hamburger source MPEG identity changed')
  }

  const decoder = new TextDecoder('utf-8', { fatal: true })
  const catalog = parseNarrationCatalog(decoder.decode(catalogBytes))
  const current = catalog.find(({ menuId }) => menuId === 'hamburger')
  if (
    !current ||
    current.text !== HAMBURGER_REPEAT_TRIM_PERFORMANCE.catalogText ||
    current.tone !== HAMBURGER_REPEAT_TRIM_PERFORMANCE.tone
  ) {
    throw new Error('Hamburger current catalog copy or tone changed')
  }

  const activeAudioIds = parseActiveAudioIds(
    decoder.decode(activeAudioIdsBytes),
  )
  if (
    activeAudioIds.length !==
      HAMBURGER_REPEAT_TRIM_SOURCE_PINS.activeAudioIds.expectedCount ||
    activeAudioIds.includes('hamburger')
  ) {
    throw new Error('Hamburger must remain inactive before listening approval')
  }

  const parentManifest = JSON.parse(decoder.decode(parentManifestBytes))
  const sourceEntry = parentManifest.generatedFiles?.find(
    ({ menuId }) => menuId === 'hamburger',
  )
  const performance = HAMBURGER_REPEAT_TRIM_PERFORMANCE
  if (
    parentManifest.schemaVersion !== 2 ||
    sourceEntry?.menuId !== performance.menuId ||
    sourceEntry?.listeningGroup !== performance.listeningGroup ||
    sourceEntry?.tone !== performance.tone ||
    sourceEntry?.catalogText !== performance.catalogText ||
    sourceEntry?.spokenText !== performance.spokenText ||
    sourceEntry?.modelId !== performance.modelId ||
    sourceEntry?.model !== performance.model ||
    sourceEntry?.voiceId !== performance.voiceId ||
    sourceEntry?.voiceShortName !== performance.voiceShortName ||
    sourceEntry?.style !== performance.style ||
    sourceEntry?.styleDegree !== performance.styleDegree ||
    sourceEntry?.rate !== performance.rate ||
    sourceEntry?.pitch !== performance.pitch ||
    sourceEntry?.structure !== performance.structure ||
    JSON.stringify(sourceEntry?.segments) !==
      JSON.stringify(performance.segments) ||
    sourceEntry?.byteLength !== sourcePin.byteLength ||
    sourceEntry?.sha256 !== sourcePin.sha256 ||
    sourceEntry?.mpegFrameCount !== sourcePin.mpegFrameCount ||
    sourceEntry?.exactDurationSeconds !== sourcePin.exactDurationSeconds
  ) {
    throw new Error('Hamburger parent-manifest lineage changed')
  }

  return Object.freeze({
    sourceInspection,
    activeAudioIds: Object.freeze(activeAudioIds),
    current: Object.freeze(current),
  })
}

export function analyzeHamburgerRepeatPcm(samples, thresholdDbfs) {
  if (!(samples instanceof Float32Array)) {
    throw new Error('Hamburger PCM must be Float32')
  }
  const { sampleRate, analysisWindowSeconds, analysisHopSeconds } =
    HAMBURGER_REPEAT_TRIM_CONTRACT
  const windowSamples = Math.round(sampleRate * analysisWindowSeconds)
  const hopSamples = Math.round(sampleRate * analysisHopSeconds)
  const windows = []
  for (
    let startSample = 0;
    startSample + windowSamples <= samples.length;
    startSample += hopSamples
  ) {
    let energy = 0
    for (
      let index = startSample;
      index < startSample + windowSamples;
      index += 1
    ) {
      energy += samples[index] * samples[index]
    }
    const rmsDbfs = amplitudeToDbfs(
      Math.sqrt(energy / windowSamples),
    )
    windows.push({
      startSample,
      endSampleExclusive: startSample + windowSamples,
      active: rmsDbfs >= thresholdDbfs,
    })
  }

  const firstActiveIndex = windows.findIndex(({ active }) => active)
  let lastActiveIndex = -1
  for (let index = windows.length - 1; index >= 0; index -= 1) {
    if (windows[index].active) {
      lastActiveIndex = index
      break
    }
  }
  if (firstActiveIndex < 0 || lastActiveIndex <= firstActiveIndex) {
    throw new Error('No usable hamburger activity was detected')
  }

  const gaps = []
  let index = firstActiveIndex + 1
  while (index < lastActiveIndex) {
    if (windows[index].active) {
      index += 1
      continue
    }
    const runStart = index
    while (index < lastActiveIndex && !windows[index].active) index += 1
    const runEnd = index - 1
    const startSample = windows[runStart].startSample
    const endSampleExclusive = windows[runEnd].endSampleExclusive
    gaps.push(
      Object.freeze({
        startSample,
        endSampleExclusive,
        startSeconds: startSample / sampleRate,
        endSeconds: endSampleExclusive / sampleRate,
        durationSeconds:
          (endSampleExclusive - startSample) / sampleRate,
      }),
    )
  }

  return Object.freeze({
    thresholdDbfs,
    windowSeconds: analysisWindowSeconds,
    hopSeconds: analysisHopSeconds,
    firstActiveSample: windows[firstActiveIndex].startSample,
    lastActiveEndSampleExclusive:
      windows[lastActiveIndex].endSampleExclusive,
    headSeconds: windows[firstActiveIndex].startSample / sampleRate,
    tailSeconds:
      (samples.length - windows[lastActiveIndex].endSampleExclusive) /
      sampleRate,
    activeSpanSeconds:
      (windows[lastActiveIndex].endSampleExclusive -
        windows[firstActiveIndex].startSample) /
      sampleRate,
    gaps: Object.freeze(gaps),
    maximumInternalGapSeconds: gaps.reduce(
      (maximum, gap) => Math.max(maximum, gap.durationSeconds),
      0,
    ),
  })
}

function assertGapIdentity(actual, expected, label) {
  if (
    actual.length < expected.length ||
    expected.some(
      (gap, index) =>
        actual[index]?.startSample !== gap.startSample ||
        actual[index]?.endSampleExclusive !== gap.endSampleExclusive,
    )
  ) {
    throw new Error(`${label} low-energy gaps changed`)
  }
}

export function chooseHamburgerRepeatRemovals(samples, minus45, minus40) {
  const contract = HAMBURGER_REPEAT_TRIM_CONTRACT
  assertGapIdentity(
    minus45.gaps,
    contract.expectedGapsMinus45,
    '-45 dBFS',
  )
  assertGapIdentity(
    minus40.gaps,
    contract.expectedMainGapsMinus40,
    '-40 dBFS',
  )

  const radius = Math.round(
    contract.boundarySearchSeconds * contract.sampleRate,
  )
  const retainedSideSamples = Math.round(
    (contract.targetRemainingGapSeconds / 2) * contract.sampleRate,
  )

  return Object.freeze(
    contract.expectedGapsMinus45.map((gap, gapIndex) => {
      const desiredStart = gap.startSample + retainedSideSamples
      const desiredEnd = gap.endSampleExclusive - retainedSideSamples
      let best = null
      for (
        let removeStartSample = desiredStart - radius;
        removeStartSample <= desiredStart + radius;
        removeStartSample += 1
      ) {
        for (
          let removeEndSample = desiredEnd - radius;
          removeEndSample <= desiredEnd + radius;
          removeEndSample += 1
        ) {
          if (
            removeStartSample <= gap.startSample ||
            removeEndSample >= gap.endSampleExclusive ||
            removeEndSample <= removeStartSample
          ) {
            continue
          }
          const leftSample = samples[removeStartSample - 1]
          const rightSample = samples[removeEndSample]
          const joinDelta = Math.abs(leftSample - rightSample)
          const remainingGapSeconds =
            (gap.endSampleExclusive -
              gap.startSample -
              (removeEndSample - removeStartSample)) /
            contract.sampleRate
          const durationError = Math.abs(
            remainingGapSeconds - contract.targetRemainingGapSeconds,
          )
          const score =
            joinDelta * 8 +
            Math.abs(leftSample) +
            Math.abs(rightSample) +
            durationError * 0.01
          if (!best || score < best.score) {
            best = {
              gapIndex,
              score,
              sourceGapStartSample: gap.startSample,
              sourceGapEndSampleExclusive: gap.endSampleExclusive,
              removeStartSample,
              removeEndSample,
              removeStartSeconds:
                removeStartSample / contract.sampleRate,
              removeEndSeconds: removeEndSample / contract.sampleRate,
              removedSamples: removeEndSample - removeStartSample,
              removedSeconds:
                (removeEndSample - removeStartSample) /
                contract.sampleRate,
              leftSample,
              rightSample,
              joinDelta,
              remainingGapSeconds,
            }
          }
        }
      }
      if (!best || best.joinDelta > contract.maximumJoinDelta) {
        throw new Error(`No click-safe hamburger splice for gap ${gapIndex + 1}`)
      }
      const expected = contract.expectedRemovals[gapIndex]
      if (
        best.removeStartSample !== expected.removeStartSample ||
        best.removeEndSample !== expected.removeEndSample
      ) {
        throw new Error(`Hamburger splice ${gapIndex + 1} drifted`)
      }
      return Object.freeze(best)
    }),
  )
}

export function spliceHamburgerRepeatPcm(source, removals) {
  const sorted = [...removals].sort(
    (left, right) => left.removeStartSample - right.removeStartSample,
  )
  const keptSegments = []
  let sourceCursor = 0
  let outputLength = source.length
  for (const removal of sorted) {
    if (removal.removeStartSample < sourceCursor) {
      throw new Error('Hamburger removal intervals overlap')
    }
    keptSegments.push({
      sourceStartSample: sourceCursor,
      sourceEndSample: removal.removeStartSample,
    })
    sourceCursor = removal.removeEndSample
    outputLength -= removal.removeEndSample - removal.removeStartSample
  }
  keptSegments.push({
    sourceStartSample: sourceCursor,
    sourceEndSample: source.length,
  })
  if (outputLength !== HAMBURGER_REPEAT_TRIM_CONTRACT.expectedOutputSampleCount) {
    throw new Error('Unexpected hamburger candidate sample count')
  }

  const output = new Float32Array(outputLength)
  let outputCursor = 0
  const mappedSegments = keptSegments.map((segment) => {
    const retained = source.subarray(
      segment.sourceStartSample,
      segment.sourceEndSample,
    )
    output.set(retained, outputCursor)
    const mapped = Object.freeze({
      ...segment,
      outputStartSample: outputCursor,
      outputEndSample: outputCursor + retained.length,
    })
    outputCursor += retained.length
    return mapped
  })
  if (outputCursor !== output.length) {
    throw new Error('Hamburger splice output length mismatch')
  }

  let mismatchSamples = 0
  for (const segment of mappedSegments) {
    const count = segment.sourceEndSample - segment.sourceStartSample
    for (let index = 0; index < count; index += 1) {
      if (
        !Object.is(
          source[segment.sourceStartSample + index],
          output[segment.outputStartSample + index],
        )
      ) {
        mismatchSamples += 1
      }
    }
  }
  if (mismatchSamples !== 0) {
    throw new Error('Retained hamburger PCM changed')
  }

  return Object.freeze({
    output,
    keptSegments: Object.freeze(mappedSegments),
    mismatchSamples,
  })
}

export function analyzeHamburgerOverall(samples) {
  let energy = 0
  let peakAmplitude = 0
  let clippingSamples = 0
  for (const sample of samples) {
    if (!Number.isFinite(sample)) {
      throw new Error('Hamburger decode produced non-finite PCM')
    }
    energy += sample * sample
    const amplitude = Math.abs(sample)
    peakAmplitude = Math.max(peakAmplitude, amplitude)
    if (amplitude >= 0.999) clippingSamples += 1
  }
  return Object.freeze({
    rmsDbfs: amplitudeToDbfs(Math.sqrt(energy / samples.length)),
    peakDbfs: amplitudeToDbfs(peakAmplitude),
    peakAmplitude,
    clippingSamples,
  })
}

export function encodeHamburgerFloat32Wav(samples) {
  const sampleRate = HAMBURGER_REPEAT_TRIM_CONTRACT.sampleRate
  const dataBytes = samples.length * 4
  const wav = Buffer.alloc(44 + dataBytes)
  wav.write('RIFF', 0, 'ascii')
  wav.writeUInt32LE(36 + dataBytes, 4)
  wav.write('WAVE', 8, 'ascii')
  wav.write('fmt ', 12, 'ascii')
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(3, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * 4, 28)
  wav.writeUInt16LE(4, 32)
  wav.writeUInt16LE(32, 34)
  wav.write('data', 36, 'ascii')
  wav.writeUInt32LE(dataBytes, 40)
  for (let index = 0; index < samples.length; index += 1) {
    wav.writeFloatLE(samples[index], 44 + index * 4)
  }
  return wav
}

function decodeFloat32Base64(base64, expectedSampleCount) {
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length !== expectedSampleCount * 4) {
    throw new Error('Chrome returned an unexpected hamburger PCM length')
  }
  const samples = new Float32Array(expectedSampleCount)
  for (let index = 0; index < expectedSampleCount; index += 1) {
    samples[index] = bytes.readFloatLE(index * 4)
  }
  return samples
}

async function decodeWithChrome(page, encodedBytes) {
  const decoded = await page.evaluate(
    async ({ sourceBase64, sampleRate }) => {
      const binary = atob(sourceBase64)
      const encoded = Uint8Array.from(binary, (character) =>
        character.charCodeAt(0),
      )
      const context = new AudioContext({ sampleRate })
      try {
        const audio = await context.decodeAudioData(encoded.buffer)
        const samples = audio.getChannelData(0)
        const pcmBytes = new Uint8Array(
          samples.buffer,
          samples.byteOffset,
          samples.byteLength,
        )
        let raw = ''
        for (let offset = 0; offset < pcmBytes.length; offset += 0x8000) {
          raw += String.fromCharCode(
            ...pcmBytes.subarray(offset, offset + 0x8000),
          )
        }
        return {
          sampleRate: audio.sampleRate,
          channels: audio.numberOfChannels,
          sampleCount: audio.length,
          durationSeconds: audio.duration,
          pcmFloat32Base64: btoa(raw),
          userAgent: navigator.userAgent,
        }
      } finally {
        await context.close()
      }
    },
    {
      sourceBase64: encodedBytes.toString('base64'),
      sampleRate: HAMBURGER_REPEAT_TRIM_CONTRACT.sampleRate,
    },
  )
  return Object.freeze({
    ...decoded,
    samples: decodeFloat32Base64(
      decoded.pcmFloat32Base64,
      decoded.sampleCount,
    ),
  })
}

function countMismatches(left, right) {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY
  let mismatches = 0
  for (let index = 0; index < left.length; index += 1) {
    if (!Object.is(left[index], right[index])) mismatches += 1
  }
  return mismatches
}

async function assertOutputDirectoryAbsent(outputDirectory) {
  try {
    await access(outputDirectory)
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return
    throw error
  }
  throw new Error(`Output directory already exists: ${outputDirectory}`)
}

function parseArgs(argv) {
  const options = {
    execute: false,
    outputDirectory: HAMBURGER_REPEAT_TRIM_PATHS.defaultOutputDirectory,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--execute') options.execute = true
    else if (argument === '--output') options.outputDirectory = argv[++index]
    else throw new Error(`Unknown argument: ${argument}`)
  }
  if (!options.outputDirectory) {
    throw new Error('--output requires a non-empty directory')
  }
  return options
}

function projectPath(relativePath) {
  return path.join(projectRoot, relativePath)
}

function portableProjectPath(absolutePath) {
  return path.relative(projectRoot, absolutePath).replaceAll('\\', '/')
}

async function readPinnedSources() {
  const [sourceBytes, parentManifestBytes, catalogBytes, activeAudioIdsBytes] =
    await Promise.all([
      readFile(projectPath(HAMBURGER_REPEAT_TRIM_PATHS.source)),
      readFile(projectPath(HAMBURGER_REPEAT_TRIM_PATHS.parentManifest)),
      readFile(projectPath(HAMBURGER_REPEAT_TRIM_PATHS.catalog)),
      readFile(projectPath(HAMBURGER_REPEAT_TRIM_PATHS.activeAudioIds)),
    ])
  const attestation = validateHamburgerRepeatTrimSources({
    sourceBytes,
    parentManifestBytes,
    catalogBytes,
    activeAudioIdsBytes,
  })
  return Object.freeze({ sourceBytes, attestation })
}

export async function runHamburgerRepeatTrim(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  const outputDirectory = path.resolve(projectRoot, options.outputDirectory)
  const outputPath = path.join(
    outputDirectory,
    HAMBURGER_REPEAT_TRIM_PATHS.outputFile,
  )
  const manifestPath = path.join(
    outputDirectory,
    HAMBURGER_REPEAT_TRIM_PATHS.manifestFile,
  )
  const { sourceBytes, attestation } = await readPinnedSources()

  console.log(`Mode: ${options.execute ? 'EXECUTE' : 'DRY RUN'}`)
  console.log(`Source: ${HAMBURGER_REPEAT_TRIM_PATHS.source}`)
  console.log(`Output: ${portableProjectPath(outputPath)}`)
  console.log(`User feedback: ${HAMBURGER_REPEAT_TRIM_USER_FEEDBACK}`)
  console.log(
    'Plan: remove only two click-safe low-energy centers; retain approximately 120ms between each unchanged spoken repetition.',
  )
  if (!options.execute) {
    console.log(
      'Dry run only: no Chrome launch, network request, mkdir, or file write.',
    )
    return null
  }

  await assertOutputDirectoryAbsent(outputDirectory)

  let networkRequests = 0
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  let decoded
  let verifiedDecode
  let chromeVersion
  try {
    chromeVersion = browser.version()
    const page = await browser.newPage()
    page.on('request', () => {
      networkRequests += 1
    })
    decoded = await decodeWithChrome(page, sourceBytes)
    if (
      decoded.sampleRate !== HAMBURGER_REPEAT_TRIM_CONTRACT.sampleRate ||
      decoded.channels !== HAMBURGER_REPEAT_TRIM_CONTRACT.channels ||
      decoded.sampleCount !== HAMBURGER_REPEAT_TRIM_CONTRACT.sourceSampleCount ||
      decoded.durationSeconds !==
        HAMBURGER_REPEAT_TRIM_SOURCE_PINS.source.exactDurationSeconds
    ) {
      throw new Error('Chrome hamburger source decode identity changed')
    }

    const analyses = HAMBURGER_REPEAT_TRIM_CONTRACT.thresholdsDbfs.map(
      (threshold) => analyzeHamburgerRepeatPcm(decoded.samples, threshold),
    )
    const removals = chooseHamburgerRepeatRemovals(
      decoded.samples,
      analyses[0],
      analyses[1],
    )
    const spliced = spliceHamburgerRepeatPcm(decoded.samples, removals)
    const wav = encodeHamburgerFloat32Wav(spliced.output)
    verifiedDecode = await decodeWithChrome(page, wav)
    const chromeWavRedecodeMismatchSamples = countMismatches(
      spliced.output,
      verifiedDecode.samples,
    )
    if (chromeWavRedecodeMismatchSamples !== 0) {
      throw new Error('Chrome WAV redecode changed retained hamburger PCM')
    }
    if (networkRequests !== 0) {
      throw new Error('Unexpected network request during local hamburger trim')
    }

    const sourceOverall = analyzeHamburgerOverall(decoded.samples)
    const outputOverall = analyzeHamburgerOverall(spliced.output)
    if (
      outputOverall.peakAmplitude !== sourceOverall.peakAmplitude ||
      outputOverall.clippingSamples !== sourceOverall.clippingSamples
    ) {
      throw new Error('Hamburger trim changed peak or clipping identity')
    }
    const outputAnalyses = HAMBURGER_REPEAT_TRIM_CONTRACT.thresholdsDbfs.map(
      (threshold) => analyzeHamburgerRepeatPcm(spliced.output, threshold),
    )
    const outputPcmSha256 = sha256(float32Bytes(spliced.output))
    const manifest = {
      schemaVersion: 1,
      purpose: 'local-listening-candidate-only',
      generatedAt: new Date().toISOString(),
      userFeedback: {
        statement: HAMBURGER_REPEAT_TRIM_USER_FEEDBACK,
        interpretation:
          'The accepted hamburger voice performance is retained; only the two long low-energy centers between the three repetitions are shortened.',
      },
      source: {
        path: HAMBURGER_REPEAT_TRIM_PATHS.source,
        ...HAMBURGER_REPEAT_TRIM_SOURCE_PINS.source,
        immutable: true,
        parentManifest: {
          path: HAMBURGER_REPEAT_TRIM_PATHS.parentManifest,
          ...HAMBURGER_REPEAT_TRIM_SOURCE_PINS.parentManifest,
        },
        catalog: {
          path: HAMBURGER_REPEAT_TRIM_PATHS.catalog,
          ...HAMBURGER_REPEAT_TRIM_SOURCE_PINS.catalog,
        },
        activeAudioIds: {
          path: HAMBURGER_REPEAT_TRIM_PATHS.activeAudioIds,
          ...HAMBURGER_REPEAT_TRIM_SOURCE_PINS.activeAudioIds,
          hamburgerInactiveBeforeListening: true,
        },
        performance: HAMBURGER_REPEAT_TRIM_PERFORMANCE,
        decodedPcm: {
          sampleRate: decoded.sampleRate,
          channels: decoded.channels,
          sampleCount: decoded.sampleCount,
          exactDurationSeconds: decoded.durationSeconds,
          overall: sourceOverall,
        },
      },
      tool: {
        script: 'scripts/narration/trim-hamburger-repeat-gaps.mjs',
        runtime: process.version,
        decoder:
          'Chrome Web Audio API AudioContext.decodeAudioData via Playwright channel chrome',
        chromeVersion,
        userAgent: decoded.userAgent,
        networkRequests,
        azureRequests: 0,
      },
      detection: {
        windowSeconds:
          HAMBURGER_REPEAT_TRIM_CONTRACT.analysisWindowSeconds,
        hopSeconds: HAMBURGER_REPEAT_TRIM_CONTRACT.analysisHopSeconds,
        thresholds: analyses,
        wordAligned: false,
        limitation:
          'The removal regions are corroborated low-energy centers, not word timestamps.',
      },
      trim: {
        mode: 'two-internal-low-energy-centers',
        targetRemainingGapSeconds:
          HAMBURGER_REPEAT_TRIM_CONTRACT.targetRemainingGapSeconds,
        boundarySearchSeconds:
          HAMBURGER_REPEAT_TRIM_CONTRACT.boundarySearchSeconds,
        maximumJoinDelta:
          HAMBURGER_REPEAT_TRIM_CONTRACT.maximumJoinDelta,
        removals,
        keptSegments: spliced.keptSegments,
        removedLeadingSamples: 0,
        removedTailSamples: 0,
        fadesApplied: false,
        normalized: false,
        resampled: false,
        gainApplied: false,
      },
      preservation: {
        retainedPcmBitExact: true,
        retainedPcmMismatchSamples: spliced.mismatchSamples,
        chromeWavRedecodeMismatchSamples,
        outputFloat32Sha256: outputPcmSha256,
        sourceHeadPreserved: true,
        sourceTailPreserved: true,
        allSpokenPcmPreserved: true,
      },
      output: {
        path: portableProjectPath(outputPath),
        container: 'WAVE',
        encoding: 'IEEE 32-bit float PCM',
        sampleRate: verifiedDecode.sampleRate,
        channels: verifiedDecode.channels,
        sampleCount: verifiedDecode.sampleCount,
        exactDurationSeconds: verifiedDecode.durationSeconds,
        byteLength: wav.byteLength,
        sha256: sha256(wav),
        pcmSha256: outputPcmSha256,
        overall: outputOverall,
        thresholdAnalyses: outputAnalyses,
        runtimeIntegrated: false,
        listeningReviewRequired: true,
      },
      sourceAttestation: {
        activeAudioCount: attestation.activeAudioIds.length,
        currentCatalogEntry: attestation.current,
      },
    }

    await mkdir(outputDirectory, { recursive: true })
    await writeFile(outputPath, wav, { flag: 'wx' })
    await writeFile(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      { encoding: 'utf8', flag: 'wx' },
    )
    console.log(
      `Generated ${portableProjectPath(outputPath)} (${wav.byteLength} bytes, ${verifiedDecode.durationSeconds.toFixed(6)}s).`,
    )
    console.log(`Generated ${portableProjectPath(manifestPath)}.`)
    console.log('Listening review is required; runtime integration was not attempted.')
    return Object.freeze({ outputPath, manifestPath, manifest })
  } finally {
    await browser.close()
  }
}

if (path.resolve(process.argv[1] ?? '') === scriptPath) {
  runHamburgerRepeatTrim().catch((error) => {
    console.error(
      `Hamburger repeat trim failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
  })
}

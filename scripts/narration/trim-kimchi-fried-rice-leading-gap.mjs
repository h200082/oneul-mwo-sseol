import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { TextDecoder } from 'node:util'

import { chromium } from '@playwright/test'

import { inspectRemainingBatch01Mp3 } from './azureRemainingBatch01.mjs'

const SOURCE_PATH =
  'tmp/narration-preview/remaining-batch-01/kimchi-fried-rice.mp3'
const SOURCE_MANIFEST_PATH =
  'tmp/narration-preview/remaining-batch-01/remaining-batch-01-manifest.json'
const DEFAULT_OUTPUT_DIRECTORY =
  'tmp/narration-preview/kimchi-fried-rice-leading-gap-trim-01'
const OUTPUT_FILE = 'kimchi-fried-rice-leading-gap-trim-01.wav'
const MANIFEST_FILE =
  'kimchi-fried-rice-leading-gap-trim-01-manifest.json'

const SOURCE_BYTES = 67_200
const SOURCE_SHA256 =
  'c952bc5274509a8627242b1d45fb4347e4e93f97f83b2cb2c4a67ab6bf9af053'
const SOURCE_MANIFEST_BYTES = 42_007
const SOURCE_MANIFEST_SHA256 =
  'c2a6a2846c37a76c1fcf4a8e7f1e7f6255248d007d0712288ec934736cbf107e'
const SOURCE_TEXT = '신김치의 화려한 재데뷔!'
const USER_APPROVAL =
  '너무 괜찮아, 그동안 만들던 방식중 이렇게 모두 퀄리티가 괜찮게 나온 적은 처음이라 굉장히 만족스러워, 김치볶음밥 처음 빈 공백 편집해서 줄이기만 하면 될 거 같아.'
const PERFORMANCE_LOCK_APPROVAL =
  '특히 김치볶음밥의 여자 목소리는 매우 자연스러워서 좋은 거 같아.'

const SAMPLE_RATE = 24_000
const WINDOW_SECONDS = 0.01
const HOP_SECONDS = 0.005
const THRESHOLDS_DBFS = Object.freeze([-45, -40])
const MINIMUM_LEADING_GAP_SECONDS = 0.75
const RETAINED_NATURAL_HEAD_SECONDS = 0.1
const MINIMUM_RETAINED_HEAD_SECONDS = 0.08
const MAXIMUM_RETAINED_HEAD_SECONDS = 0.12
const BOUNDARY_SEARCH_SECONDS = 0.008
const MAXIMUM_BOUNDARY_AMPLITUDE = 0.001

function parseArgs(argv) {
  const result = {
    execute: false,
    outputDirectory: DEFAULT_OUTPUT_DIRECTORY,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--execute') result.execute = true
    else if (argument === '--output') result.outputDirectory = argv[++index]
    else throw new Error('Unknown argument: ' + argument)
  }
  if (!result.outputDirectory) {
    throw new Error('--output requires a non-empty value')
  }
  return result
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function float32Bytes(samples) {
  return Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)
}

function decodeFloat32Base64(base64, expectedSampleCount) {
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length !== expectedSampleCount * 4) {
    throw new Error(
      'Chrome returned ' +
        bytes.length +
        ' PCM bytes; expected ' +
        expectedSampleCount * 4,
    )
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
        const chunkSize = 0x8000
        for (let offset = 0; offset < pcmBytes.length; offset += chunkSize) {
          raw += String.fromCharCode(
            ...pcmBytes.subarray(offset, offset + chunkSize),
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
      sampleRate: SAMPLE_RATE,
    },
  )
  return {
    ...decoded,
    samples: decodeFloat32Base64(
      decoded.pcmFloat32Base64,
      decoded.sampleCount,
    ),
  }
}

function amplitudeToDbfs(amplitude) {
  return amplitude > 0
    ? 20 * Math.log10(amplitude)
    : Number.NEGATIVE_INFINITY
}

function analyzeOverall(samples) {
  let energy = 0
  let peakAmplitude = 0
  let clippingSamples = 0
  for (const sample of samples) {
    if (!Number.isFinite(sample)) {
      throw new Error('Chrome decode produced non-finite PCM')
    }
    energy += sample * sample
    const amplitude = Math.abs(sample)
    peakAmplitude = Math.max(peakAmplitude, amplitude)
    if (amplitude >= 0.999) clippingSamples += 1
  }
  return {
    rmsDbfs: amplitudeToDbfs(Math.sqrt(energy / samples.length)),
    peakDbfs: amplitudeToDbfs(peakAmplitude),
    peakAmplitude,
    clippingSamples,
  }
}

function analyzeLowEnergy(samples, thresholdDbfs) {
  const windowSamples = Math.round(SAMPLE_RATE * WINDOW_SECONDS)
  const hopSamples = Math.round(SAMPLE_RATE * HOP_SECONDS)
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
    const dbfs = amplitudeToDbfs(Math.sqrt(energy / windowSamples))
    windows.push({
      startSample,
      endSampleExclusive: startSample + windowSamples,
      active: dbfs >= thresholdDbfs,
    })
  }

  const firstActiveIndex = windows.findIndex((window) => window.active)
  let lastActiveIndex = -1
  for (let index = windows.length - 1; index >= 0; index -= 1) {
    if (windows[index].active) {
      lastActiveIndex = index
      break
    }
  }
  if (firstActiveIndex < 0 || lastActiveIndex <= firstActiveIndex) {
    throw new Error('No usable active speech windows were detected')
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
    gaps.push({
      startSample,
      endSampleExclusive,
      startSeconds: startSample / SAMPLE_RATE,
      endSeconds: endSampleExclusive / SAMPLE_RATE,
      durationSeconds:
        (endSampleExclusive - startSample) / SAMPLE_RATE,
    })
  }

  return {
    thresholdDbfs,
    windowSeconds: WINDOW_SECONDS,
    hopSeconds: HOP_SECONDS,
    firstActiveSample: windows[firstActiveIndex].startSample,
    lastActiveEndSampleExclusive:
      windows[lastActiveIndex].endSampleExclusive,
    gaps,
  }
}

function selectLeadingGap(analysis) {
  const candidates = analysis.gaps.filter(
    (gap) =>
      gap.durationSeconds >= MINIMUM_LEADING_GAP_SECONDS &&
      gap.endSeconds <= 1.5,
  )
  if (candidates.length !== 1) {
    throw new Error(
      'Expected exactly one long initial gap at ' +
        analysis.thresholdDbfs +
        ' dBFS',
    )
  }
  return candidates[0]
}

function chooseBoundarySample(samples, targetSample, minimum, maximum) {
  const searchSamples = Math.round(
    BOUNDARY_SEARCH_SECONDS * SAMPLE_RATE,
  )
  const start = Math.max(minimum, targetSample - searchSamples)
  const end = Math.min(maximum, targetSample + searchSamples)
  if (start > end) throw new Error('No safe boundary search interval exists')

  let selected = start
  for (let index = start + 1; index <= end; index += 1) {
    const amplitude = Math.abs(samples[index])
    const selectedAmplitude = Math.abs(samples[selected])
    if (
      amplitude < selectedAmplitude ||
      (amplitude === selectedAmplitude &&
        Math.abs(index - targetSample) < Math.abs(selected - targetSample))
    ) {
      selected = index
    }
  }
  if (Math.abs(samples[selected]) > MAXIMUM_BOUNDARY_AMPLITUDE) {
    throw new Error('No click-safe low-amplitude leading boundary was found')
  }
  return selected
}

function encodeFloat32Wav(samples) {
  const bytesPerSample = 4
  const dataBytes = samples.length * bytesPerSample
  const wav = Buffer.alloc(44 + dataBytes)
  wav.write('RIFF', 0, 'ascii')
  wav.writeUInt32LE(36 + dataBytes, 4)
  wav.write('WAVE', 8, 'ascii')
  wav.write('fmt ', 12, 'ascii')
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(3, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(SAMPLE_RATE, 24)
  wav.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28)
  wav.writeUInt16LE(bytesPerSample, 32)
  wav.writeUInt16LE(32, 34)
  wav.write('data', 36, 'ascii')
  wav.writeUInt32LE(dataBytes, 40)
  for (let index = 0; index < samples.length; index += 1) {
    wav.writeFloatLE(samples[index], 44 + index * bytesPerSample)
  }
  return wav
}

function countMismatches(left, right) {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY
  let mismatches = 0
  for (let index = 0; index < left.length; index += 1) {
    if (!Object.is(left[index], right[index])) mismatches += 1
  }
  return mismatches
}

async function assertOutputAbsent(outputDirectory) {
  try {
    await access(outputDirectory)
  } catch (error) {
    if (error && error.code === 'ENOENT') return
    throw error
  }
  throw new Error('Output directory already exists: ' + outputDirectory)
}

function validateParentManifest(bytes) {
  if (
    bytes.length !== SOURCE_MANIFEST_BYTES ||
    sha256(bytes) !== SOURCE_MANIFEST_SHA256
  ) {
    throw new Error('Remaining batch 01 manifest identity changed')
  }
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const manifest = JSON.parse(decoder.decode(bytes))
  if (manifest.schemaVersion !== 2 || manifest.batch !== 'remaining-batch-01') {
    throw new Error('Remaining batch 01 manifest schema changed')
  }
  const source = manifest.generatedFiles.find(
    (entry) => entry.menuId === 'kimchi-fried-rice',
  )
  if (
    !source ||
    source.catalogText !== SOURCE_TEXT ||
    source.spokenText !== SOURCE_TEXT ||
    source.file !== 'kimchi-fried-rice.mp3' ||
    source.byteLength !== SOURCE_BYTES ||
    source.sha256 !== SOURCE_SHA256 ||
    source.model !== 'MAI-Voice-2-Flash' ||
    source.voiceShortName !== 'ko-KR-Haena:MAI-Voice-2-Flash' ||
    source.style !== 'joyful' ||
    source.styleDegree !== 0.48 ||
    source.rate !== '+20%' ||
    source.pitch !== '-1%' ||
    source.structure !== 'one-block'
  ) {
    throw new Error('Kimchi fried rice parent manifest entry changed')
  }
  return source
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const outputDirectory = path.resolve(options.outputDirectory)
  if (options.execute) await assertOutputAbsent(outputDirectory)

  const [source, parentManifestBytes] = await Promise.all([
    readFile(path.resolve(SOURCE_PATH)),
    readFile(path.resolve(SOURCE_MANIFEST_PATH)),
  ])
  const parentEntry = validateParentManifest(parentManifestBytes)
  const inspection = inspectRemainingBatch01Mp3(source)
  if (
    inspection.byteLength !== SOURCE_BYTES ||
    inspection.sha256 !== SOURCE_SHA256 ||
    inspection.mpegFrameCount !== 140 ||
    inspection.exactDurationSeconds !== 3.36
  ) {
    throw new Error('Kimchi fried rice source identity changed')
  }

  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const page = await browser.newPage()
    const decoded = await decodeWithChrome(page, source)
    if (
      decoded.sampleRate !== SAMPLE_RATE ||
      decoded.channels !== 1 ||
      decoded.sampleCount !== inspection.mpegFrameCount * 576 ||
      decoded.durationSeconds !== inspection.exactDurationSeconds
    ) {
      throw new Error('Chrome source decode does not match MPEG identity')
    }

    const sourceOverall = analyzeOverall(decoded.samples)
    const analyses = THRESHOLDS_DBFS.map((threshold) =>
      analyzeLowEnergy(decoded.samples, threshold),
    )
    const gaps = analyses.map(selectLeadingGap)
    const robustGapStartSample = Math.max(
      ...gaps.map((gap) => gap.startSample),
    )
    const robustGapEndSampleExclusive = Math.min(
      ...gaps.map((gap) => gap.endSampleExclusive),
    )
    if (robustGapEndSampleExclusive <= robustGapStartSample) {
      throw new Error('The -45/-40 dBFS leading gaps do not overlap')
    }

    const mainSpeechStartSample = Math.max(
      ...gaps.map((gap) => gap.endSampleExclusive),
    )
    const requestedHeadSamples = Math.round(
      RETAINED_NATURAL_HEAD_SECONDS * SAMPLE_RATE,
    )
    const targetOutputStartSample =
      mainSpeechStartSample - requestedHeadSamples
    const outputStartSample = chooseBoundarySample(
      decoded.samples,
      targetOutputStartSample,
      robustGapStartSample,
      robustGapEndSampleExclusive - 1,
    )
    const retainedNaturalHeadSamples =
      mainSpeechStartSample - outputStartSample
    const retainedNaturalHeadSeconds =
      retainedNaturalHeadSamples / SAMPLE_RATE
    if (
      retainedNaturalHeadSeconds < MINIMUM_RETAINED_HEAD_SECONDS ||
      retainedNaturalHeadSeconds > MAXIMUM_RETAINED_HEAD_SECONDS
    ) {
      throw new Error('Selected natural head is outside the 80-120 ms limit')
    }

    const outputSamples = decoded.samples.slice(outputStartSample)
    const sourceRetained = decoded.samples.subarray(outputStartSample)
    const sourceRetainedSha256 = sha256(float32Bytes(sourceRetained))
    const outputPcmSha256 = sha256(float32Bytes(outputSamples))
    const sourceOutputMismatchSamples = countMismatches(
      sourceRetained,
      outputSamples,
    )
    if (
      sourceOutputMismatchSamples !== 0 ||
      sourceRetainedSha256 !== outputPcmSha256
    ) {
      throw new Error('Retained source PCM changed before WAV encoding')
    }

    const wav = encodeFloat32Wav(outputSamples)
    const wavDecoded = await decodeWithChrome(page, wav)
    const wavRedecodeMismatchSamples = countMismatches(
      outputSamples,
      wavDecoded.samples,
    )
    if (
      wavDecoded.sampleRate !== SAMPLE_RATE ||
      wavDecoded.channels !== 1 ||
      wavRedecodeMismatchSamples !== 0
    ) {
      throw new Error('Chrome WAV redecode changed retained PCM')
    }

    const outputOverall = analyzeOverall(outputSamples)
    if (
      outputOverall.peakAmplitude !== sourceOverall.peakAmplitude ||
      outputOverall.clippingSamples !== sourceOverall.clippingSamples
    ) {
      throw new Error('Leading trim changed peak or clipping identity')
    }

    const manifest = {
      schemaVersion: 1,
      purpose: 'local-listening-candidate-only',
      generatedAt: new Date().toISOString(),
    userApproval: {
      statement: USER_APPROVAL,
      performanceLockStatement: PERFORMANCE_LOCK_APPROVAL,
        interpretation:
          'Only the initial empty/artifact region may be shortened; the accepted performance must otherwise remain unchanged.',
      },
      source: {
        path: SOURCE_PATH,
        byteLength: source.length,
        sha256: sha256(source),
        mpegFrameCount: inspection.mpegFrameCount,
        exactDurationSeconds: inspection.exactDurationSeconds,
        immutable: true,
        parentManifest: {
          path: SOURCE_MANIFEST_PATH,
          byteLength: parentManifestBytes.length,
          sha256: sha256(parentManifestBytes),
          schemaVersion: 2,
        },
        performance: {
          menuId: parentEntry.menuId,
          catalogText: parentEntry.catalogText,
          spokenText: parentEntry.spokenText,
          model: parentEntry.model,
          voiceShortName: parentEntry.voiceShortName,
          style: parentEntry.style,
          styleDegree: parentEntry.styleDegree,
          rate: parentEntry.rate,
          pitch: parentEntry.pitch,
          structure: parentEntry.structure,
        },
        decodedPcm: {
          sampleRate: decoded.sampleRate,
          channels: decoded.channels,
          sampleCount: decoded.sampleCount,
          durationSeconds: decoded.durationSeconds,
          overall: sourceOverall,
        },
      },
      tool: {
        script:
          'scripts/narration/trim-kimchi-fried-rice-leading-gap.mjs',
        runtime: process.version,
        decoder: 'Chrome Web Audio API AudioContext.decodeAudioData',
        chromeVersion: browser.version(),
        userAgent: decoded.userAgent,
        networkRequests: 0,
        azureRequests: 0,
      },
      detection: {
        windowSeconds: WINDOW_SECONDS,
        hopSeconds: HOP_SECONDS,
        thresholds: analyses.map((analysis, index) => ({
          thresholdDbfs: analysis.thresholdDbfs,
          firstActiveSample: analysis.firstActiveSample,
          firstActiveSeconds:
            analysis.firstActiveSample / SAMPLE_RATE,
          selectedLeadingGap: gaps[index],
        })),
        robustGapIntersection: {
          startSample: robustGapStartSample,
          endSampleExclusive: robustGapEndSampleExclusive,
          startSeconds: robustGapStartSample / SAMPLE_RATE,
          endSeconds: robustGapEndSampleExclusive / SAMPLE_RATE,
          durationSeconds:
            (robustGapEndSampleExclusive - robustGapStartSample) /
            SAMPLE_RATE,
        },
        mainSpeechStartSample,
        mainSpeechStartSeconds: mainSpeechStartSample / SAMPLE_RATE,
        wordAligned: false,
        limitation:
          'The main speech start is the conservative right edge of corroborating -45/-40 dBFS gaps, not a word timestamp.',
      },
      trim: {
        mode: 'leading-only',
        outputStartSample,
        outputStartSeconds: outputStartSample / SAMPLE_RATE,
        outputEndSampleExclusive: decoded.samples.length,
        removedLeadingSamples: outputStartSample,
        removedLeadingSeconds: outputStartSample / SAMPLE_RATE,
        removedTailSamples: 0,
        removedTailSeconds: 0,
        retainedNaturalHeadSamples,
        retainedNaturalHeadSeconds,
        targetRetainedNaturalHeadSeconds:
          RETAINED_NATURAL_HEAD_SECONDS,
        boundarySearchSeconds: BOUNDARY_SEARCH_SECONDS,
        boundaryAmplitude: Math.abs(decoded.samples[outputStartSample]),
        maximumBoundaryAmplitude: MAXIMUM_BOUNDARY_AMPLITUDE,
        fadesApplied: false,
        normalized: false,
        resampled: false,
        gainApplied: false,
      },
      preservation: {
        allSourceSamplesFromOutputStartThroughEndRetained: true,
        retainedPcmBitExact: true,
        sourceOutputMismatchSamples,
        chromeWavRedecodeMismatchSamples: wavRedecodeMismatchSamples,
        sourceRetainedFloat32Sha256: sourceRetainedSha256,
        outputFloat32Sha256: outputPcmSha256,
        headAndTailAfterOutputStartPreserved: true,
        activeSpeechPcmPreserved: true,
      },
      output: {
        path: path
          .relative(process.cwd(), path.join(outputDirectory, OUTPUT_FILE))
          .replaceAll('\\', '/'),
        container: 'WAVE',
        encoding: 'IEEE 32-bit float PCM',
        sampleRate: SAMPLE_RATE,
        channels: 1,
        sampleCount: outputSamples.length,
        exactDurationSeconds: outputSamples.length / SAMPLE_RATE,
        byteLength: wav.length,
        sha256: sha256(wav),
        pcmSha256: sha256(wav.subarray(44)),
        overall: outputOverall,
        runtimeIntegrated: false,
      },
    }

    console.log(JSON.stringify(manifest, null, 2))
    if (!options.execute) {
      console.log('Dry run only. No files were written.')
      return
    }

    await mkdir(outputDirectory, { recursive: false })
    await writeFile(path.join(outputDirectory, OUTPUT_FILE), wav, {
      flag: 'wx',
    })
    await writeFile(
      path.join(outputDirectory, MANIFEST_FILE),
      JSON.stringify(manifest, null, 2) + '\n',
      { flag: 'wx' },
    )
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(
    'Kimchi fried rice leading-gap trim failed: ' + error.message,
  )
  process.exitCode = 1
})

import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { chromium } from 'playwright'

const DECODE_SAMPLE_RATE = 24_000
const ANALYSIS_WINDOW_SECONDS = 0.01
const ANALYSIS_HOP_SECONDS = 0.005
const SELECTION_THRESHOLD_DBFS = -45
const CORROBORATION_THRESHOLD_DBFS = -40
const REPORTING_THRESHOLDS_DBFS = Object.freeze([-45, -40])
const BOUNDARY_SEARCH_SECONDS = 0.008
const MAX_REMAINING_GAP_ERROR_SECONDS = 0.005
const MAX_CLICK_SAFE_JOIN_DELTA = 0.01
const MAX_SPLICE_ENDPOINT_AMPLITUDE = 0.01
const DEFAULT_OUTPUT_ROOT = 'tmp/narration-preview'

const CANDIDATES = Object.freeze([
  Object.freeze({
    menuId: 'pasta',
    sourcePath:
      'tmp/narration-preview/final-retake-batch-01/pasta.mp3',
    sourceBytes: 45_600,
    sourceSha256:
      '6446A97CFE953987BDFCC4D37DB564058697A27C9F85073888879EAB759AEAF7',
    sourceDurationSeconds: 2.28,
    expectedGapCount: 1,
    minimumRobustGapSeconds: 0.5,
    targetRemainingGapSeconds: 0.135,
    outputDurationTarget: Object.freeze({ minimum: 1.51, maximum: 1.54 }),
    outputDirectoryName: 'pasta-gap-trim-01',
    outputFileName: 'pasta-gap-trim-01.wav',
    manifestFileName: 'pasta-gap-trim-01-manifest.json',
  }),
  Object.freeze({
    menuId: 'bulgogi-deopbap',
    sourcePath:
      'tmp/narration-preview/final-retake-batch-01/bulgogi-deopbap.mp3',
    sourceBytes: 64_800,
    sourceSha256:
      'ED24EC062FA183C9411FA0F78C5ACD80C2E1A76CD170A88615A7D27ADC2A5E1B',
    sourceDurationSeconds: 3.24,
    expectedGapCount: 3,
    minimumRobustGapSeconds: 0.25,
    targetRemainingGapSeconds: 0.115,
    outputDurationTarget: Object.freeze({ minimum: 1.95, maximum: 2.02 }),
    outputDirectoryName: 'bulgogi-deopbap-gap-trim-01',
    outputFileName: 'bulgogi-deopbap-gap-trim-01.wav',
    manifestFileName: 'bulgogi-deopbap-gap-trim-01-manifest.json',
  }),
])

function parseArgs(argv) {
  const result = {
    execute: false,
    menuId: null,
    outputRoot: DEFAULT_OUTPUT_ROOT,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--execute') result.execute = true
    else if (argument === '--menu') result.menuId = argv[++index]
    else if (argument === '--output-root') result.outputRoot = argv[++index]
    else throw new Error(`Unknown argument: ${argument}`)
  }
  if (!result.outputRoot) throw new Error('--output-root requires a value.')
  if (
    result.menuId !== null &&
    !CANDIDATES.some(({ menuId }) => menuId === result.menuId)
  ) {
    throw new Error(`Unknown --menu value: ${result.menuId}`)
  }
  return result
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex').toUpperCase()
}

function float32Bytes(samples) {
  const bytes = Buffer.allocUnsafe(samples.length * 4)
  for (let index = 0; index < samples.length; index += 1) {
    bytes.writeFloatLE(samples[index], index * 4)
  }
  return bytes
}

function decodeFloat32Base64(base64, expectedSampleCount) {
  const bytes = Buffer.from(base64, 'base64')
  if (bytes.length !== expectedSampleCount * 4) {
    throw new Error(
      `Chrome returned ${bytes.length} PCM bytes; expected ${expectedSampleCount * 4}.`,
    )
  }
  const samples = new Float32Array(expectedSampleCount)
  for (let index = 0; index < expectedSampleCount; index += 1) {
    samples[index] = bytes.readFloatLE(index * 4)
  }
  return samples
}

async function decodeWithChrome(page, source) {
  return page.evaluate(
    async ({ sourceBase64, decodeSampleRate }) => {
      const binary = atob(sourceBase64)
      const encoded = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index += 1) {
        encoded[index] = binary.charCodeAt(index)
      }
      const context = new AudioContext({ sampleRate: decodeSampleRate })
      try {
        const decoded = await context.decodeAudioData(encoded.buffer)
        const samples = decoded.getChannelData(0)
        const bytes = new Uint8Array(
          samples.buffer,
          samples.byteOffset,
          samples.byteLength,
        )
        let raw = ''
        const chunkSize = 0x8000
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          raw += String.fromCharCode(
            ...bytes.subarray(offset, offset + chunkSize),
          )
        }
        return {
          sampleRate: decoded.sampleRate,
          channels: decoded.numberOfChannels,
          sampleCount: decoded.length,
          durationSeconds: decoded.duration,
          pcmFloat32Base64: btoa(raw),
          userAgent: navigator.userAgent,
        }
      } finally {
        await context.close()
      }
    },
    {
      sourceBase64: source.toString('base64'),
      decodeSampleRate: DECODE_SAMPLE_RATE,
    },
  )
}

function amplitudeToDbfs(amplitude) {
  return amplitude > 0
    ? 20 * Math.log10(amplitude)
    : Number.NEGATIVE_INFINITY
}

function analyzeOverall(samples) {
  let sumSquares = 0
  let peak = 0
  let clippingSamples = 0
  for (const sample of samples) {
    const absolute = Math.abs(sample)
    sumSquares += sample * sample
    peak = Math.max(peak, absolute)
    if (absolute >= 0.999) clippingSamples += 1
  }
  return {
    rmsDbfs: amplitudeToDbfs(Math.sqrt(sumSquares / samples.length)),
    peakDbfs: amplitudeToDbfs(peak),
    peakAmplitude: peak,
    clippingSamples,
  }
}

function analyzeRms(samples, sampleRate, thresholdDbfs) {
  const windowSamples = Math.round(ANALYSIS_WINDOW_SECONDS * sampleRate)
  const hopSamples = Math.round(ANALYSIS_HOP_SECONDS * sampleRate)
  const windows = []
  for (
    let startSample = 0;
    startSample + windowSamples <= samples.length;
    startSample += hopSamples
  ) {
    let sumSquares = 0
    for (
      let index = startSample;
      index < startSample + windowSamples;
      index += 1
    ) {
      sumSquares += samples[index] * samples[index]
    }
    const rms = Math.sqrt(sumSquares / windowSamples)
    const dbfs = amplitudeToDbfs(rms)
    windows.push({
      startSample,
      endSample: startSample + windowSamples,
      dbfs,
      active: dbfs >= thresholdDbfs,
    })
  }

  const firstActiveWindow = windows.findIndex(({ active }) => active)
  let lastActiveWindow = -1
  for (let index = windows.length - 1; index >= 0; index -= 1) {
    if (windows[index].active) {
      lastActiveWindow = index
      break
    }
  }

  const internalLowEnergyGaps = []
  if (firstActiveWindow >= 0 && lastActiveWindow > firstActiveWindow) {
    let index = firstActiveWindow + 1
    while (index < lastActiveWindow) {
      if (windows[index].active) {
        index += 1
        continue
      }
      const runStart = index
      while (index < lastActiveWindow && !windows[index].active) index += 1
      const runEnd = index - 1
      const startSample = windows[runStart].startSample
      const endSample = windows[runEnd].endSample
      internalLowEnergyGaps.push({
        startSample,
        endSample,
        startSeconds: startSample / sampleRate,
        endSeconds: endSample / sampleRate,
        durationSeconds: (endSample - startSample) / sampleRate,
      })
    }
  }

  const activeWindowCount = windows
    .slice(firstActiveWindow, lastActiveWindow + 1)
    .filter(({ active }) => active).length
  const headSeconds =
    firstActiveWindow >= 0
      ? windows[firstActiveWindow].startSample / sampleRate
      : samples.length / sampleRate
  const tailSeconds =
    lastActiveWindow >= 0
      ? (samples.length - windows[lastActiveWindow].endSample) / sampleRate
      : 0
  const activeEstimateSeconds = (activeWindowCount * hopSamples) / sampleRate

  return {
    thresholdDbfs,
    windowMilliseconds: ANALYSIS_WINDOW_SECONDS * 1000,
    hopMilliseconds: ANALYSIS_HOP_SECONDS * 1000,
    firstActiveSeconds: firstActiveWindow >= 0 ? headSeconds : null,
    lastActiveSeconds:
      lastActiveWindow >= 0
        ? windows[lastActiveWindow].endSample / sampleRate
        : null,
    headSeconds,
    tailSeconds,
    activeSpanSeconds:
      firstActiveWindow >= 0 && lastActiveWindow >= 0
        ? (windows[lastActiveWindow].endSample -
            windows[firstActiveWindow].startSample) /
          sampleRate
        : 0,
    activeEstimateSeconds,
    internalLowEnergyEstimateSeconds: Math.max(
      0,
      samples.length / sampleRate -
        headSeconds -
        tailSeconds -
        activeEstimateSeconds,
    ),
    maximumInternalGapSeconds: internalLowEnergyGaps.reduce(
      (maximum, gap) => Math.max(maximum, gap.durationSeconds),
      0,
    ),
    internalLowEnergyGaps,
  }
}

function overlapSeconds(left, right, sampleRate) {
  return (
    Math.max(
      0,
      Math.min(left.endSample, right.endSample) -
        Math.max(left.startSample, right.startSample),
    ) / sampleRate
  )
}

function selectRobustGaps(config, analyses, sampleRate) {
  const selection = analyses.find(
    ({ thresholdDbfs }) => thresholdDbfs === SELECTION_THRESHOLD_DBFS,
  )
  const corroboration = analyses.find(
    ({ thresholdDbfs }) => thresholdDbfs === CORROBORATION_THRESHOLD_DBFS,
  )
  if (!selection || !corroboration) {
    throw new Error(`${config.menuId}: missing RMS threshold analysis.`)
  }
  const selected = selection.internalLowEnergyGaps
    .filter(
      ({ durationSeconds }) =>
        durationSeconds >= config.minimumRobustGapSeconds,
    )
    .sort((left, right) => left.startSample - right.startSample)
  if (selected.length !== config.expectedGapCount) {
    throw new Error(
      `${config.menuId}: expected ${config.expectedGapCount} robust gaps; found ${selected.length}.`,
    )
  }
  return selected.map((gap) => {
    const match = [...corroboration.internalLowEnergyGaps].sort(
      (left, right) =>
        overlapSeconds(gap, right, sampleRate) -
        overlapSeconds(gap, left, sampleRate),
    )[0]
    const overlap = match ? overlapSeconds(gap, match, sampleRate) : 0
    if (!match || overlap < config.minimumRobustGapSeconds) {
      throw new Error(
        `${config.menuId}: a -45 dBFS gap is not robust at -40 dBFS.`,
      )
    }
    return { selected: gap, corroborating: match, overlapSeconds: overlap }
  })
}

function chooseClickSafeRemoval(samples, sampleRate, gap, targetSeconds) {
  const desiredStart =
    gap.startSample + Math.round((targetSeconds / 2) * sampleRate)
  const desiredEnd =
    gap.endSample - Math.round((targetSeconds / 2) * sampleRate)
  const radius = Math.round(BOUNDARY_SEARCH_SECONDS * sampleRate)
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
        removeEndSample >= gap.endSample ||
        removeEndSample <= removeStartSample
      ) {
        continue
      }
      const remainingGapSeconds =
        ((gap.endSample - gap.startSample) -
          (removeEndSample - removeStartSample)) /
        sampleRate
      const durationError = Math.abs(remainingGapSeconds - targetSeconds)
      if (durationError > MAX_REMAINING_GAP_ERROR_SECONDS) continue

      const leftSample = samples[removeStartSample - 1]
      const rightSample = samples[removeEndSample]
      const joinDelta = Math.abs(leftSample - rightSample)
      if (
        Math.abs(leftSample) > MAX_SPLICE_ENDPOINT_AMPLITUDE ||
        Math.abs(rightSample) > MAX_SPLICE_ENDPOINT_AMPLITUDE ||
        joinDelta > MAX_CLICK_SAFE_JOIN_DELTA
      ) {
        continue
      }
      const score =
        joinDelta * 8 +
        Math.abs(leftSample) +
        Math.abs(rightSample) +
        durationError * 0.1
      if (!best || score < best.score) {
        best = {
          score,
          removeStartSample,
          removeEndSample,
          leftSample,
          rightSample,
          joinDelta,
          remainingGapSeconds,
          durationErrorSeconds: durationError,
        }
      }
    }
  }

  if (!best) {
    throw new Error('No click-safe low-energy splice satisfied the duration gate.')
  }
  return best
}

function spliceSamples(source, removals) {
  const sorted = [...removals].sort(
    (left, right) => left.removeStartSample - right.removeStartSample,
  )
  const keptSegments = []
  let sourceCursor = 0
  let outputLength = source.length
  for (const removal of sorted) {
    if (removal.removeStartSample < sourceCursor) {
      throw new Error('Removal intervals overlap.')
    }
    keptSegments.push({
      startSample: sourceCursor,
      endSample: removal.removeStartSample,
    })
    sourceCursor = removal.removeEndSample
    outputLength -= removal.removeEndSample - removal.removeStartSample
  }
  keptSegments.push({ startSample: sourceCursor, endSample: source.length })

  const output = new Float32Array(outputLength)
  let outputCursor = 0
  const mappedSegments = keptSegments.map((segment) => {
    const slice = source.subarray(segment.startSample, segment.endSample)
    output.set(slice, outputCursor)
    const mapped = {
      sourceStartSample: segment.startSample,
      sourceEndSample: segment.endSample,
      outputStartSample: outputCursor,
      outputEndSample: outputCursor + slice.length,
    }
    outputCursor += slice.length
    return mapped
  })
  if (outputCursor !== output.length) {
    throw new Error('Internal splice length mismatch.')
  }

  let mismatchCount = 0
  for (const segment of mappedSegments) {
    const length = segment.sourceEndSample - segment.sourceStartSample
    for (let index = 0; index < length; index += 1) {
      if (
        source[segment.sourceStartSample + index] !==
        output[segment.outputStartSample + index]
      ) {
        mismatchCount += 1
      }
    }
  }
  if (mismatchCount !== 0) {
    throw new Error(`${mismatchCount} retained PCM samples changed.`)
  }
  return { output, keptSegments: mappedSegments, mismatchCount }
}

function encodeFloat32Wav(samples, sampleRate) {
  const bytesPerSample = 4
  const dataBytes = samples.length * bytesPerSample
  const wav = Buffer.allocUnsafe(44 + dataBytes)
  wav.write('RIFF', 0, 'ascii')
  wav.writeUInt32LE(36 + dataBytes, 4)
  wav.write('WAVE', 8, 'ascii')
  wav.write('fmt ', 12, 'ascii')
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(3, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * bytesPerSample, 28)
  wav.writeUInt16LE(bytesPerSample, 32)
  wav.writeUInt16LE(32, 34)
  wav.write('data', 36, 'ascii')
  wav.writeUInt32LE(dataBytes, 40)
  for (let index = 0; index < samples.length; index += 1) {
    wav.writeFloatLE(samples[index], 44 + index * 4)
  }
  return wav
}

async function pathExists(targetPath) {
  try {
    await access(targetPath)
    return true
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

function relativePath(targetPath) {
  return path.relative(process.cwd(), targetPath).replaceAll('\\', '/')
}

async function loadAndValidateSource(config) {
  const sourcePath = path.resolve(config.sourcePath)
  const source = await readFile(sourcePath)
  if (source.length !== config.sourceBytes || sha256(source) !== config.sourceSha256) {
    throw new Error(`${config.menuId}: pinned final-retake source changed.`)
  }
  return { sourcePath, source }
}

async function createCandidate(config, options, browser, page) {
  const { sourcePath, source } = await loadAndValidateSource(config)
  const decoded = await decodeWithChrome(page, source)
  if (decoded.sampleRate !== DECODE_SAMPLE_RATE || decoded.channels !== 1) {
    throw new Error(
      `${config.menuId}: expected 24 kHz mono; decoded ${decoded.sampleRate} Hz/${decoded.channels}ch.`,
    )
  }
  if (Math.abs(decoded.durationSeconds - config.sourceDurationSeconds) > 1e-12) {
    throw new Error(`${config.menuId}: decoded source duration changed.`)
  }
  const sourceSamples = decodeFloat32Base64(
    decoded.pcmFloat32Base64,
    decoded.sampleCount,
  )
  const sourceAnalyses = REPORTING_THRESHOLDS_DBFS.map((threshold) =>
    analyzeRms(sourceSamples, decoded.sampleRate, threshold),
  )
  const robustGaps = selectRobustGaps(
    config,
    sourceAnalyses,
    decoded.sampleRate,
  )
  const removals = robustGaps.map((robustGap, index) => ({
    id: `gap-${index + 1}`,
    robustGap,
    ...chooseClickSafeRemoval(
      sourceSamples,
      decoded.sampleRate,
      robustGap.selected,
      config.targetRemainingGapSeconds,
    ),
  }))
  const {
    output: outputSamples,
    keptSegments,
    mismatchCount,
  } = spliceSamples(sourceSamples, removals)
  const outputDurationSeconds = outputSamples.length / decoded.sampleRate
  if (
    outputDurationSeconds < config.outputDurationTarget.minimum ||
    outputDurationSeconds > config.outputDurationTarget.maximum
  ) {
    throw new Error(
      `${config.menuId}: output ${outputDurationSeconds}s misses the safe target.`,
    )
  }

  const wav = encodeFloat32Wav(outputSamples, decoded.sampleRate)
  const verifiedDecode = await decodeWithChrome(page, wav)
  const verifiedSamples = decodeFloat32Base64(
    verifiedDecode.pcmFloat32Base64,
    verifiedDecode.sampleCount,
  )
  if (
    verifiedDecode.sampleRate !== decoded.sampleRate ||
    verifiedDecode.channels !== 1 ||
    verifiedSamples.length !== outputSamples.length
  ) {
    throw new Error(`${config.menuId}: Chrome could not reproduce the WAV PCM.`)
  }
  let chromeRedecodeMismatchCount = 0
  for (let index = 0; index < outputSamples.length; index += 1) {
    if (outputSamples[index] !== verifiedSamples[index]) {
      chromeRedecodeMismatchCount += 1
    }
  }
  if (chromeRedecodeMismatchCount !== 0) {
    throw new Error(
      `${config.menuId}: Chrome WAV re-decode changed ${chromeRedecodeMismatchCount} samples.`,
    )
  }

  const outputRoot = path.resolve(options.outputRoot)
  const outputDirectory = path.join(outputRoot, config.outputDirectoryName)
  const outputPath = path.join(outputDirectory, config.outputFileName)
  const manifestPath = path.join(outputDirectory, config.manifestFileName)
  const sourcePcmBytes = float32Bytes(sourceSamples)
  const outputPcmBytes = float32Bytes(outputSamples)
  const outputAnalyses = REPORTING_THRESHOLDS_DBFS.map((threshold) =>
    analyzeRms(outputSamples, decoded.sampleRate, threshold),
  )
  const verifiedKeptSegments = keptSegments.map((segment) => {
    const sourceBytes = float32Bytes(
      sourceSamples.subarray(
        segment.sourceStartSample,
        segment.sourceEndSample,
      ),
    )
    const outputBytes = float32Bytes(
      outputSamples.subarray(
        segment.outputStartSample,
        segment.outputEndSample,
      ),
    )
    return {
      ...segment,
      sourcePcmSha256: sha256(sourceBytes),
      outputPcmSha256: sha256(outputBytes),
      bitExact: sourceBytes.equals(outputBytes),
    }
  })
  const totalRemovedSamples = sourceSamples.length - outputSamples.length

  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    purpose: 'local-listening-candidate-only',
    menuId: config.menuId,
    source: {
      path: relativePath(sourcePath),
      bytes: source.length,
      sha256: sha256(source),
      immutable: true,
      decodedPcm: {
        encoding: 'IEEE 754 Float32 little-endian, mono',
        sampleRate: decoded.sampleRate,
        channels: decoded.channels,
        sampleCount: sourceSamples.length,
        durationSeconds: sourceSamples.length / decoded.sampleRate,
        sha256: sha256(sourcePcmBytes),
        overall: analyzeOverall(sourceSamples),
      },
    },
    tool: {
      runtime: process.version,
      script: 'scripts/narration/trim-final-retake-internal-gaps.mjs',
      decoder:
        'Chrome Web Audio API AudioContext.decodeAudioData via Playwright channel chrome',
      chromeVersion: browser.version(),
      browserUserAgent: decoded.userAgent,
      requestedDecodeSampleRate: DECODE_SAMPLE_RATE,
      networkRequests: 0,
      azureRequests: 0,
      method:
        'Remove only the click-safe centers of low-energy intervals corroborated at -45 and -40 dBFS; concatenate all retained Float32 PCM bit-exactly; write 24 kHz mono IEEE Float32 WAV without resampling, normalization, or fades.',
    },
    selection: {
      rmsWindowMilliseconds: ANALYSIS_WINDOW_SECONDS * 1000,
      rmsHopMilliseconds: ANALYSIS_HOP_SECONDS * 1000,
      selectionThresholdDbfs: SELECTION_THRESHOLD_DBFS,
      corroborationThresholdDbfs: CORROBORATION_THRESHOLD_DBFS,
      expectedGapCount: config.expectedGapCount,
      minimumRobustGapMilliseconds: config.minimumRobustGapSeconds * 1000,
      targetRemainingGapMilliseconds:
        config.targetRemainingGapSeconds * 1000,
      maximumRemainingGapErrorMilliseconds:
        MAX_REMAINING_GAP_ERROR_SECONDS * 1000,
      boundarySearchMilliseconds: BOUNDARY_SEARCH_SECONDS * 1000,
      outputDurationTargetSeconds: config.outputDurationTarget,
    },
    edits: removals.map((removal) => ({
      id: removal.id,
      detectedLowEnergyIntervalAtMinus45: removal.robustGap.selected,
      corroboratingLowEnergyIntervalAtMinus40:
        removal.robustGap.corroborating,
      thresholdOverlapSeconds: removal.robustGap.overlapSeconds,
      removedInterval: {
        startSample: removal.removeStartSample,
        endSample: removal.removeEndSample,
        startSeconds: removal.removeStartSample / decoded.sampleRate,
        endSeconds: removal.removeEndSample / decoded.sampleRate,
        durationSeconds:
          (removal.removeEndSample - removal.removeStartSample) /
          decoded.sampleRate,
      },
      resultingDetectedGapSeconds: removal.remainingGapSeconds,
      splice: {
        leftSample: removal.leftSample,
        rightSample: removal.rightSample,
        absoluteJoinDelta: removal.joinDelta,
        maximumAllowedJoinDelta: MAX_CLICK_SAFE_JOIN_DELTA,
        maximumAllowedEndpointAmplitude: MAX_SPLICE_ENDPOINT_AMPLITUDE,
        durationErrorSeconds: removal.durationErrorSeconds,
        fadesApplied: false,
      },
    })),
    preservation: {
      retainedPcmBitExact: true,
      retainedSampleMismatchCount: mismatchCount,
      chromeWavRedecodeMismatchCount: chromeRedecodeMismatchCount,
      selectedLowEnergyCoresOnly: true,
      resampled: false,
      normalized: false,
      faded: false,
      headAndTailPreserved: true,
      keptSourceSegments: verifiedKeptSegments,
      limitation:
        'Selection uses short-window RMS only. No word timestamps or forced alignment are available, so removed intervals are not attributed to words or linguistic boundaries.',
    },
    analysis: {
      source: sourceAnalyses,
      output: outputAnalyses,
    },
    output: {
      path: relativePath(outputPath),
      manifestPath: relativePath(manifestPath),
      container: 'RIFF/WAVE',
      encoding: 'IEEE Float32 PCM',
      bitsPerSample: 32,
      sampleRate: decoded.sampleRate,
      channels: 1,
      sampleCount: outputSamples.length,
      durationSeconds: outputDurationSeconds,
      bytes: wav.length,
      sha256: sha256(wav),
      pcmSha256: sha256(outputPcmBytes),
      overall: analyzeOverall(outputSamples),
      totalRemovedSamples,
      totalRemovedSeconds: totalRemovedSamples / decoded.sampleRate,
      runtimeIntegrated: false,
    },
  }

  return { outputDirectory, outputPath, manifestPath, wav, manifest }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const selected = CANDIDATES.filter(
    ({ menuId }) => options.menuId === null || options.menuId === menuId,
  )
  const plans = []
  for (const config of selected) {
    const { sourcePath, source } = await loadAndValidateSource(config)
    const outputDirectory = path.join(
      path.resolve(options.outputRoot),
      config.outputDirectoryName,
    )
    plans.push({
      menuId: config.menuId,
      sourcePath: relativePath(sourcePath),
      sourceBytes: source.length,
      sourceSha256: sha256(source),
      outputDirectory: relativePath(outputDirectory),
      targetRemainingGapMilliseconds:
        config.targetRemainingGapSeconds * 1000,
      outputDurationTargetSeconds: config.outputDurationTarget,
    })
  }
  console.log(JSON.stringify({ mode: options.execute ? 'EXECUTE' : 'DRY_RUN', plans }, null, 2))
  if (!options.execute) {
    console.log('Dry run only: no Chrome launch, network request, or file write.')
    return
  }

  for (const plan of plans) {
    const outputDirectory = path.resolve(plan.outputDirectory)
    if (await pathExists(outputDirectory)) {
      throw new Error(`Refusing to overwrite existing output: ${plan.outputDirectory}`)
    }
  }

  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  let networkRequests = 0
  try {
    const page = await browser.newPage()
    page.on('request', () => {
      networkRequests += 1
    })
    const results = []
    for (const config of selected) {
      results.push(await createCandidate(config, options, browser, page))
    }
    if (networkRequests !== 0) {
      throw new Error(`Unexpected browser network requests: ${networkRequests}`)
    }
    for (const result of results) {
      await mkdir(result.outputDirectory, { recursive: false })
      await writeFile(result.outputPath, result.wav, { flag: 'wx' })
      await writeFile(
        result.manifestPath,
        `${JSON.stringify(result.manifest, null, 2)}\n`,
        { flag: 'wx' },
      )
      console.log(JSON.stringify(result.manifest, null, 2))
    }
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(`Final-retake gap trim failed: ${error.message}`)
  process.exitCode = 1
})

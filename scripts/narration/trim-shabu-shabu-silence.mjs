import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { chromium } from '@playwright/test'

import { inspectSlowRetakeBatch01Mp3 } from './azureSlowRetakeBatch01.mjs'

const DEFAULT_INPUT =
  'tmp/narration-preview/slow-retake-batch-01/shabu-shabu.mp3'
const DEFAULT_OUTPUT =
  'tmp/narration-preview/shabu-shabu-silence-trim-01'
const OUTPUT_FILE = 'shabu-shabu-trimmed.wav'
const MANIFEST_FILE = 'shabu-shabu-silence-trim-01-manifest.json'
const EXPECTED_SOURCE_BYTES = 44_640
const EXPECTED_SOURCE_SHA256 =
  'b42d30cde29d7b239fbae56eb621b98b2dbd82f427459904e17c75d0b4606a95'
const SAMPLE_RATE = 24_000
const ACTIVE_THRESHOLD_DBFS = -40
const RMS_WINDOW_SECONDS = 0.01
const RMS_HOP_SECONDS = 0.005
const RETAINED_HEAD_SECONDS = 0.075
const RETAINED_TAIL_SECONDS = 0.135
const FADE_SECONDS = 0.005

function parseArgs(argv) {
  const options = {
    execute: false,
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--execute') options.execute = true
    else if (argument === '--input') options.input = argv[++index]
    else if (argument === '--output') options.output = argv[++index]
    else throw new Error(`Unknown argument: ${argument}`)
  }
  if (!options.input || !options.output) {
    throw new Error('--input and --output require non-empty values')
  }
  return options
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function float32Bytes(samples) {
  return Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)
}

function rmsDb(samples, start, length) {
  let energy = 0
  for (let index = start; index < start + length; index += 1) {
    energy += samples[index] * samples[index]
  }
  const rms = Math.sqrt(energy / length)
  return rms > 0 ? 20 * Math.log10(rms) : Number.NEGATIVE_INFINITY
}

function analyzeActiveBounds(samples) {
  const windowSamples = Math.round(SAMPLE_RATE * RMS_WINDOW_SECONDS)
  const hopSamples = Math.round(SAMPLE_RATE * RMS_HOP_SECONDS)
  const activeWindows = []
  for (
    let startSample = 0;
    startSample + windowSamples <= samples.length;
    startSample += hopSamples
  ) {
    if (rmsDb(samples, startSample, windowSamples) >= ACTIVE_THRESHOLD_DBFS) {
      activeWindows.push({
        startSample,
        endSampleExclusive: startSample + windowSamples,
      })
    }
  }
  if (activeWindows.length === 0) throw new Error('No active speech windows found')
  const activeStartSample = activeWindows[0].startSample
  const activeEndSampleExclusive = activeWindows.at(-1).endSampleExclusive
  return {
    windowSamples,
    hopSamples,
    activeStartSample,
    activeEndSampleExclusive,
    detectedHeadSeconds: activeStartSample / SAMPLE_RATE,
    detectedTailSeconds:
      (samples.length - activeEndSampleExclusive) / SAMPLE_RATE,
  }
}

function applyBoundaryFades(samples) {
  const fadeSamples = Math.round(SAMPLE_RATE * FADE_SECONDS)
  if (samples.length < fadeSamples * 2) throw new Error('Output is too short')
  for (let index = 0; index < fadeSamples; index += 1) {
    const gain = index / (fadeSamples - 1)
    samples[index] *= gain
    samples[samples.length - index - 1] *= gain
  }
  return fadeSamples
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

async function decodeWithChrome(mp3Bytes) {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
  })
  try {
    const page = await browser.newPage()
    const decoded = await page.evaluate(async (base64) => {
      const binary = atob(base64)
      const encoded = Uint8Array.from(binary, (character) =>
        character.charCodeAt(0),
      )
      const context = new AudioContext({ sampleRate: 24_000 })
      try {
        const audio = await context.decodeAudioData(encoded.buffer)
        return {
          sampleRate: audio.sampleRate,
          channels: audio.numberOfChannels,
          samples: Array.from(audio.getChannelData(0)),
        }
      } finally {
        await context.close()
      }
    }, mp3Bytes.toString('base64'))
    return {
      chromeVersion: browser.version(),
      sampleRate: decoded.sampleRate,
      channels: decoded.channels,
      samples: Float32Array.from(decoded.samples),
    }
  } finally {
    await browser.close()
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const inputPath = path.resolve(options.input)
  const outputDirectory = path.resolve(options.output)
  const source = await readFile(inputPath)
  const inspection = inspectSlowRetakeBatch01Mp3(source)
  if (
    inspection.byteLength !== EXPECTED_SOURCE_BYTES ||
    inspection.sha256 !== EXPECTED_SOURCE_SHA256
  ) {
    throw new Error('Shabu-shabu slow-retake source pin does not match')
  }

  const decoded = await decodeWithChrome(source)
  if (decoded.sampleRate !== SAMPLE_RATE || decoded.channels !== 1) {
    throw new Error('Chrome decode must produce 24 kHz mono PCM')
  }
  if (!decoded.samples.every(Number.isFinite)) {
    throw new Error('Chrome decode produced non-finite PCM')
  }

  const bounds = analyzeActiveBounds(decoded.samples)
  const retainedHeadSamples = Math.round(RETAINED_HEAD_SECONDS * SAMPLE_RATE)
  const retainedTailSamples = Math.round(RETAINED_TAIL_SECONDS * SAMPLE_RATE)
  const outputStartSample = bounds.activeStartSample - retainedHeadSamples
  const outputEndSampleExclusive =
    bounds.activeEndSampleExclusive + retainedTailSamples
  if (
    outputStartSample < 0 ||
    outputEndSampleExclusive > decoded.samples.length
  ) {
    throw new Error('Requested retained silence exceeds the decoded source')
  }

  const outputSamples = decoded.samples.slice(
    outputStartSample,
    outputEndSampleExclusive,
  )
  const activeSource = decoded.samples.subarray(
    bounds.activeStartSample,
    bounds.activeEndSampleExclusive,
  )
  const activeOutputStart = bounds.activeStartSample - outputStartSample
  const activeOutput = outputSamples.subarray(
    activeOutputStart,
    activeOutputStart + activeSource.length,
  )
  const sourceActiveSha256 = sha256(float32Bytes(activeSource))
  const outputActiveSha256BeforeFade = sha256(float32Bytes(activeOutput))
  if (sourceActiveSha256 !== outputActiveSha256BeforeFade) {
    throw new Error('Active speech PCM changed before boundary fades')
  }

  const fadeSamples = applyBoundaryFades(outputSamples)
  const outputActiveSha256AfterFade = sha256(float32Bytes(activeOutput))
  if (sourceActiveSha256 !== outputActiveSha256AfterFade) {
    throw new Error('Boundary fades overlapped active speech PCM')
  }

  const wav = encodeFloat32Wav(outputSamples)
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    userApproval: '샤부샤부 좋아 맘에들어',
    source: {
      path: path.relative(process.cwd(), inputPath).replaceAll('\\', '/'),
      bytes: source.length,
      sha256: sha256(source),
      mpegFrameCount: inspection.mpegFrameCount,
      exactDurationSeconds: inspection.exactDurationSeconds,
      decodedSampleRate: decoded.sampleRate,
      decodedChannels: decoded.channels,
      decodedSampleCount: decoded.samples.length,
      decodedDurationSeconds: decoded.samples.length / SAMPLE_RATE,
    },
    tool: {
      script: 'scripts/narration/trim-shabu-shabu-silence.mjs',
      runtime: process.version,
      decoder: 'Chrome Web Audio decodeAudioData',
      chromeVersion: decoded.chromeVersion,
      networkRequests: 0,
      azureRequests: 0,
    },
    analysis: {
      thresholdDbfs: ACTIVE_THRESHOLD_DBFS,
      rmsWindowSeconds: RMS_WINDOW_SECONDS,
      rmsHopSeconds: RMS_HOP_SECONDS,
      ...bounds,
      wordAligned: false,
    },
    trim: {
      outputStartSample,
      outputEndSampleExclusive,
      removedHeadSamples: outputStartSample,
      removedHeadSeconds: outputStartSample / SAMPLE_RATE,
      removedTailSamples: decoded.samples.length - outputEndSampleExclusive,
      removedTailSeconds:
        (decoded.samples.length - outputEndSampleExclusive) / SAMPLE_RATE,
      retainedHeadSamples,
      retainedHeadSeconds: retainedHeadSamples / SAMPLE_RATE,
      retainedTailSamples,
      retainedTailSeconds: retainedTailSamples / SAMPLE_RATE,
      fadeSamples,
      fadeSeconds: fadeSamples / SAMPLE_RATE,
      fadePlacement: 'retained boundary silence only',
    },
    speechPreservation: {
      activeSourceStartSample: bounds.activeStartSample,
      activeSourceEndSampleExclusive: bounds.activeEndSampleExclusive,
      activeOutputStartSample: activeOutputStart,
      activeOutputEndSampleExclusive: activeOutputStart + activeSource.length,
      activeFloat32Sha256: sourceActiveSha256,
      outputActiveFloat32Sha256: outputActiveSha256AfterFade,
      bitExactFloat32: sourceActiveSha256 === outputActiveSha256AfterFade,
      limitation:
        'Active speech bounds are acoustic -40 dBFS windows, not word-aligned timestamps.',
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
      bytes: wav.length,
      sha256: sha256(wav),
    },
  }

  console.log(JSON.stringify(manifest, null, 2))
  if (!options.execute) {
    console.log('Dry run only. Pass --execute to write the WAV and manifest.')
    return
  }

  await mkdir(outputDirectory, { recursive: false })
  await writeFile(path.join(outputDirectory, OUTPUT_FILE), wav, { flag: 'wx' })
  await writeFile(
    path.join(outputDirectory, MANIFEST_FILE),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: 'wx' },
  )
}

main().catch((error) => {
  console.error(`Shabu-shabu silence trim failed: ${error.message}`)
  process.exitCode = 1
})

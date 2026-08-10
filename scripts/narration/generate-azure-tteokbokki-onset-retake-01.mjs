#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCliArgs } from './azureSpeechBatch.mjs'
import { readSafeAzureErrorDetail } from './azureExpressivePilot.mjs'
import { inspectRemainingBatch01Mp3 } from './azureRemainingBatch01.mjs'
import {
  TTEOKBOKKI_ONSET_RETAKE_01_OUTPUT_FORMAT,
  TTEOKBOKKI_ONSET_RETAKE_01_PRICE_ENV,
  TTEOKBOKKI_ONSET_RETAKE_01_REQUIRED_REGION,
  TTEOKBOKKI_ONSET_RETAKE_01_SOURCE_PINS,
  TTEOKBOKKI_ONSET_RETAKE_01_USER_QUOTE,
  buildTteokbokkiOnsetRetake01Ssml,
  createTteokbokkiOnsetRetake01Manifest,
  createTteokbokkiOnsetRetake01Plan,
  readTteokbokkiOnsetRetake01ExecutionConfig,
  readTteokbokkiOnsetRetake01PriceCeiling,
  summarizeTteokbokkiOnsetRetake01Cost,
  validateTteokbokkiOnsetRetake01Sources,
  validateTteokbokkiOnsetRetake01Voice,
} from './azureTteokbokkiOnsetRetake01.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..', '..')
const defaultOutputDirectory = path.join(
  projectRoot,
  'tmp',
  'narration-preview',
  'tteokbokki-onset-retake-01',
)
const manifestFileName = 'tteokbokki-onset-retake-01-manifest.json'

function sourcePath(pin) {
  return path.join(projectRoot, pin.path)
}

function printHelp() {
  console.log(`Azure MAI tteokbokki onset retake 01

Usage:
  node scripts/narration/generate-azure-tteokbokki-onset-retake-01.mjs [--dry-run]
  node scripts/narration/generate-azure-tteokbokki-onset-retake-01.mjs --execute [--output <directory>]

Safety:
  Dry-run is the default and performs no network request, mkdir, or file write.
  Both modes require an explicit ${TTEOKBOKKI_ONSET_RETAKE_01_PRICE_ENV} ceiling.
  Execute requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION=${TTEOKBOKKI_ONSET_RETAKE_01_REQUIRED_REGION}.
  Exact live catalog/active IDs, rejected raw audio, and its parent manifest are pinned.
  A.mp3, B.mp3, and the schema-v2 manifest must all be absent before voices/list.
  The exact Flash Haena joyful voice/style is preflighted before any write.
  Two candidates are synthesized sequentially once each, retry 0, using wx.
  No trim, normalization, postprocessing, or runtime integration is performed.`)
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

async function assertNoOutputWillBeOverwritten(targetPaths) {
  const existing = []
  for (const targetPath of targetPaths) {
    if (await pathExists(targetPath)) existing.push(targetPath)
  }
  if (existing.length > 0) {
    throw new Error(
      `Refusing to overwrite existing tteokbokki onset retake output:\n${existing.join('\n')}`,
    )
  }
}

function endpoint(config, pathName) {
  return `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/${pathName}`
}

async function fetchAvailableVoice(config) {
  const response = await fetch(endpoint(config, 'voices/list'), {
    headers: {
      'Ocp-Apim-Subscription-Key': config.key,
      'User-Agent': 'oneul-mwo-sseol-tteokbokki-onset-retake-01',
    },
  })
  if (!response.ok) {
    const detail = await readSafeAzureErrorDetail(response, [config.key])
    throw new Error(
      `Azure Speech voice preflight failed: HTTP ${response.status}` +
        (detail ? `: ${detail}` : ''),
    )
  }
  const payload = await response.json()
  if (!Array.isArray(payload)) {
    throw new Error('Azure Speech voice preflight returned an invalid payload')
  }
  validateTteokbokkiOnsetRetake01Voice(payload)
}

async function synthesize(config, candidate, targetPath) {
  const ssml = buildTteokbokkiOnsetRetake01Ssml(candidate)
  const response = await fetch(endpoint(config, 'v1'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': config.key,
      'X-Microsoft-OutputFormat':
        TTEOKBOKKI_ONSET_RETAKE_01_OUTPUT_FORMAT,
      'User-Agent': 'oneul-mwo-sseol-tteokbokki-onset-retake-01',
    },
    body: ssml,
  })
  if (!response.ok) {
    const detail = await readSafeAzureErrorDetail(response, [
      config.key,
      candidate.catalogText,
    ])
    throw new Error(
      `Azure Speech request failed for ${candidate.relativeFile}: HTTP ${response.status}` +
        (detail ? `: ${detail}` : ''),
    )
  }
  const audio = new Uint8Array(await response.arrayBuffer())
  if (audio.byteLength === 0) {
    throw new Error(
      `Azure Speech returned empty audio for ${candidate.relativeFile}`,
    )
  }
  const inspection = inspectRemainingBatch01Mp3(audio)
  await writeFile(targetPath, audio, { flag: 'wx' })
  return inspection
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const [
    catalogBytes,
    activeAudioIdsBytes,
    rejectedRawBytes,
    parentManifestBytes,
  ] = await Promise.all([
    readFile(sourcePath(TTEOKBOKKI_ONSET_RETAKE_01_SOURCE_PINS.catalog)),
    readFile(sourcePath(TTEOKBOKKI_ONSET_RETAKE_01_SOURCE_PINS.activeAudioIds)),
    readFile(sourcePath(TTEOKBOKKI_ONSET_RETAKE_01_SOURCE_PINS.rejectedRaw)),
    readFile(sourcePath(TTEOKBOKKI_ONSET_RETAKE_01_SOURCE_PINS.parentManifest)),
  ])
  const sourceAttestation = validateTteokbokkiOnsetRetake01Sources({
    catalogBytes,
    activeAudioIdsBytes,
    rejectedRawBytes,
    parentManifestBytes,
  })
  const plan = createTteokbokkiOnsetRetake01Plan()
  const priceCeiling =
    readTteokbokkiOnsetRetake01PriceCeiling(process.env)
  const pricing = summarizeTteokbokkiOnsetRetake01Cost(
    plan,
    priceCeiling,
  )
  const outputDirectory = path.resolve(
    options.outputDir ?? defaultOutputDirectory,
  )

  console.log(
    `Mode: ${options.execute ? 'EXECUTE' : 'DRY RUN (no network, no writes, no mkdir)'}`,
  )
  console.log(`Output: ${outputDirectory}`)
  console.log(
    `Required region: ${TTEOKBOKKI_ONSET_RETAKE_01_REQUIRED_REGION}`,
  )
  console.log('Retake clips: 2')
  for (const candidate of plan) {
    console.log(
      `- ${candidate.relativeFile} [Flash/Haena/joyful 0.50/${candidate.rates.join('/')}/-1%/adjacent-two + 100ms preroll]`,
    )
  }
  console.log(
    `Conservative full-SSML upper bound: ${pricing.ssmlCharacters} characters`,
  )
  console.log(
    `Maximum estimated cost: $${pricing.maximumEstimatedCostUsd.toFixed(6)} USD at $${priceCeiling}/1M characters`,
  )

  if (!options.execute) {
    console.log(
      'Dry-run complete. No Azure request, mkdir, or file write was attempted.',
    )
    return
  }

  const config = readTteokbokkiOnsetRetake01ExecutionConfig(process.env)
  const targetPaths = plan.map((candidate) =>
    path.join(outputDirectory, candidate.relativeFile),
  )
  const manifestPath = path.join(outputDirectory, manifestFileName)
  await assertNoOutputWillBeOverwritten([...targetPaths, manifestPath])

  console.log('Checking exact Flash Haena voice and joyful style...')
  await fetchAvailableVoice(config)
  console.log('MAI voice preflight passed before writes.')

  await mkdir(outputDirectory, { recursive: true })
  const audioResults = []
  for (let index = 0; index < plan.length; index += 1) {
    const candidate = plan[index]
    const inspection = await synthesize(
      config,
      candidate,
      targetPaths[index],
    )
    audioResults.push(inspection)
    console.log(
      `Generated ${candidate.relativeFile} (${inspection.byteLength} bytes, ${inspection.mpegFrameCount} frames, ${inspection.exactDurationSeconds.toFixed(3)}s)`,
    )
  }
  const manifest = createTteokbokkiOnsetRetake01Manifest({
    sourceAttestation,
    audioResults,
    pricing,
    generatedAt: new Date().toISOString(),
  })
  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  )
  console.log(`Generated ${manifestPath}`)
  console.log(
    'Listening review is required; runtime integration was not attempted.',
  )
}

main().catch((error) => {
  let message = error instanceof Error ? error.message : String(error)
  const key = process.env.AZURE_SPEECH_KEY?.trim()
  if (key) message = message.replaceAll(key, '[REDACTED]')
  message = message.replaceAll(
    TTEOKBOKKI_ONSET_RETAKE_01_USER_QUOTE,
    '[COPY REDACTED]',
  )
  console.error(`Tteokbokki onset retake 01 failed: ${message}`)
  process.exitCode = 1
})

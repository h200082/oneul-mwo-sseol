#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCliArgs } from './azureSpeechBatch.mjs'
import { readSafeAzureErrorDetail } from './azureExpressivePilot.mjs'
import { inspectRemainingBatch01Mp3 } from './azureRemainingBatch01.mjs'
import {
  KALGUKSU_COPY_RETAKE_01_OUTPUT_FORMAT,
  KALGUKSU_COPY_RETAKE_01_PERFORMANCE,
  KALGUKSU_COPY_RETAKE_01_PRICE_ENV,
  KALGUKSU_COPY_RETAKE_01_REQUIRED_REGION,
  KALGUKSU_COPY_RETAKE_01_SOURCE_PINS,
  KALGUKSU_COPY_RETAKE_01_USER_QUOTE,
  buildKalguksuCopyRetake01Ssml,
  createKalguksuCopyRetake01Manifest,
  createKalguksuCopyRetake01Plan,
  readKalguksuCopyRetake01ExecutionConfig,
  readKalguksuCopyRetake01PriceCeiling,
  summarizeKalguksuCopyRetake01Cost,
  validateKalguksuCopyRetake01Sources,
  validateKalguksuCopyRetake01Voice,
} from './azureKalguksuCopyRetake01.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..', '..')
const defaultOutputDirectory = path.join(
  projectRoot,
  'tmp',
  'narration-preview',
  'kalguksu-copy-retake-01',
)
const manifestFileName = 'kalguksu-copy-retake-01-manifest.json'

function sourcePath(pin) {
  return path.join(projectRoot, pin.path)
}

function printHelp() {
  console.log(`Azure MAI kalguksu copy retake 01

Usage:
  node scripts/narration/generate-azure-kalguksu-copy-retake-01.mjs [--dry-run]
  node scripts/narration/generate-azure-kalguksu-copy-retake-01.mjs --execute [--output <directory>]

Safety:
  Dry-run is the default and performs no network request, mkdir, or file write.
  Both dry-run and execute require an explicit ${KALGUKSU_COPY_RETAKE_01_PRICE_ENV} ceiling.
  Execute requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION=${KALGUKSU_COPY_RETAKE_01_REQUIRED_REGION}.
  Exact live catalog/active IDs, rejected raw audio, and its parent manifest are pinned.
  The MP3 and schema-v2 manifest must both be absent before voices/list.
  One Flash Junho determined synthesis is made once, retry 0, with wx/no-overwrite.
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
      `Refusing to overwrite existing kalguksu retake output:\n${existing.join('\n')}`,
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
      'User-Agent': 'oneul-mwo-sseol-kalguksu-copy-retake-01',
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
  validateKalguksuCopyRetake01Voice(payload)
}

async function synthesize(config, targetPath) {
  const ssml = buildKalguksuCopyRetake01Ssml()
  const response = await fetch(endpoint(config, 'v1'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': config.key,
      'X-Microsoft-OutputFormat': KALGUKSU_COPY_RETAKE_01_OUTPUT_FORMAT,
      'User-Agent': 'oneul-mwo-sseol-kalguksu-copy-retake-01',
    },
    body: ssml,
  })
  if (!response.ok) {
    const detail = await readSafeAzureErrorDetail(response, [
      config.key,
      KALGUKSU_COPY_RETAKE_01_PERFORMANCE.catalogText,
    ])
    throw new Error(
      `Azure Speech request failed for kalguksu.mp3: HTTP ${response.status}` +
        (detail ? `: ${detail}` : ''),
    )
  }
  const audio = new Uint8Array(await response.arrayBuffer())
  if (audio.byteLength === 0) {
    throw new Error('Azure Speech returned empty audio for kalguksu.mp3')
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

  const [catalogBytes, activeAudioIdsBytes, rejectedRawBytes, parentManifestBytes] =
    await Promise.all([
      readFile(sourcePath(KALGUKSU_COPY_RETAKE_01_SOURCE_PINS.catalog)),
      readFile(sourcePath(KALGUKSU_COPY_RETAKE_01_SOURCE_PINS.activeAudioIds)),
      readFile(sourcePath(KALGUKSU_COPY_RETAKE_01_SOURCE_PINS.rejectedRaw)),
      readFile(sourcePath(KALGUKSU_COPY_RETAKE_01_SOURCE_PINS.parentManifest)),
    ])
  const sourceAttestation = validateKalguksuCopyRetake01Sources({
    catalogBytes,
    activeAudioIdsBytes,
    rejectedRawBytes,
    parentManifestBytes,
  })
  const plan = createKalguksuCopyRetake01Plan()
  const priceCeiling = readKalguksuCopyRetake01PriceCeiling(process.env)
  const pricing = summarizeKalguksuCopyRetake01Cost(plan, priceCeiling)
  const outputDirectory = path.resolve(
    options.outputDir ?? defaultOutputDirectory,
  )

  console.log(
    `Mode: ${options.execute ? 'EXECUTE' : 'DRY RUN (no network, no writes, no mkdir)'}`,
  )
  console.log(`Output: ${outputDirectory}`)
  console.log(`Required region: ${KALGUKSU_COPY_RETAKE_01_REQUIRED_REGION}`)
  console.log('Retake clips: 1')
  console.log(
    `- kalguksu.mp3 [Flash/Junho/determined 0.36/+12%/-1%/one-block]: ${KALGUKSU_COPY_RETAKE_01_PERFORMANCE.catalogText}`,
  )
  console.log(`Conservative full-SSML upper bound: ${pricing.ssmlCharacters} characters`)
  console.log(
    `Maximum estimated cost: $${pricing.maximumEstimatedCostUsd.toFixed(6)} USD at $${priceCeiling}/1M characters`,
  )

  if (!options.execute) {
    console.log(
      'Dry-run complete. No Azure request, mkdir, or file write was attempted.',
    )
    return
  }

  const config = readKalguksuCopyRetake01ExecutionConfig(process.env)
  const targetPath = path.join(outputDirectory, 'kalguksu.mp3')
  const manifestPath = path.join(outputDirectory, manifestFileName)
  await assertNoOutputWillBeOverwritten([targetPath, manifestPath])

  console.log('Checking exact Flash Junho voice and determined style...')
  await fetchAvailableVoice(config)
  console.log('MAI voice preflight passed before writes.')

  await mkdir(outputDirectory, { recursive: true })
  const inspection = await synthesize(config, targetPath)
  const manifest = createKalguksuCopyRetake01Manifest({
    sourceAttestation,
    inspection,
    pricing,
    generatedAt: new Date().toISOString(),
  })
  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  )
  console.log(
    `Generated kalguksu.mp3 (${inspection.byteLength} bytes, ${inspection.mpegFrameCount} frames, ${inspection.exactDurationSeconds.toFixed(3)}s)`,
  )
  console.log(`Generated ${manifestPath}`)
  console.log('Listening review is required; runtime integration was not attempted.')
}

main().catch((error) => {
  let message = error instanceof Error ? error.message : String(error)
  const key = process.env.AZURE_SPEECH_KEY?.trim()
  if (key) message = message.replaceAll(key, '[REDACTED]')
  message = message.replaceAll(KALGUKSU_COPY_RETAKE_01_USER_QUOTE, '[COPY REDACTED]')
  console.error(`Kalguksu copy retake 01 failed: ${message}`)
  process.exitCode = 1
})

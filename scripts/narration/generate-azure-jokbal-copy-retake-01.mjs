#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCliArgs } from './azureSpeechBatch.mjs'
import { readSafeAzureErrorDetail } from './azureExpressivePilot.mjs'
import { inspectRemainingBatch01Mp3 } from './azureRemainingBatch01.mjs'
import {
  JOKBAL_COPY_RETAKE_01_OUTPUT_FORMAT,
  JOKBAL_COPY_RETAKE_01_PERFORMANCE,
  JOKBAL_COPY_RETAKE_01_PRICE_ENV,
  JOKBAL_COPY_RETAKE_01_REQUIRED_REGION,
  JOKBAL_COPY_RETAKE_01_SOURCE_PINS,
  JOKBAL_COPY_RETAKE_01_USER_QUOTE,
  buildJokbalCopyRetake01Ssml,
  createJokbalCopyRetake01Manifest,
  createJokbalCopyRetake01Plan,
  readJokbalCopyRetake01ExecutionConfig,
  readJokbalCopyRetake01PriceCeiling,
  summarizeJokbalCopyRetake01Cost,
  validateJokbalCopyRetake01Sources,
  validateJokbalCopyRetake01Voice,
} from './azureJokbalCopyRetake01.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..', '..')
const defaultOutputDirectory = path.join(
  projectRoot,
  'tmp',
  'narration-preview',
  'jokbal-copy-retake-01',
)
const manifestFileName = 'jokbal-copy-retake-01-manifest.json'

function sourcePath(pin) {
  return path.join(projectRoot, pin.path)
}

function printHelp() {
  console.log(`Azure MAI jokbal copy retake 01

Usage:
  node scripts/narration/generate-azure-jokbal-copy-retake-01.mjs [--dry-run]
  node scripts/narration/generate-azure-jokbal-copy-retake-01.mjs --execute [--output <directory>]

Safety:
  Dry-run is the default and performs no network request, mkdir, or file write.
  Both dry-run and execute require an explicit ${JOKBAL_COPY_RETAKE_01_PRICE_ENV} ceiling.
  Execute requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION=${JOKBAL_COPY_RETAKE_01_REQUIRED_REGION}.
  Exact live catalog/active IDs, rejected raw audio, and its parent manifest are pinned.
  The MP3 and schema-v2 manifest must both be absent before voices/list.
  One Flash Junho joyful synthesis is made once, retry 0, with wx/no-overwrite.
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
      `Refusing to overwrite existing jokbal retake output:\n${existing.join('\n')}`,
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
      'User-Agent': 'oneul-mwo-sseol-jokbal-copy-retake-01',
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
  validateJokbalCopyRetake01Voice(payload)
}

async function synthesize(config, targetPath) {
  const ssml = buildJokbalCopyRetake01Ssml()
  const response = await fetch(endpoint(config, 'v1'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': config.key,
      'X-Microsoft-OutputFormat': JOKBAL_COPY_RETAKE_01_OUTPUT_FORMAT,
      'User-Agent': 'oneul-mwo-sseol-jokbal-copy-retake-01',
    },
    body: ssml,
  })
  if (!response.ok) {
    const detail = await readSafeAzureErrorDetail(response, [
      config.key,
      JOKBAL_COPY_RETAKE_01_PERFORMANCE.catalogText,
    ])
    throw new Error(
      `Azure Speech request failed for jokbal.mp3: HTTP ${response.status}` +
        (detail ? `: ${detail}` : ''),
    )
  }
  const audio = new Uint8Array(await response.arrayBuffer())
  if (audio.byteLength === 0) {
    throw new Error('Azure Speech returned empty audio for jokbal.mp3')
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
      readFile(sourcePath(JOKBAL_COPY_RETAKE_01_SOURCE_PINS.catalog)),
      readFile(sourcePath(JOKBAL_COPY_RETAKE_01_SOURCE_PINS.activeAudioIds)),
      readFile(sourcePath(JOKBAL_COPY_RETAKE_01_SOURCE_PINS.rejectedRaw)),
      readFile(sourcePath(JOKBAL_COPY_RETAKE_01_SOURCE_PINS.parentManifest)),
    ])
  const sourceAttestation = validateJokbalCopyRetake01Sources({
    catalogBytes,
    activeAudioIdsBytes,
    rejectedRawBytes,
    parentManifestBytes,
  })
  const plan = createJokbalCopyRetake01Plan()
  const priceCeiling = readJokbalCopyRetake01PriceCeiling(process.env)
  const pricing = summarizeJokbalCopyRetake01Cost(plan, priceCeiling)
  const outputDirectory = path.resolve(
    options.outputDir ?? defaultOutputDirectory,
  )

  console.log(
    `Mode: ${options.execute ? 'EXECUTE' : 'DRY RUN (no network, no writes, no mkdir)'}`,
  )
  console.log(`Output: ${outputDirectory}`)
  console.log(`Required region: ${JOKBAL_COPY_RETAKE_01_REQUIRED_REGION}`)
  console.log('Retake clips: 1')
  console.log(
    `- jokbal.mp3 [Flash/Junho/joyful 0.48/+22%/+0%/one-block]: ${JOKBAL_COPY_RETAKE_01_PERFORMANCE.catalogText}`,
  )
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

  const config = readJokbalCopyRetake01ExecutionConfig(process.env)
  const targetPath = path.join(outputDirectory, 'jokbal.mp3')
  const manifestPath = path.join(outputDirectory, manifestFileName)
  await assertNoOutputWillBeOverwritten([targetPath, manifestPath])

  console.log('Checking exact Flash Junho voice and joyful style...')
  await fetchAvailableVoice(config)
  console.log('MAI voice preflight passed before writes.')

  await mkdir(outputDirectory, { recursive: true })
  const inspection = await synthesize(config, targetPath)
  const manifest = createJokbalCopyRetake01Manifest({
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
    `Generated jokbal.mp3 (${inspection.byteLength} bytes, ${inspection.mpegFrameCount} frames, ${inspection.exactDurationSeconds.toFixed(3)}s)`,
  )
  console.log(`Generated ${manifestPath}`)
  console.log('Listening review is required; runtime integration was not attempted.')
}

main().catch((error) => {
  let message = error instanceof Error ? error.message : String(error)
  const key = process.env.AZURE_SPEECH_KEY?.trim()
  if (key) message = message.replaceAll(key, '[REDACTED]')
  message = message.replaceAll(JOKBAL_COPY_RETAKE_01_USER_QUOTE, '[COPY REDACTED]')
  message = message.replaceAll(
    JOKBAL_COPY_RETAKE_01_PERFORMANCE.catalogText,
    '[COPY REDACTED]',
  )
  console.error(`Jokbal copy retake 01 failed: ${message}`)
  process.exitCode = 1
})

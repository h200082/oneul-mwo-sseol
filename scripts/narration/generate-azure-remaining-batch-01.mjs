#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCliArgs } from './azureSpeechBatch.mjs'
import { readSafeAzureErrorDetail } from './azureExpressivePilot.mjs'
import {
  REMAINING_BATCH_01_LISTENING_GROUPS,
  REMAINING_BATCH_01_MODEL_PRICE_PROFILES,
  REMAINING_BATCH_01_OUTPUT_FORMAT,
  REMAINING_BATCH_01_REQUIRED_REGION,
  REMAINING_BATCH_01_SOURCE_PINS,
  buildRemainingBatch01Ssml,
  createRemainingBatch01Manifest,
  createRemainingBatch01Plan,
  inspectRemainingBatch01Mp3,
  readRemainingBatch01ExecutionConfig,
  readRemainingBatch01PriceCeilings,
  summarizeRemainingBatch01Cost,
  validateRemainingBatch01SourceFiles,
  validateRemainingBatch01Voices,
} from './azureRemainingBatch01.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..', '..')
const catalogPath = path.join(
  projectRoot,
  REMAINING_BATCH_01_SOURCE_PINS.catalog.path,
)
const activeAudioIdsPath = path.join(
  projectRoot,
  REMAINING_BATCH_01_SOURCE_PINS.activeAudioIds.path,
)
const defaultOutputDirectory = path.join(
  projectRoot,
  'tmp',
  'narration-preview',
  'remaining-batch-01',
)
const manifestFileName = 'remaining-batch-01-manifest.json'

function printHelp() {
  const priceVariables = Object.values(
    REMAINING_BATCH_01_MODEL_PRICE_PROFILES,
  )
    .map(({ environmentVariable }) => environmentVariable)
    .join(' and ')
  console.log(`Azure MAI remaining narration batch 01

Usage:
  node scripts/narration/generate-azure-remaining-batch-01.mjs [--dry-run]
  node scripts/narration/generate-azure-remaining-batch-01.mjs --execute [--output <directory>]

Safety:
  Dry-run is the default and performs no network request, mkdir, or file write.
  --execute requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION=southeastasia.
  --execute independently requires ${priceVariables}.
  The exact live catalog and active-audio ID source bytes, hashes, parsed order, and copy are pinned.
  All 28 MP3 targets and the schema-v2 manifest must be absent before voices/list or writes.
  voices/list must expose every exact selected ShortName and required style.
  Twenty-eight raw clips are synthesized sequentially once each, retry 0.
  Output uses wx/no-overwrite; every MP3 is inspected for SHA-256, MPEG frames, and exact duration.
  No trim, normalization, transcription substitution, postprocessing, or runtime integration is performed.`)
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
  const existingPaths = []
  for (const targetPath of targetPaths) {
    if (await pathExists(targetPath)) existingPaths.push(targetPath)
  }
  if (existingPaths.length > 0) {
    throw new Error(
      `Refusing to overwrite existing remaining batch 01 output:\n${existingPaths.join('\n')}`,
    )
  }
}

function endpoint(config, pathName) {
  return `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/${pathName}`
}

async function fetchAvailableVoices(config) {
  const response = await fetch(endpoint(config, 'voices/list'), {
    headers: {
      'Ocp-Apim-Subscription-Key': config.key,
      'User-Agent': 'oneul-mwo-sseol-remaining-batch-01',
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
  validateRemainingBatch01Voices(payload)
}

async function synthesizeClip({ config, item, targetPath }) {
  const performance = item.performance
  const response = await fetch(endpoint(config, 'v1'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': config.key,
      'X-Microsoft-OutputFormat': REMAINING_BATCH_01_OUTPUT_FORMAT,
      'User-Agent': 'oneul-mwo-sseol-remaining-batch-01',
    },
    body: buildRemainingBatch01Ssml({
      performance,
      voiceShortName: item.voiceShortName,
    }),
  })
  if (!response.ok) {
    const detail = await readSafeAzureErrorDetail(response, [
      config.key,
      performance.catalogText,
      performance.spokenText,
      ...performance.segments,
    ])
    throw new Error(
      `Azure Speech request failed for ${item.relativeFile}: HTTP ${response.status}` +
        (detail ? `: ${detail}` : ''),
    )
  }
  const audio = new Uint8Array(await response.arrayBuffer())
  if (audio.byteLength === 0) {
    throw new Error(`Azure Speech returned empty audio for ${item.relativeFile}`)
  }
  const inspection = inspectRemainingBatch01Mp3(audio)
  await writeFile(targetPath, audio, { flag: 'wx' })
  return inspection
}

function printPricing(pricing) {
  for (const model of pricing.models) {
    console.log(
      `- ${model.model}: ${model.ssmlCharacters} SSML characters, ` +
        `maximum $${model.maximumEstimatedCostUsd.toFixed(6)} USD ` +
        `at $${model.maximumPriceUsdPerMillionCharacters}/1M ` +
        `(${model.source}; ${model.environmentVariable})`,
    )
  }
  console.log(
    `Maximum estimated total cost: $${pricing.maximumEstimatedCostUsd.toFixed(6)} USD`,
  )
}

function redactErrorMessage(value) {
  let result = String(value)
  const key = process.env.AZURE_SPEECH_KEY?.trim()
  if (key) result = result.replaceAll(key, '[REDACTED]')
  return result
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const [catalogBytes, activeAudioIdsBytes] = await Promise.all([
    readFile(catalogPath),
    readFile(activeAudioIdsPath),
  ])
  const sourceAttestation = validateRemainingBatch01SourceFiles({
    catalogBytes,
    activeAudioIdsBytes,
  })
  const plan = createRemainingBatch01Plan(sourceAttestation.performances)
  const outputDirectory = path.resolve(
    options.outputDir ?? defaultOutputDirectory,
  )
  const dryRunPriceCeilings = readRemainingBatch01PriceCeilings(process.env)
  const dryRunPricing = summarizeRemainingBatch01Cost(
    plan,
    dryRunPriceCeilings,
  )

  console.log(
    `Mode: ${options.execute ? 'EXECUTE' : 'DRY RUN (no network, no writes, no mkdir)'}`,
  )
  console.log(`Catalog: ${catalogPath}`)
  console.log(`Active audio IDs: ${activeAudioIdsPath}`)
  console.log(`Output: ${outputDirectory}`)
  console.log(`Required region: ${REMAINING_BATCH_01_REQUIRED_REGION}`)
  console.log(`Batch clips: ${plan.length}`)
  console.log(
    `Pinned sources passed: catalog ${sourceAttestation.catalogPin.byteLength} bytes ` +
      `sha256 ${sourceAttestation.catalogPin.sha256}; active IDs ` +
      `${sourceAttestation.activeAudioIdsPin.byteLength} bytes sha256 ` +
      sourceAttestation.activeAudioIdsPin.sha256,
  )
  console.log(
    `Conservative full-SSML upper bound: ${dryRunPricing.ssmlCharacters} characters`,
  )
  printPricing(dryRunPricing)

  for (const group of REMAINING_BATCH_01_LISTENING_GROUPS) {
    console.log(`Listening group ${group.listeningGroup} (7 clips):`)
    for (const item of plan.filter(
      ({ performance }) =>
        performance.listeningGroup === group.listeningGroup,
    )) {
      const performance = item.performance
      console.log(
        `- ${item.relativeFile} [${item.model}; ${item.voiceId}; ` +
          `${performance.style}; degree ${performance.styleDegree}; ` +
          `rate ${performance.rate}; pitch ${performance.pitch}; ` +
          `${performance.segments.length === 1 ? 'one-block' : 'adjacent-two-block'}] ` +
          performance.spokenText,
      )
    }
  }

  if (!options.execute) {
    const missing = [
      'AZURE_SPEECH_KEY',
      'AZURE_SPEECH_REGION',
      ...Object.values(REMAINING_BATCH_01_MODEL_PRICE_PROFILES).map(
        ({ environmentVariable }) => environmentVariable,
      ),
    ].filter((name) => !process.env[name]?.trim())
    if (missing.length > 0) {
      console.log(
        `Execute prerequisites not set: ${missing.join(', ')} ` +
          '(not required for dry-run)',
      )
    }
    console.log(
      'Dry-run complete. No Azure request, mkdir, or file write was attempted.',
    )
    return
  }

  const config = readRemainingBatch01ExecutionConfig(process.env)
  const pricing = summarizeRemainingBatch01Cost(
    plan,
    config.priceCeilings,
  )
  const outputItems = plan.map((item) => ({
    item,
    targetPath: path.join(outputDirectory, item.relativeFile),
  }))
  const manifestPath = path.join(outputDirectory, manifestFileName)

  await assertNoOutputWillBeOverwritten([
    ...outputItems.map(({ targetPath }) => targetPath),
    manifestPath,
  ])

  console.log('Checking exact selected MAI voices and required styles...')
  await fetchAvailableVoices(config)
  console.log('MAI voice/style preflight passed before mkdir and writes.')

  await mkdir(outputDirectory, { recursive: true })

  const audioResults = []
  for (const { item, targetPath } of outputItems) {
    const inspection = await synthesizeClip({ config, item, targetPath })
    audioResults.push({ relativeFile: item.relativeFile, ...inspection })
    console.log(
      `Generated ${item.relativeFile} (${inspection.byteLength} bytes, ` +
        `${inspection.mpegFrameCount} MPEG frames, exactly ` +
        `${inspection.exactDurationSeconds.toFixed(3)}s, sha256 ` +
        `${inspection.sha256})`,
    )
  }

  const manifest = createRemainingBatch01Manifest({
    plan,
    audioResults,
    sourceAttestation,
    region: config.region,
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
    'No retry, trim, normalization, transcription override, postprocess, or integration was attempted; four listening groups require human review.',
  )
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Remaining batch 01 failed: ${redactErrorMessage(message)}`)
  process.exitCode = 1
})

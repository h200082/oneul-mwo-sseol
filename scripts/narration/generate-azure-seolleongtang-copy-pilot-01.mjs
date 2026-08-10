#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs, parseNarrationCatalog } from './azureSpeechBatch.mjs'
import { readSafeAzureErrorDetail } from './azureExpressivePilot.mjs'
import {
  SEOLLEONGTANG_COPY_PILOT_01_HARD_MAX_SECONDS,
  SEOLLEONGTANG_COPY_PILOT_01_LIVE_PRIMARY_TEXT,
  SEOLLEONGTANG_COPY_PILOT_01_OUTPUT_FORMAT,
  SEOLLEONGTANG_COPY_PILOT_01_PRICE_CEILING_ENV,
  SEOLLEONGTANG_COPY_PILOT_01_QUALITY_TARGET_SECONDS,
  SEOLLEONGTANG_COPY_PILOT_01_REQUIRED_REGION,
  buildSeolleongtangCopyPilot01Ssml,
  createSeolleongtangCopyPilot01Manifest,
  createSeolleongtangCopyPilot01Plan,
  estimateSeolleongtangCopyPilot01PlannedTiming,
  readSeolleongtangCopyPilot01ExecutionConfig,
  readSeolleongtangCopyPilot01PriceCeiling,
  selectSeolleongtangCopyPilot01Candidates,
  summarizeSeolleongtangCopyPilot01Audio,
  summarizeSeolleongtangCopyPilot01Cost,
  validateSeolleongtangCopyPilot01Voices,
} from './azureSeolleongtangCopyPilot01.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..', '..')
const catalogPath = path.join(projectRoot, 'src', 'data', 'menuNarrations.ts')
const defaultOutputDirectory = path.join(
  projectRoot,
  'tmp',
  'narration-preview',
  'seolleongtang-copy-pilot-01',
)
const manifestFileName = 'seolleongtang-copy-pilot-01-manifest.json'

function printHelp() {
  console.log(`Azure MAI seolleongtang copy pilot 01

Usage:
  node scripts/narration/generate-azure-seolleongtang-copy-pilot-01.mjs [--dry-run]
  node scripts/narration/generate-azure-seolleongtang-copy-pilot-01.mjs --execute [--output <directory>]

Safety:
  Dry-run is the default and performs no network request or file write.
  --execute requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION=southeastasia.
  --execute also requires ${SEOLLEONGTANG_COPY_PILOT_01_PRICE_CEILING_ENV}, set
  from the current official Azure price applicable to the subscription/region.
  voices/list validates Junho and joyful support before any write.
  Three synthesis requests are made once each, without retries.
  Existing audio or manifest files are never overwritten.
  A/B/C use identical acting parameters and one uninterrupted no-comma sentence.
  The live catalog primary remains: ${SEOLLEONGTANG_COPY_PILOT_01_LIVE_PRIMARY_TEXT}`)
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
      `Refusing to overwrite existing copy pilot output:\n${existingPaths.join('\n')}`,
    )
  }
}

function getEndpoint(config, pathName) {
  return `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/${pathName}`
}

async function fetchAvailableVoices(config) {
  const response = await fetch(getEndpoint(config, 'voices/list'), {
    headers: {
      'Ocp-Apim-Subscription-Key': config.key,
      'User-Agent': 'oneul-mwo-sseol-copy-pilot-01',
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
  validateSeolleongtangCopyPilot01Voices(payload)
}

async function synthesizeClip({ config, item, targetPath }) {
  const candidate = item.candidate
  const response = await fetch(getEndpoint(config, 'v1'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': config.key,
      'X-Microsoft-OutputFormat': SEOLLEONGTANG_COPY_PILOT_01_OUTPUT_FORMAT,
      'User-Agent': 'oneul-mwo-sseol-copy-pilot-01',
    },
    body: buildSeolleongtangCopyPilot01Ssml({
      candidate,
      voiceShortName: item.voiceShortName,
    }),
  })
  if (!response.ok) {
    const detail = await readSafeAzureErrorDetail(response, [
      config.key,
      candidate.candidateText,
    ])
    throw new Error(
      `Azure Speech request failed for ${item.relativeFile}: ` +
        `HTTP ${response.status}` +
        (detail ? `: ${detail}` : ''),
    )
  }
  const audio = new Uint8Array(await response.arrayBuffer())
  if (audio.byteLength === 0) {
    throw new Error(`Azure Speech returned empty audio for ${item.relativeFile}`)
  }
  await writeFile(targetPath, audio, { flag: 'wx' })
  return audio.byteLength
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const source = await readFile(catalogPath, 'utf8')
  const candidates = selectSeolleongtangCopyPilot01Candidates(
    parseNarrationCatalog(source),
  )
  const plan = createSeolleongtangCopyPilot01Plan(candidates)
  const outputDirectory = path.resolve(
    options.outputDir ?? defaultOutputDirectory,
  )
  const dryRunPricing = readSeolleongtangCopyPilot01PriceCeiling(process.env)
  const dryRunCost = summarizeSeolleongtangCopyPilot01Cost(
    plan,
    dryRunPricing.maximumPriceUsdPerMillionCharacters,
  )

  console.log(
    `Mode: ${options.execute ? 'EXECUTE' : 'DRY RUN (no network, no writes)'}`,
  )
  console.log(`Catalog: ${catalogPath}`)
  console.log(`Live primary unchanged: ${SEOLLEONGTANG_COPY_PILOT_01_LIVE_PRIMARY_TEXT}`)
  console.log(`Output: ${outputDirectory}`)
  console.log(`Required region: ${SEOLLEONGTANG_COPY_PILOT_01_REQUIRED_REGION}`)
  console.log(`Copy pilot clips: ${plan.length}`)
  console.log(
    `Listening QA target: ${SEOLLEONGTANG_COPY_PILOT_01_QUALITY_TARGET_SECONDS.minimum}-` +
      `${SEOLLEONGTANG_COPY_PILOT_01_QUALITY_TARGET_SECONDS.maximum}s ` +
      `(hard max ${SEOLLEONGTANG_COPY_PILOT_01_HARD_MAX_SECONDS.toFixed(1)}s)`,
  )
  console.log(
    `Conservative full-SSML upper bound: ${dryRunCost.ssmlCharacters} characters`,
  )
  console.log(
    `Maximum estimated cost: $${dryRunCost.maximumEstimatedCostUsd.toFixed(6)} USD ` +
      `at $${dryRunCost.maximumPriceUsdPerMillionCharacters}/1M characters ` +
      `(${dryRunPricing.source})`,
  )
  for (const item of plan) {
    const candidate = item.candidate
    const timing = estimateSeolleongtangCopyPilot01PlannedTiming(candidate)
    console.log(
      `- ${candidate.label} ${item.relativeFile} [${item.voiceId}; ` +
        `${candidate.style}; degree ${candidate.styleDegree}; ` +
        `rate ${candidate.rate}; pitch ${candidate.pitch}] ` +
        `${candidate.candidateText} ` +
        `(planned ${timing.approxDurationSeconds.toFixed(3)}s)`,
    )
  }

  if (!options.execute) {
    const missing = [
      'AZURE_SPEECH_KEY',
      'AZURE_SPEECH_REGION',
      SEOLLEONGTANG_COPY_PILOT_01_PRICE_CEILING_ENV,
    ].filter((name) => !process.env[name]?.trim())
    if (missing.length > 0) {
      console.log(
        `Execute prerequisites not set: ${missing.join(', ')} ` +
          '(not required for dry-run)',
      )
    }
    console.log('Dry-run complete. No Azure request was made and no file was written.')
    return
  }

  const config = readSeolleongtangCopyPilot01ExecutionConfig(process.env)
  const pricing = summarizeSeolleongtangCopyPilot01Cost(
    plan,
    config.maximumPriceUsdPerMillionCharacters,
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

  console.log('Checking selected MAI voice and joyful style...')
  await fetchAvailableVoices(config)
  console.log('MAI voice preflight passed before writes.')

  await mkdir(outputDirectory, { recursive: true })

  const audioResults = []
  for (const { item, targetPath } of outputItems) {
    const byteLength = await synthesizeClip({ config, item, targetPath })
    const summary = summarizeSeolleongtangCopyPilot01Audio(byteLength)
    audioResults.push({ relativeFile: item.relativeFile, byteLength })
    console.log(
      `Generated ${item.relativeFile} (${byteLength} bytes, ` +
        `approximately ${summary.approxDurationSeconds.toFixed(3)}s)`,
    )
    if (!summary.durationWithinHardMaximum) {
      console.warn(
        `QA HARD-MAX warning: ${item.relativeFile} is approximately ` +
          `${summary.approxDurationSeconds.toFixed(3)}s, above ` +
          `${SEOLLEONGTANG_COPY_PILOT_01_HARD_MAX_SECONDS.toFixed(1)}s. ` +
          'The file was kept and no retry was attempted.',
      )
    } else if (!summary.durationWithinTarget) {
      console.warn(
        `QA warning: ${item.relativeFile} is approximately ` +
          `${summary.approxDurationSeconds.toFixed(3)}s, outside ` +
          `${SEOLLEONGTANG_COPY_PILOT_01_QUALITY_TARGET_SECONDS.minimum}-` +
          `${SEOLLEONGTANG_COPY_PILOT_01_QUALITY_TARGET_SECONDS.maximum}s. ` +
          'The file was kept and no retry was attempted.',
      )
    }
  }

  const manifest = createSeolleongtangCopyPilot01Manifest({
    plan,
    audioResults,
    region: config.region,
    pricing,
    pricingSource: config.source,
    generatedAt: new Date().toISOString(),
  })
  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    { encoding: 'utf8', flag: 'wx' },
  )
  console.log(`Generated ${manifestPath}`)
  console.log('No synthesis retry was attempted; listening review is required.')
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Seolleongtang copy pilot 01 failed: ${message}`)
  process.exitCode = 1
})

#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs, parseNarrationCatalog } from './azureSpeechBatch.mjs'
import { readSafeAzureErrorDetail } from './azureExpressivePilot.mjs'
import {
  FULL_BATCH_02_HARD_MAX_SECONDS,
  FULL_BATCH_02_OUTPUT_FORMAT,
  FULL_BATCH_02_PRICE_CEILING_ENV,
  FULL_BATCH_02_QUALITY_TARGET_SECONDS,
  FULL_BATCH_02_REQUIRED_REGION,
  buildFullBatch02Ssml,
  createFullBatch02Manifest,
  createFullBatch02Plan,
  estimateFullBatch02PlannedTiming,
  readFullBatch02ExecutionConfig,
  readFullBatch02PriceCeiling,
  selectFullBatch02Performances,
  summarizeFullBatch02Audio,
  summarizeFullBatch02Cost,
  validateFullBatch02Voices,
} from './azureFullBatch02.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..', '..')
const catalogPath = path.join(projectRoot, 'src', 'data', 'menuNarrations.ts')
const defaultOutputDirectory = path.join(
  projectRoot,
  'tmp',
  'narration-preview',
  'full-batch-02',
)
const manifestFileName = 'full-batch-02-manifest.json'

function printHelp() {
  console.log(`Azure MAI narration full batch 02

Usage:
  node scripts/narration/generate-azure-full-batch-02.mjs [--dry-run]
  node scripts/narration/generate-azure-full-batch-02.mjs --execute [--output <directory>]

Safety:
  Dry-run is the default and performs no network request or file write.
  --execute requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION=southeastasia.
  --execute also requires ${FULL_BATCH_02_PRICE_CEILING_ENV}, set from
  the current official Azure price applicable to the local subscription/region.
  voices/list validates the selected MAI voice and styles before any write.
  Eight synthesis requests are made once each, without retries.
  Output is separate from every earlier batch; existing files are never overwritten.
  Each clip uses one uninterrupted full-sentence express-as/prosody block with final ! only and no explicit break,
  pronunciation override, or mid-sentence acting switch.`)
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
      `Refusing to overwrite existing full batch 02 output:\n${existingPaths.join('\n')}`,
    )
  }
}

function getEndpoint(config, pathName) {
  return `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/${pathName}`
}

async function fetchAvailableVoices(config, performances) {
  const response = await fetch(getEndpoint(config, 'voices/list'), {
    headers: {
      'Ocp-Apim-Subscription-Key': config.key,
      'User-Agent': 'oneul-mwo-sseol-full-batch-02',
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
  validateFullBatch02Voices(payload, performances)
}

async function synthesizeClip({ config, item, targetPath }) {
  const performance = item.performance
  const response = await fetch(getEndpoint(config, 'v1'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': config.key,
      'X-Microsoft-OutputFormat': FULL_BATCH_02_OUTPUT_FORMAT,
      'User-Agent': 'oneul-mwo-sseol-full-batch-02',
    },
    body: buildFullBatch02Ssml({
      performance,
      voiceShortName: item.voiceShortName,
    }),
  })
  if (!response.ok) {
    const detail = await readSafeAzureErrorDetail(response, [
      config.key,
      performance.catalogText,
      performance.spokenText,
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
  const performances = selectFullBatch02Performances(
    parseNarrationCatalog(source),
  )
  const plan = createFullBatch02Plan(performances)
  const outputDirectory = path.resolve(
    options.outputDir ?? defaultOutputDirectory,
  )
  const dryRunPricing = readFullBatch02PriceCeiling(process.env)
  const dryRunCost = summarizeFullBatch02Cost(
    plan,
    dryRunPricing.maximumPriceUsdPerMillionCharacters,
  )

  console.log(
    `Mode: ${options.execute ? 'EXECUTE' : 'DRY RUN (no network, no writes)'}`,
  )
  console.log(`Catalog: ${catalogPath}`)
  console.log(`Output: ${outputDirectory}`)
  console.log(`Required region: ${FULL_BATCH_02_REQUIRED_REGION}`)
  console.log(`Batch clips: ${plan.length}`)
  console.log(
    `Listening QA target: ${FULL_BATCH_02_QUALITY_TARGET_SECONDS.minimum}-` +
      `${FULL_BATCH_02_QUALITY_TARGET_SECONDS.maximum}s ` +
      `(hard max ${FULL_BATCH_02_HARD_MAX_SECONDS.toFixed(1)}s)`,
  )
  console.log(
    'Planned timing is a maximum-only preflight heuristic; ' +
      'the minimum is evaluated from each generated MP3.',
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
    const performance = item.performance
    const timing = estimateFullBatch02PlannedTiming(performance)
    console.log(
      `- ${item.relativeFile} [${item.voiceId}; ${performance.style}; ` +
        `degree ${performance.styleDegree}; rate ${performance.rate}; ` +
        `pitch ${performance.pitch}] ${performance.spokenText} ` +
        `(planned ${timing.approxDurationSeconds.toFixed(3)}s; ` +
        'single natural take)',
    )
  }

  if (!options.execute) {
    const missing = [
      'AZURE_SPEECH_KEY',
      'AZURE_SPEECH_REGION',
      FULL_BATCH_02_PRICE_CEILING_ENV,
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

  const config = readFullBatch02ExecutionConfig(process.env)
  const pricing = summarizeFullBatch02Cost(
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

  console.log('Checking selected MAI voice and required styles...')
  await fetchAvailableVoices(config, performances)
  console.log('MAI voice preflight passed before writes.')

  await mkdir(outputDirectory, { recursive: true })

  const audioResults = []
  for (const { item, targetPath } of outputItems) {
    const byteLength = await synthesizeClip({ config, item, targetPath })
    const summary = summarizeFullBatch02Audio(byteLength)
    audioResults.push({ relativeFile: item.relativeFile, byteLength })
    console.log(
      `Generated ${item.relativeFile} (${byteLength} bytes, ` +
        `approximately ${summary.approxDurationSeconds.toFixed(3)}s)`,
    )
    if (!summary.durationWithinHardMaximum) {
      console.warn(
        `QA HARD-MAX warning: ${item.relativeFile} is approximately ` +
          `${summary.approxDurationSeconds.toFixed(3)}s, above ` +
          `${FULL_BATCH_02_HARD_MAX_SECONDS.toFixed(1)}s. ` +
          'The file was kept and no retry was attempted.',
      )
    } else if (!summary.durationWithinTarget) {
      console.warn(
        `QA warning: ${item.relativeFile} is approximately ` +
          `${summary.approxDurationSeconds.toFixed(3)}s, outside ` +
          `${FULL_BATCH_02_QUALITY_TARGET_SECONDS.minimum}-` +
          `${FULL_BATCH_02_QUALITY_TARGET_SECONDS.maximum}s. ` +
          'The file was kept and no retry was attempted.',
      )
    }
  }

  const manifest = createFullBatch02Manifest({
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
  console.error(`Full batch 02 failed: ${message}`)
  process.exitCode = 1
})

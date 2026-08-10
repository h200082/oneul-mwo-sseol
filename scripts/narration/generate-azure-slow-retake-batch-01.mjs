#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs, parseNarrationCatalog } from './azureSpeechBatch.mjs'
import { readSafeAzureErrorDetail } from './azureExpressivePilot.mjs'
import {
  SLOW_RETAKE_BATCH_01_ACTIVE_SPEECH_TARGET_SECONDS,
  SLOW_RETAKE_BATCH_01_APPROX_FILE_TARGET_SECONDS,
  SLOW_RETAKE_BATCH_01_HARD_MAX_SECONDS,
  SLOW_RETAKE_BATCH_01_MAX_INTERNAL_GAP_MILLISECONDS,
  SLOW_RETAKE_BATCH_01_OUTPUT_FORMAT,
  SLOW_RETAKE_BATCH_01_PRICE_CEILING_ENV,
  SLOW_RETAKE_BATCH_01_REQUIRED_REGION,
  buildSlowRetakeBatch01Ssml,
  createSlowRetakeBatch01Manifest,
  createSlowRetakeBatch01Plan,
  estimateSlowRetakeBatch01PlannedTiming,
  inspectSlowRetakeBatch01Mp3,
  readSlowRetakeBatch01ExecutionConfig,
  readSlowRetakeBatch01PriceCeiling,
  selectSlowRetakeBatch01Performances,
  summarizeSlowRetakeBatch01Audio,
  summarizeSlowRetakeBatch01Cost,
  validateSlowRetakeBatch01SupersededFile,
  validateSlowRetakeBatch01Voices,
} from './azureSlowRetakeBatch01.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..', '..')
const catalogPath = path.join(projectRoot, 'src', 'data', 'menuNarrations.ts')
const defaultOutputDirectory = path.join(
  projectRoot,
  'tmp',
  'narration-preview',
  'slow-retake-batch-01',
)
const manifestFileName = 'slow-retake-batch-01-manifest.json'

function printHelp() {
  console.log(`Azure MAI narration slow retake batch 01

Usage:
  node scripts/narration/generate-azure-slow-retake-batch-01.mjs [--dry-run]
  node scripts/narration/generate-azure-slow-retake-batch-01.mjs --execute [--output <directory>]

Safety:
  Dry-run is the default and performs no network request or file write.
  --execute requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION=southeastasia.
  --execute also requires ${SLOW_RETAKE_BATCH_01_PRICE_CEILING_ENV}, set from
  the current official Azure price applicable to the local subscription/region.
  voices/list validates the selected MAI voice and styles before any write.
  Four synthesis requests are made once each, without retries.
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
      `Refusing to overwrite existing slow retake batch 01 output:\n${existingPaths.join('\n')}`,
    )
  }
}

async function verifyPinnedSupersededSources(performances) {
  for (const performance of performances) {
    const sourcePath = path.resolve(
      projectRoot,
      performance.supersededPreviewPath,
    )
    let audio
    try {
      audio = await readFile(sourcePath)
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'ENOENT') {
        throw new Error(
          `Pinned superseded source is missing: ${performance.menuId}`,
        )
      }
      throw error
    }
    validateSlowRetakeBatch01SupersededFile({
      performance,
      byteLength: audio.byteLength,
      sha256: createHash('sha256').update(audio).digest('hex'),
    })
  }
}

function getEndpoint(config, pathName) {
  return `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/${pathName}`
}

async function fetchAvailableVoices(config, performances) {
  const response = await fetch(getEndpoint(config, 'voices/list'), {
    headers: {
      'Ocp-Apim-Subscription-Key': config.key,
      'User-Agent': 'oneul-mwo-sseol-slow-retake-batch-01',
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
  validateSlowRetakeBatch01Voices(payload, performances)
}

async function synthesizeClip({ config, item, targetPath }) {
  const performance = item.performance
  const response = await fetch(getEndpoint(config, 'v1'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': config.key,
      'X-Microsoft-OutputFormat': SLOW_RETAKE_BATCH_01_OUTPUT_FORMAT,
      'User-Agent': 'oneul-mwo-sseol-slow-retake-batch-01',
    },
    body: buildSlowRetakeBatch01Ssml({
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
  const inspection = inspectSlowRetakeBatch01Mp3(audio)
  await writeFile(targetPath, audio, { flag: 'wx' })
  return inspection
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const source = await readFile(catalogPath, 'utf8')
  const performances = selectSlowRetakeBatch01Performances(
    parseNarrationCatalog(source),
  )
  const plan = createSlowRetakeBatch01Plan(performances)
  const outputDirectory = path.resolve(
    options.outputDir ?? defaultOutputDirectory,
  )
  const dryRunPricing = readSlowRetakeBatch01PriceCeiling(process.env)
  const dryRunCost = summarizeSlowRetakeBatch01Cost(
    plan,
    dryRunPricing.maximumPriceUsdPerMillionCharacters,
  )

  console.log(
    `Mode: ${options.execute ? 'EXECUTE' : 'DRY RUN (no network, no writes)'}`,
  )
  console.log(`Catalog: ${catalogPath}`)
  console.log(`Output: ${outputDirectory}`)
  console.log(`Required region: ${SLOW_RETAKE_BATCH_01_REQUIRED_REGION}`)
  console.log(`Batch clips: ${plan.length}`)
  console.log(
    `Human listening QA: active speech ` +
      `${SLOW_RETAKE_BATCH_01_ACTIVE_SPEECH_TARGET_SECONDS.minimum}-` +
      `${SLOW_RETAKE_BATCH_01_ACTIVE_SPEECH_TARGET_SECONDS.maximum}s; ` +
      `internal gap under ${SLOW_RETAKE_BATCH_01_MAX_INTERNAL_GAP_MILLISECONDS}ms.`,
  )
  console.log(
    'Active speech and internal gaps are not measured automatically; ' +
      'the planned timing is an informational total-text heuristic only.',
  )
  console.log(
    `Generated MP3 byte-length QA uses approximate total-file target ` +
      `${SLOW_RETAKE_BATCH_01_APPROX_FILE_TARGET_SECONDS.minimum}-` +
      `${SLOW_RETAKE_BATCH_01_APPROX_FILE_TARGET_SECONDS.maximum}s ` +
      `(hard max ${SLOW_RETAKE_BATCH_01_HARD_MAX_SECONDS.toFixed(1)}s).`,
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
    const timing = estimateSlowRetakeBatch01PlannedTiming(performance)
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
      SLOW_RETAKE_BATCH_01_PRICE_CEILING_ENV,
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

  const config = readSlowRetakeBatch01ExecutionConfig(process.env)
  const pricing = summarizeSlowRetakeBatch01Cost(
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

  console.log('Checking pinned superseded source hashes...')
  await verifyPinnedSupersededSources(performances)
  console.log('Pinned superseded source hashes passed before network and writes.')

  console.log('Checking selected MAI voice and required styles...')
  await fetchAvailableVoices(config, performances)
  console.log('MAI voice preflight passed before writes.')

  await mkdir(outputDirectory, { recursive: true })

  const audioResults = []
  for (const { item, targetPath } of outputItems) {
    const inspection = await synthesizeClip({ config, item, targetPath })
    const summary = summarizeSlowRetakeBatch01Audio(inspection.byteLength)
    audioResults.push({
      relativeFile: item.relativeFile,
      ...inspection,
    })
    console.log(
      `Generated ${item.relativeFile} (${inspection.byteLength} bytes, ` +
        `${inspection.mpegFrameCount} MPEG frames, ` +
        `exactly ${inspection.exactDurationSeconds.toFixed(3)}s, ` +
        `sha256 ${inspection.sha256})`,
    )
    if (!summary.durationWithinHardMaximum) {
      console.warn(
        `QA HARD-MAX warning: ${item.relativeFile} is approximately ` +
          `${summary.approxDurationSeconds.toFixed(3)}s, above ` +
          `${SLOW_RETAKE_BATCH_01_HARD_MAX_SECONDS.toFixed(1)}s. ` +
          'The file was kept and no retry was attempted.',
      )
    } else if (!summary.durationWithinTarget) {
      console.warn(
        `QA warning: ${item.relativeFile} is approximately ` +
          `${summary.approxDurationSeconds.toFixed(3)}s, outside ` +
          `${SLOW_RETAKE_BATCH_01_APPROX_FILE_TARGET_SECONDS.minimum}-` +
          `${SLOW_RETAKE_BATCH_01_APPROX_FILE_TARGET_SECONDS.maximum}s. ` +
          'The file was kept and no retry was attempted.',
      )
    }
  }

  const manifest = createSlowRetakeBatch01Manifest({
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
  console.error(`Slow retake batch 01 failed: ${message}`)
  process.exitCode = 1
})

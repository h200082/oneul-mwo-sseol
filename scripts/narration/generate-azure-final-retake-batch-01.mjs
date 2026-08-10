#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs, parseNarrationCatalog } from './azureSpeechBatch.mjs'
import { readSafeAzureErrorDetail } from './azureExpressivePilot.mjs'
import {
  FINAL_RETAKE_BATCH_01_ACTIVE_SPEECH_TARGET_SECONDS,
  FINAL_RETAKE_BATCH_01_APPROX_FILE_TARGET_SECONDS,
  FINAL_RETAKE_BATCH_01_HARD_MAX_SECONDS,
  FINAL_RETAKE_BATCH_01_MAX_INTERNAL_GAP_MILLISECONDS,
  FINAL_RETAKE_BATCH_01_OUTPUT_FORMAT,
  FINAL_RETAKE_BATCH_01_PRICE_CEILING_ENV,
  FINAL_RETAKE_BATCH_01_REQUIRED_REGION,
  buildFinalRetakeBatch01Ssml,
  createFinalRetakeBatch01Manifest,
  createFinalRetakeBatch01Plan,
  estimateFinalRetakeBatch01PlannedTiming,
  inspectFinalRetakeBatch01Mp3,
  readFinalRetakeBatch01ExecutionConfig,
  readFinalRetakeBatch01PriceCeiling,
  selectFinalRetakeBatch01Performances,
  summarizeFinalRetakeBatch01Audio,
  summarizeFinalRetakeBatch01Cost,
  validateFinalRetakeBatch01SourceFile,
  validateFinalRetakeBatch01Voices,
} from './azureFinalRetakeBatch01.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..', '..')
const catalogPath = path.join(projectRoot, 'src', 'data', 'menuNarrations.ts')
const defaultOutputDirectory = path.join(
  projectRoot,
  'tmp',
  'narration-preview',
  'final-retake-batch-01',
)
const manifestFileName = 'final-retake-batch-01-manifest.json'
const sourceKinds = Object.freeze(['fast', 'slow'])

function printHelp() {
  console.log(`Azure MAI narration final retake batch 01

Usage:
  node scripts/narration/generate-azure-final-retake-batch-01.mjs [--dry-run]
  node scripts/narration/generate-azure-final-retake-batch-01.mjs --execute [--output <directory>]

Safety:
  Dry-run is the default and performs no network request or file write.
  --execute requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION=southeastasia.
  --execute also requires ${FINAL_RETAKE_BATCH_01_PRICE_CEILING_ENV}, set from
  the current official Azure price applicable to the local subscription/region.
  Every pinned fast and slow source is validated before any network request or write.
  voices/list validates Junho MAI Flash and determined style before any write.
  Two synthesis requests are made once each, without retries.
  Output is separate from earlier batches; target clips and manifest are never overwritten.
  Each clip uses one uninterrupted exact-catalog express-as/prosody block with final ! only.
  There is no break, pronunciation override, emphasis block, or mid-sentence acting switch.`)
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
      `Refusing to overwrite existing final retake batch 01 output:\n${existingPaths.join('\n')}`,
    )
  }
}

async function readPinnedSourceManifest(source, manifestCache) {
  if (manifestCache.has(source.sourceManifestPath)) {
    return manifestCache.get(source.sourceManifestPath)
  }
  const manifestPath = path.resolve(projectRoot, source.sourceManifestPath)
  let manifest
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      throw new Error(`Pinned source manifest is missing: ${source.sourceBatch}`)
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Pinned source manifest is invalid: ${source.sourceBatch}`)
    }
    throw error
  }
  manifestCache.set(source.sourceManifestPath, manifest)
  return manifest
}

async function verifyPinnedSupersededSources(performances) {
  const manifestCache = new Map()
  for (const performance of performances) {
    for (const sourceKind of sourceKinds) {
      const source = performance.supersededSources[sourceKind]
      const sourcePath = path.resolve(projectRoot, source.sourcePreviewPath)
      let audio
      try {
        audio = await readFile(sourcePath)
      } catch (error) {
        if (error && typeof error === 'object' && error.code === 'ENOENT') {
          throw new Error(
            `Pinned ${sourceKind} source is missing: ${performance.menuId}`,
          )
        }
        throw error
      }
      validateFinalRetakeBatch01SourceFile({
        performance,
        sourceKind,
        byteLength: audio.byteLength,
        sha256: createHash('sha256').update(audio).digest('hex'),
      })
      const manifest = await readPinnedSourceManifest(source, manifestCache)
      const generatedFile = Array.isArray(manifest.generatedFiles)
        ? manifest.generatedFiles.find(
            (file) =>
              file?.menuId === performance.menuId &&
              file?.file === `${performance.menuId}.mp3`,
          )
        : undefined
      const isFastSchemaV1 = source.sourceBatch === 'replacement-batch-01'
      const expectedListeningReview = isFastSchemaV1
        ? 'replacement-batch-01-reviewed-copy-and-performance-matrix'
        : 'slow-retake-batch-01-reviewed-copy-and-performance-matrix'
      if (
        manifest.schemaVersion !== (isFastSchemaV1 ? 1 : 2) ||
        manifest.sourceListeningReview !== expectedListeningReview ||
        generatedFile?.catalogText !== source.sourceCatalogText ||
        generatedFile?.byteLength !== source.sourceByteLength ||
        (!isFastSchemaV1 && generatedFile?.sha256 !== source.sourceSha256)
      ) {
        throw new Error(
          `Pinned ${sourceKind} source manifest provenance mismatch: ${performance.menuId}`,
        )
      }
    }
  }
}

function getEndpoint(config, pathName) {
  return `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/${pathName}`
}

async function fetchAvailableVoices(config, performances) {
  const response = await fetch(getEndpoint(config, 'voices/list'), {
    headers: {
      'Ocp-Apim-Subscription-Key': config.key,
      'User-Agent': 'oneul-mwo-sseol-final-retake-batch-01',
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
  validateFinalRetakeBatch01Voices(payload, performances)
}

async function synthesizeClip({ config, item, targetPath }) {
  const performance = item.performance
  const response = await fetch(getEndpoint(config, 'v1'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': config.key,
      'X-Microsoft-OutputFormat': FINAL_RETAKE_BATCH_01_OUTPUT_FORMAT,
      'User-Agent': 'oneul-mwo-sseol-final-retake-batch-01',
    },
    body: buildFinalRetakeBatch01Ssml({
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
  const inspection = inspectFinalRetakeBatch01Mp3(audio)
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
  const performances = selectFinalRetakeBatch01Performances(
    parseNarrationCatalog(source),
  )
  const plan = createFinalRetakeBatch01Plan(performances)
  const outputDirectory = path.resolve(
    options.outputDir ?? defaultOutputDirectory,
  )
  const dryRunPricing = readFinalRetakeBatch01PriceCeiling(process.env)
  const dryRunCost = summarizeFinalRetakeBatch01Cost(
    plan,
    dryRunPricing.maximumPriceUsdPerMillionCharacters,
  )

  console.log(
    `Mode: ${options.execute ? 'EXECUTE' : 'DRY RUN (no network, no writes)'}`,
  )
  console.log(`Catalog: ${catalogPath}`)
  console.log(`Output: ${outputDirectory}`)
  console.log(`Required region: ${FINAL_RETAKE_BATCH_01_REQUIRED_REGION}`)
  console.log(`Batch clips: ${plan.length}`)
  console.log(
    `Human listening QA: active speech ` +
      `${FINAL_RETAKE_BATCH_01_ACTIVE_SPEECH_TARGET_SECONDS.minimum}-` +
      `${FINAL_RETAKE_BATCH_01_ACTIVE_SPEECH_TARGET_SECONDS.maximum}s; ` +
      `internal gap under ${FINAL_RETAKE_BATCH_01_MAX_INTERNAL_GAP_MILLISECONDS}ms.`,
  )
  console.log(
    'Active speech and internal gaps are manual listening checks; ' +
      'the planned timing is an informational total-text heuristic only.',
  )
  console.log(
    `Generated MP3 byte-length QA uses approximate total-file target ` +
      `${FINAL_RETAKE_BATCH_01_APPROX_FILE_TARGET_SECONDS.minimum}-` +
      `${FINAL_RETAKE_BATCH_01_APPROX_FILE_TARGET_SECONDS.maximum}s ` +
      `(hard max ${FINAL_RETAKE_BATCH_01_HARD_MAX_SECONDS.toFixed(1)}s).`,
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
    const timing = estimateFinalRetakeBatch01PlannedTiming(performance)
    console.log(
      `- ${item.relativeFile} [${item.voiceId}; ${performance.style}; ` +
        `degree ${performance.styleDegree}; rate ${performance.rate}; ` +
        `pitch ${performance.pitch}] ${performance.spokenText} ` +
        `(planned ${timing.approxDurationSeconds.toFixed(3)}s; ` +
        'single uninterrupted natural take)',
    )
  }

  if (!options.execute) {
    const missing = [
      'AZURE_SPEECH_KEY',
      'AZURE_SPEECH_REGION',
      FINAL_RETAKE_BATCH_01_PRICE_CEILING_ENV,
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

  const config = readFinalRetakeBatch01ExecutionConfig(process.env)
  const pricing = summarizeFinalRetakeBatch01Cost(
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

  console.log('Checking pinned fast and slow source hashes and provenance...')
  await verifyPinnedSupersededSources(performances)
  console.log(
    'Pinned fast and slow source hashes and provenance passed before network and writes.',
  )

  console.log('Checking selected MAI voice and required style...')
  await fetchAvailableVoices(config, performances)
  console.log('MAI voice preflight passed before writes.')

  await mkdir(outputDirectory, { recursive: true })

  const audioResults = []
  for (const { item, targetPath } of outputItems) {
    const inspection = await synthesizeClip({ config, item, targetPath })
    const summary = summarizeFinalRetakeBatch01Audio(inspection.byteLength)
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
          `${FINAL_RETAKE_BATCH_01_HARD_MAX_SECONDS.toFixed(1)}s. ` +
          'The file was kept and no retry was attempted.',
      )
    } else if (!summary.durationWithinTarget) {
      console.warn(
        `QA warning: ${item.relativeFile} is approximately ` +
          `${summary.approxDurationSeconds.toFixed(3)}s, outside ` +
          `${FINAL_RETAKE_BATCH_01_APPROX_FILE_TARGET_SECONDS.minimum}-` +
          `${FINAL_RETAKE_BATCH_01_APPROX_FILE_TARGET_SECONDS.maximum}s. ` +
          'The file was kept and no retry was attempted.',
      )
    }
  }

  const manifest = createFinalRetakeBatch01Manifest({
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
  console.log('No synthesis retry was attempted; manual listening review is required.')
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Final retake batch 01 failed: ${message}`)
  process.exitCode = 1
})

#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCliArgs, parseNarrationCatalog } from './azureSpeechBatch.mjs'
import { readSafeAzureErrorDetail } from './azureExpressivePilot.mjs'
import {
  REPLACEMENT_PILOT_02_APPROX_FILE_TARGET_SECONDS,
  REPLACEMENT_PILOT_02_HARD_MAX_SECONDS,
  REPLACEMENT_PILOT_02_MAX_INTERNAL_GAP_MILLISECONDS,
  REPLACEMENT_PILOT_02_OUTPUT_FORMAT,
  REPLACEMENT_PILOT_02_PRICE_CEILING_ENV,
  REPLACEMENT_PILOT_02_REQUIRED_REGION,
  buildReplacementPilot02Ssml,
  createReplacementPilot02Manifest,
  createReplacementPilot02Plan,
  estimateReplacementPilot02PlannedTiming,
  inspectReplacementPilot02Mp3,
  readReplacementPilot02ExecutionConfig,
  readReplacementPilot02PriceCeiling,
  selectReplacementPilot02Candidates,
  summarizeReplacementPilot02Audio,
  summarizeReplacementPilot02Cost,
  validateReplacementPilot02RejectedSource,
  validateReplacementPilot02Voices,
} from './azureReplacementPilot02.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..', '..')
const catalogPath = path.join(projectRoot, 'src', 'data', 'menuNarrations.ts')
const defaultOutputDirectory = path.join(
  projectRoot,
  'tmp',
  'narration-preview',
  'replacement-pilot-02',
)
const manifestFileName = 'replacement-pilot-02-manifest.json'
const sourceKinds = Object.freeze(['raw', 'gapTrim'])

function printHelp() {
  console.log(`Azure MAI Set G replacement pilot 02

Usage:
  node scripts/narration/generate-azure-replacement-pilot-02.mjs [--dry-run]
  node scripts/narration/generate-azure-replacement-pilot-02.mjs --execute [--output <directory>]

Safety:
  Dry-run is the default and performs no network request, mkdir, or file write.
  --execute requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION=southeastasia.
  --execute also requires ${REPLACEMENT_PILOT_02_PRICE_CEILING_ENV}.
  All four rejected raw/local-trim source identities and profiles are pinned.
  Source pins are verified before voices/list, synthesis, mkdir, or file writes.
  Four blinded A/B clips are synthesized once each without retries.
  Every target and the manifest use no-overwrite semantics.
  Outputs remain raw listening candidates; no trim, normalization, or runtime integration is performed.`)
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
      `Refusing to overwrite existing replacement pilot 02 output:\n${existingPaths.join('\n')}`,
    )
  }
}

async function readJsonSourceManifest(source) {
  const manifestPath = path.resolve(projectRoot, source.sourceManifestPath)
  try {
    return JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      throw new Error(`Pinned rejected source manifest is missing: ${source.sourceBatch}`)
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Pinned rejected source manifest is invalid: ${source.sourceBatch}`)
    }
    throw error
  }
}

function validateRejectedSourceManifest(candidate, sourceKind, source, manifest) {
  if (sourceKind === 'raw') {
    const generatedFile = Array.isArray(manifest.generatedFiles)
      ? manifest.generatedFiles.find(
          (file) =>
            file?.menuId === candidate.menuId &&
            file?.file === `${candidate.menuId}.mp3`,
        )
      : undefined
    const profile = source.sourceProfile
    if (
      manifest.schemaVersion !== 2 ||
      generatedFile?.catalogText !== candidate.catalogText ||
      generatedFile?.byteLength !== source.sourceByteLength ||
      generatedFile?.sha256 !== source.sourceSha256 ||
      generatedFile?.voiceId !== profile.voiceId ||
      generatedFile?.voiceShortName !== profile.voiceShortName ||
      generatedFile?.spokenText !== candidate.catalogText ||
      generatedFile?.style !== profile.style ||
      generatedFile?.styleDegree !== profile.styleDegree ||
      generatedFile?.rate !== profile.rate ||
      generatedFile?.pitch !== profile.pitch ||
      generatedFile?.exactDurationSeconds !== source.sourceDurationSeconds ||
      manifest.delivery?.expressAsBlocksPerClip !== 1 ||
      manifest.delivery?.prosodyBlocksPerClip !== 1 ||
      manifest.delivery?.explicitBreaksPerClip !== 0 ||
      manifest.delivery?.midSentenceStyleRateOrPitchSwitch !== false
    ) {
      throw new Error(
        `Pinned rejected raw source manifest mismatch: ${candidate.menuId}`,
      )
    }
    return
  }
  if (
    manifest.schemaVersion !== 1 ||
    manifest.menuId !== candidate.menuId ||
    manifest.purpose !== 'local-listening-candidate-only' ||
    manifest.source?.path !== candidate.rejectedSources.raw.sourcePath ||
    manifest.source?.bytes !== candidate.rejectedSources.raw.sourceByteLength ||
    manifest.source?.sha256?.toLowerCase() !==
      candidate.rejectedSources.raw.sourceSha256 ||
    manifest.output?.path !== source.sourcePath ||
    manifest.output?.bytes !== source.sourceByteLength ||
    manifest.output?.sha256?.toLowerCase() !== source.sourceSha256 ||
    manifest.output?.durationSeconds !== source.sourceDurationSeconds ||
    manifest.output?.runtimeIntegrated !== false
  ) {
    throw new Error(
      `Pinned rejected gapTrim source manifest mismatch: ${candidate.menuId}`,
    )
  }
}

async function verifyPinnedRejectedSources(candidates) {
  const checkedMenus = new Set()
  for (const candidate of candidates) {
    if (checkedMenus.has(candidate.menuId)) continue
    checkedMenus.add(candidate.menuId)
    for (const sourceKind of sourceKinds) {
      const source = candidate.rejectedSources[sourceKind]
      const sourcePath = path.resolve(projectRoot, source.sourcePath)
      let bytes
      try {
        bytes = await readFile(sourcePath)
      } catch (error) {
        if (error && typeof error === 'object' && error.code === 'ENOENT') {
          throw new Error(
            `Pinned rejected ${sourceKind} source is missing: ${candidate.menuId}`,
          )
        }
        throw error
      }
      validateReplacementPilot02RejectedSource({
        candidate,
        sourceKind,
        byteLength: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      })
      validateRejectedSourceManifest(
        candidate,
        sourceKind,
        source,
        await readJsonSourceManifest(source),
      )
    }
  }
}

function getEndpoint(config, pathName) {
  return `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/${pathName}`
}

async function fetchAvailableVoices(config) {
  const response = await fetch(getEndpoint(config, 'voices/list'), {
    headers: {
      'Ocp-Apim-Subscription-Key': config.key,
      'User-Agent': 'oneul-mwo-sseol-replacement-pilot-02',
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
  validateReplacementPilot02Voices(payload)
}

async function synthesizeClip({ config, item, targetPath }) {
  const candidate = item.candidate
  const response = await fetch(getEndpoint(config, 'v1'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': config.key,
      'X-Microsoft-OutputFormat': REPLACEMENT_PILOT_02_OUTPUT_FORMAT,
      'User-Agent': 'oneul-mwo-sseol-replacement-pilot-02',
    },
    body: buildReplacementPilot02Ssml({
      candidate,
      voiceShortName: item.voiceShortName,
    }),
  })
  if (!response.ok) {
    const detail = await readSafeAzureErrorDetail(response, [
      config.key,
      candidate.catalogText,
      candidate.spokenText,
      ...(candidate.segments ?? []),
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
  const inspection = inspectReplacementPilot02Mp3(audio)
  await writeFile(targetPath, audio, { flag: 'wx' })
  return inspection
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const catalogSource = await readFile(catalogPath, 'utf8')
  const candidates = selectReplacementPilot02Candidates(
    parseNarrationCatalog(catalogSource),
  )
  const plan = createReplacementPilot02Plan(candidates)
  const outputDirectory = path.resolve(
    options.outputDir ?? defaultOutputDirectory,
  )
  const dryRunPricing = readReplacementPilot02PriceCeiling(process.env)
  const dryRunCost = summarizeReplacementPilot02Cost(
    plan,
    dryRunPricing.maximumPriceUsdPerMillionCharacters,
  )

  console.log(
    `Mode: ${options.execute ? 'EXECUTE' : 'DRY RUN (no network, no writes)'}`,
  )
  console.log(`Catalog: ${catalogPath}`)
  console.log(`Output: ${outputDirectory}`)
  console.log(`Required region: ${REPLACEMENT_PILOT_02_REQUIRED_REGION}`)
  console.log(`Set G clips: ${plan.length}`)
  console.log(
    'Blinded A/B rule: each menu keeps identical voice/style/degree/rate/pitch; only one-block versus adjacent two-block structure changes.',
  )
  console.log(
    `Manual QA: natural one-listen clarity; internal gap ` +
      `${REPLACEMENT_PILOT_02_MAX_INTERNAL_GAP_MILLISECONDS}ms is a review signal, not an automatic edit trigger.`,
  )
  console.log(
    `Generated MP3 byte-length QA uses ${REPLACEMENT_PILOT_02_APPROX_FILE_TARGET_SECONDS.minimum}-` +
      `${REPLACEMENT_PILOT_02_APPROX_FILE_TARGET_SECONDS.maximum}s ` +
      `(hard review signal ${REPLACEMENT_PILOT_02_HARD_MAX_SECONDS.toFixed(1)}s).`,
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
    const timing = estimateReplacementPilot02PlannedTiming(candidate)
    console.log(
      `- ${item.relativeFile} [${candidate.voiceId}; ${candidate.style}; ` +
        `degree ${candidate.styleDegree}; rate ${candidate.rate}; ` +
        `pitch ${candidate.pitch}; ${candidate.structure}] ` +
        `${candidate.spokenText} (planned ${timing.approxDurationSeconds.toFixed(3)}s)`,
    )
  }

  if (!options.execute) {
    const missing = [
      'AZURE_SPEECH_KEY',
      'AZURE_SPEECH_REGION',
      REPLACEMENT_PILOT_02_PRICE_CEILING_ENV,
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

  const config = readReplacementPilot02ExecutionConfig(process.env)
  const pricing = summarizeReplacementPilot02Cost(
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

  console.log('Checking all rejected raw/local-trim source pins and profiles...')
  await verifyPinnedRejectedSources(candidates)
  console.log('Rejected source pins passed before network and writes.')

  console.log('Checking selected MAI voice and joyful style...')
  await fetchAvailableVoices(config)
  console.log('MAI voice preflight passed before writes.')

  await mkdir(outputDirectory, { recursive: true })

  const audioResults = []
  for (const { item, targetPath } of outputItems) {
    const inspection = await synthesizeClip({ config, item, targetPath })
    const summary = summarizeReplacementPilot02Audio(inspection.byteLength)
    audioResults.push({ relativeFile: item.relativeFile, ...inspection })
    console.log(
      `Generated ${item.relativeFile} (${inspection.byteLength} bytes, ` +
        `${inspection.mpegFrameCount} MPEG frames, ` +
        `exactly ${inspection.exactDurationSeconds.toFixed(3)}s, ` +
        `sha256 ${inspection.sha256})`,
    )
    if (!summary.durationWithinHardMaximum) {
      console.warn(
        `QA HARD-MAX review signal: ${item.relativeFile} is approximately ` +
          `${summary.approxDurationSeconds.toFixed(3)}s, above ` +
          `${REPLACEMENT_PILOT_02_HARD_MAX_SECONDS.toFixed(1)}s. ` +
          'The raw file was kept and no retry or postprocess was attempted.',
      )
    } else if (!summary.durationWithinTarget) {
      console.warn(
        `QA review signal: ${item.relativeFile} is approximately ` +
          `${summary.approxDurationSeconds.toFixed(3)}s, outside ` +
          `${REPLACEMENT_PILOT_02_APPROX_FILE_TARGET_SECONDS.minimum}-` +
          `${REPLACEMENT_PILOT_02_APPROX_FILE_TARGET_SECONDS.maximum}s. ` +
          'The raw file was kept and no retry or postprocess was attempted.',
      )
    }
  }

  const manifest = createReplacementPilot02Manifest({
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
  console.log(
    'No retry, trim, normalization, or integration was attempted; blinded human listening review is required.',
  )
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Replacement pilot 02 failed: ${message}`)
  process.exitCode = 1
})

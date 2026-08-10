#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCliArgs } from './azureSpeechBatch.mjs'
import { readSafeAzureErrorDetail } from './azureExpressivePilot.mjs'
import {
  REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_FILES,
  REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_MANIFEST,
  REPLACEMENT_PILOT_02_MAI_VOICE_2_OUTPUT_FORMAT,
  REPLACEMENT_PILOT_02_MAI_VOICE_2_PRICE_CEILING_ENV,
  REPLACEMENT_PILOT_02_MAI_VOICE_2_REQUIRED_REGION,
  REPLACEMENT_PILOT_02_MAI_VOICE_2_SHORT_NAME,
  buildReplacementPilot02MaiVoice2Ssml,
  createReplacementPilot02MaiVoice2Manifest,
  createReplacementPilot02MaiVoice2Plan,
  inspectReplacementPilot02MaiVoice2Mp3,
  readReplacementPilot02MaiVoice2ExecutionConfig,
  readReplacementPilot02MaiVoice2PriceCeiling,
  summarizeReplacementPilot02MaiVoice2Cost,
  validateReplacementPilot02MaiVoice2FlashAudioIdentity,
  validateReplacementPilot02MaiVoice2FlashManifestBytes,
  validateReplacementPilot02MaiVoice2Voices,
} from './azureReplacementPilot02MaiVoice2.mjs'
import {
  REPLACEMENT_PILOT_02_APPROX_FILE_TARGET_SECONDS,
  REPLACEMENT_PILOT_02_HARD_MAX_SECONDS,
  summarizeReplacementPilot02Audio,
} from './azureReplacementPilot02.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..', '..')
const defaultOutputDirectory = path.join(
  projectRoot,
  'tmp',
  'narration-preview',
  'replacement-pilot-02-mai-voice-2',
)
const manifestFileName = 'replacement-pilot-02-mai-voice-2-manifest.json'

function printHelp() {
  console.log(`Azure MAI-Voice-2 Set G comparison

Usage:
  node scripts/narration/generate-azure-replacement-pilot-02-mai-voice-2.mjs [--dry-run]
  node scripts/narration/generate-azure-replacement-pilot-02-mai-voice-2.mjs --execute [--output <directory>]

Safety:
  Dry-run is the default and performs no network request, mkdir, or file write.
  --execute requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION=southeastasia.
  --execute independently requires ${REPLACEMENT_PILOT_02_MAI_VOICE_2_PRICE_CEILING_ENV}.
  The exact Flash manifest and all four Flash MP3 identities are hard-pinned.
  Flash manifest, bytes, hashes, MPEG frames, and durations are validated before network or writes.
  voices/list must expose exact ${REPLACEMENT_PILOT_02_MAI_VOICE_2_SHORT_NAME} with joyful style.
  Four raw clips are synthesized once each without retries or postprocessing.
  Every target and the manifest use no-overwrite semantics; no runtime integration is performed.`)
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
      `Refusing to overwrite existing MAI-Voice-2 comparison output:\n${existingPaths.join('\n')}`,
    )
  }
}

async function readPinnedFile(relativePath, label) {
  try {
    return await readFile(path.resolve(projectRoot, relativePath))
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      throw new Error(`Pinned Flash ${label} is missing`)
    }
    throw error
  }
}

async function verifyPinnedFlashBaseline() {
  const manifestBytes = await readPinnedFile(
    REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_MANIFEST.path,
    'manifest',
  )
  const manifest =
    validateReplacementPilot02MaiVoice2FlashManifestBytes(manifestBytes)
  const files = []
  for (const source of REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_FILES) {
    const audio = await readPinnedFile(source.path, source.file)
    const inspection = inspectReplacementPilot02MaiVoice2Mp3(audio)
    validateReplacementPilot02MaiVoice2FlashAudioIdentity({
      source,
      byteLength: audio.byteLength,
      sha256: createHash('sha256').update(audio).digest('hex'),
      mpegFrameCount: inspection.mpegFrameCount,
      exactDurationSeconds: inspection.exactDurationSeconds,
    })
    files.push(source)
  }
  return Object.freeze({ manifest, files: Object.freeze(files) })
}

function endpoint(config, pathName) {
  return `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/${pathName}`
}

async function fetchAvailableVoices(config) {
  const response = await fetch(endpoint(config, 'voices/list'), {
    headers: {
      'Ocp-Apim-Subscription-Key': config.key,
      'User-Agent': 'oneul-mwo-sseol-replacement-pilot-02-mai-voice-2',
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
  validateReplacementPilot02MaiVoice2Voices(payload)
}

async function synthesizeClip({ config, item, targetPath }) {
  const candidate = item.candidate
  const response = await fetch(endpoint(config, 'v1'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': config.key,
      'X-Microsoft-OutputFormat':
        REPLACEMENT_PILOT_02_MAI_VOICE_2_OUTPUT_FORMAT,
      'User-Agent': 'oneul-mwo-sseol-replacement-pilot-02-mai-voice-2',
    },
    body: buildReplacementPilot02MaiVoice2Ssml({
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
  const inspection = inspectReplacementPilot02MaiVoice2Mp3(audio)
  await writeFile(targetPath, audio, { flag: 'wx' })
  return inspection
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const plan = createReplacementPilot02MaiVoice2Plan()
  const outputDirectory = path.resolve(
    options.outputDir ?? defaultOutputDirectory,
  )
  const dryRunPricing =
    readReplacementPilot02MaiVoice2PriceCeiling(process.env)
  const dryRunCost = summarizeReplacementPilot02MaiVoice2Cost(
    plan,
    dryRunPricing.maximumPriceUsdPerMillionCharacters,
  )

  console.log(
    `Mode: ${options.execute ? 'EXECUTE' : 'DRY RUN (no network, no writes)'}`,
  )
  console.log(`Output: ${outputDirectory}`)
  console.log(`Required region: ${REPLACEMENT_PILOT_02_MAI_VOICE_2_REQUIRED_REGION}`)
  console.log(`Exact target voice: ${REPLACEMENT_PILOT_02_MAI_VOICE_2_SHORT_NAME}`)
  console.log(`Comparison clips: ${plan.length}`)
  console.log(
    `Pinned Flash manifest: ${REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_MANIFEST.byteLength} bytes, ` +
      `sha256 ${REPLACEMENT_PILOT_02_MAI_VOICE_2_FLASH_MANIFEST.sha256}`,
  )
  console.log(
    'SSML invariant: candidate copy, style, degree, rate, pitch, segmentation, and markup are identical; only voice ShortName changes.',
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
    console.log(
      `- ${item.relativeFile} [${candidate.style}; degree ${candidate.styleDegree}; ` +
        `rate ${candidate.rate}; pitch ${candidate.pitch}; ${candidate.structure}] ` +
        candidate.spokenText,
    )
  }

  if (!options.execute) {
    const missing = [
      'AZURE_SPEECH_KEY',
      'AZURE_SPEECH_REGION',
      REPLACEMENT_PILOT_02_MAI_VOICE_2_PRICE_CEILING_ENV,
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

  const config = readReplacementPilot02MaiVoice2ExecutionConfig(process.env)
  const pricing = summarizeReplacementPilot02MaiVoice2Cost(
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

  console.log('Validating hard-pinned Flash manifest and four MP3 identities...')
  const flashAttestation = await verifyPinnedFlashBaseline()
  console.log('Flash baseline passed before network, mkdir, and writes.')

  console.log('Checking exact non-Flash MAI voice and joyful style...')
  await fetchAvailableVoices(config)
  console.log('MAI-Voice-2 voice preflight passed before writes.')

  await mkdir(outputDirectory, { recursive: true })

  const audioResults = []
  for (const { item, targetPath } of outputItems) {
    const inspection = await synthesizeClip({ config, item, targetPath })
    const summary = summarizeReplacementPilot02Audio(inspection.byteLength)
    audioResults.push({ relativeFile: item.relativeFile, ...inspection })
    console.log(
      `Generated ${item.relativeFile} (${inspection.byteLength} bytes, ` +
        `${inspection.mpegFrameCount} MPEG frames, exactly ` +
        `${inspection.exactDurationSeconds.toFixed(3)}s, ` +
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

  const manifest = createReplacementPilot02MaiVoice2Manifest({
    plan,
    audioResults,
    flashAttestation,
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
  console.error(`MAI-Voice-2 comparison failed: ${message}`)
  process.exitCode = 1
})

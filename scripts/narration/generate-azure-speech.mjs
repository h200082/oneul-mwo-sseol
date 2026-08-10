#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AZURE_SPEECH_OUTPUT_FORMAT,
  DEFAULT_MAX_PRICE_USD_PER_MILLION_CHARS,
  buildSsml,
  countBillableCharacters,
  estimateMaximumCostUsd,
  parseCliArgs,
  parseNarrationCatalog,
  readExecutionConfig,
  sanitizeAzureSpeechErrorDetail,
  selectRepresentativeNarrations,
} from './azureSpeechBatch.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..', '..')
const catalogPath = path.join(projectRoot, 'src', 'data', 'menuNarrations.ts')
const defaultOutputDirectory = path.join(
  projectRoot,
  'tmp',
  'narration-preview',
  'azure',
)
const manifestFileName = 'batch-manifest.json'

function printHelp() {
  console.log(`Azure Speech representative narration generator

Usage:
  node scripts/narration/generate-azure-speech.mjs [--dry-run]
  node scripts/narration/generate-azure-speech.mjs --execute [--output <directory>]

Safety:
  Dry-run is the default and performs no network request or file write.
  --execute requires AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, and
  AZURE_SPEECH_VOICE. Existing output files are never overwritten.`)
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
      `Refusing to overwrite existing output:\n${existingPaths.join('\n')}`,
    )
  }
}

function resolveMaximumPriceForDryRun(environment) {
  const rawValue = environment.AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS?.trim()
  if (!rawValue) return DEFAULT_MAX_PRICE_USD_PER_MILLION_CHARS

  const value = Number(rawValue)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      'AZURE_SPEECH_MAX_USD_PER_MILLION_CHARS must be a positive number',
    )
  }
  return value
}

async function synthesizeNarration({ config, narration, targetPath }) {
  const endpoint = `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/v1`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': config.key,
      'X-Microsoft-OutputFormat': AZURE_SPEECH_OUTPUT_FORMAT,
      'User-Agent': 'oneul-mwo-sseol-narration-preview',
    },
    body: buildSsml({
      text: narration.text,
      tone: narration.tone,
      voice: config.voice,
    }),
  })

  if (!response.ok) {
    let detail = ''
    try {
      detail = sanitizeAzureSpeechErrorDetail(await response.text(), [
        config.key,
        narration.text,
      ])
    } catch {
      // Preserve the HTTP status when Azure returns an unreadable error body.
    }
    throw new Error(
      'Azure Speech request failed for ' +
        narration.menuId +
        ': HTTP ' +
        response.status +
        (detail ? ': ' + detail : ''),
    )
  }

  const audio = new Uint8Array(await response.arrayBuffer())
  if (audio.byteLength === 0) {
    throw new Error(`Azure Speech returned empty audio for ${narration.menuId}`)
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
  const narrations = selectRepresentativeNarrations(
    parseNarrationCatalog(source),
  )
  const outputDirectory = path.resolve(
    options.outputDir ?? defaultOutputDirectory,
  )
  const characterCount = countBillableCharacters(narrations)
  const maximumPriceUsdPerMillion = options.execute
    ? readExecutionConfig(process.env).maximumPriceUsdPerMillion
    : resolveMaximumPriceForDryRun(process.env)
  const maximumEstimatedCostUsd = estimateMaximumCostUsd(
    characterCount,
    maximumPriceUsdPerMillion,
  )

  console.log(`Mode: ${options.execute ? 'EXECUTE' : 'DRY RUN (no network, no writes)'}`)
  console.log(`Catalog: ${catalogPath}`)
  console.log(`Output: ${outputDirectory}`)
  console.log(`Representative lines: ${narrations.length}`)
  console.log(`Spoken characters: ${characterCount}`)
  console.log(
    `Maximum estimated cost: $${maximumEstimatedCostUsd.toFixed(6)} USD ` +
      `(ceiling $${maximumPriceUsdPerMillion}/1M characters)`,
  )
  for (const narration of narrations) {
    console.log(`- ${narration.menuId} [${narration.tone}]: ${narration.text}`)
  }

  if (!options.execute) {
    const missing = [
      'AZURE_SPEECH_KEY',
      'AZURE_SPEECH_REGION',
      'AZURE_SPEECH_VOICE',
    ].filter((name) => !process.env[name]?.trim())
    if (missing.length > 0) {
      console.log(
        `Execute prerequisites not set: ${missing.join(', ')} (not required for dry-run)`,
      )
    }
    console.log('Dry-run complete. No Azure request was made.')
    return
  }

  const config = readExecutionConfig(process.env)
  const outputPaths = narrations.map((narration) =>
    path.join(outputDirectory, `${narration.menuId}.mp3`),
  )
  const manifestPath = path.join(outputDirectory, manifestFileName)
  await assertNoOutputWillBeOverwritten([...outputPaths, manifestPath])
  await mkdir(outputDirectory, { recursive: true })

  const generatedFiles = []
  for (const [index, narration] of narrations.entries()) {
    const targetPath = outputPaths[index]
    if (targetPath === undefined) {
      throw new Error(`Missing output path for ${narration.menuId}`)
    }

    const byteLength = await synthesizeNarration({
      config,
      narration,
      targetPath,
    })
    generatedFiles.push({
      menuId: narration.menuId,
      text: narration.text,
      tone: narration.tone,
      file: path.basename(targetPath),
      byteLength,
    })
    console.log(`Generated ${path.basename(targetPath)} (${byteLength} bytes)`)
  }

  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        provider: 'Azure AI Speech',
        region: config.region,
        voice: config.voice,
        outputFormat: AZURE_SPEECH_OUTPUT_FORMAT,
        spokenCharacters: characterCount,
        maximumEstimatedCostUsd,
        generatedFiles,
      },
      null,
      2,
    )}\n`,
    { encoding: 'utf8', flag: 'wx' },
  )
  console.log(`Generated ${manifestPath}`)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Narration generation failed: ${message}`)
  process.exitCode = 1
})

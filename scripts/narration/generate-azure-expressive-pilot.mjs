#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseNarrationCatalog } from './azureSpeechBatch.mjs'
import {
  AZURE_MAI_OUTPUT_FORMAT,
  EXPRESSIVE_PILOT_VOICES,
  buildExpressivePilotSsml,
  createExpressivePilotMatrix,
  parseCliArgs,
  readExpressivePilotConfig,
  readSafeAzureErrorDetail,
  selectExpressivePilotLines,
  validateExpressivePilotVoices,
} from './azureExpressivePilot.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..', '..')
const catalogPath = path.join(projectRoot, 'src', 'data', 'menuNarrations.ts')
const defaultOutputDirectory = path.join(
  projectRoot,
  'tmp',
  'narration-preview',
  'expressive-pilot',
)
const manifestFileName = 'pilot-manifest.json'

function printHelp() {
  console.log(`Azure MAI expressive narration A/B pilot

Usage:
  node scripts/narration/generate-azure-expressive-pilot.mjs [--dry-run]
  node scripts/narration/generate-azure-expressive-pilot.mjs --execute [--output <directory>]

Safety:
  Dry-run is the default and performs no network request or file write.
  --execute requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.
  It validates both MAI voices and styles before synthesis.
  Existing output files are never overwritten and requests are not retried.`)
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

function getEndpoint(config, pathName) {
  return `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/${pathName}`
}

async function fetchAvailableVoices(config) {
  const response = await fetch(getEndpoint(config, 'voices/list'), {
    headers: {
      'Ocp-Apim-Subscription-Key': config.key,
      'User-Agent': 'oneul-mwo-sseol-expressive-pilot',
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
  validateExpressivePilotVoices(payload)
}

async function synthesizePilotClip({ config, item, targetPath }) {
  const response = await fetch(getEndpoint(config, 'v1'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': config.key,
      'X-Microsoft-OutputFormat': AZURE_MAI_OUTPUT_FORMAT,
      'User-Agent': 'oneul-mwo-sseol-expressive-pilot',
    },
    body: buildExpressivePilotSsml({
      line: item.line,
      voiceShortName: item.voiceShortName,
    }),
  })
  if (!response.ok) {
    const detail = await readSafeAzureErrorDetail(response, [
      config.key,
      item.line.text,
      item.line.setupText,
      item.line.punchText,
    ])
    throw new Error(
      `Azure Speech request failed for ${item.voiceId}/${item.line.menuId}: ` +
        `HTTP ${response.status}` +
        (detail ? `: ${detail}` : ''),
    )
  }
  const audio = new Uint8Array(await response.arrayBuffer())
  if (audio.byteLength === 0) {
    throw new Error(
      `Azure Speech returned empty audio for ${item.voiceId}/${item.line.menuId}`,
    )
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
  const lines = selectExpressivePilotLines(parseNarrationCatalog(source))
  const matrix = createExpressivePilotMatrix(lines)
  const outputDirectory = path.resolve(
    options.outputDir ?? defaultOutputDirectory,
  )
  const spokenCharacters = matrix.reduce(
    (total, item) => total + Array.from(item.line.text).length,
    0,
  )

  console.log(`Mode: ${options.execute ? 'EXECUTE' : 'DRY RUN (no network, no writes)'}`)
  console.log(`Catalog: ${catalogPath}`)
  console.log(`Output: ${outputDirectory}`)
  console.log(`Pilot lines: ${lines.length}`)
  console.log(`A/B clips: ${matrix.length}`)
  console.log(`Spoken characters: ${spokenCharacters}`)
  for (const item of matrix) {
    console.log(
      `- ${item.voiceId}/${item.line.menuId} [${item.line.style}] ` +
        `${item.line.setupText} | ${item.line.breakMs}ms | ${item.line.punchText}`,
    )
  }

  if (!options.execute) {
    const missing = ['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION'].filter(
      (name) => !process.env[name]?.trim(),
    )
    if (missing.length > 0) {
      console.log(
        `Execute prerequisites not set: ${missing.join(', ')} (not required for dry-run)`,
      )
    }
    console.log('Dry-run complete. No Azure request was made.')
    return
  }

  const config = readExpressivePilotConfig(process.env)
  const outputItems = matrix.map((item) => ({
    item,
    targetPath: path.join(outputDirectory, ...item.relativeFile.split('/')),
  }))
  const manifestPath = path.join(outputDirectory, manifestFileName)
  await assertNoOutputWillBeOverwritten([
    ...outputItems.map(({ targetPath }) => targetPath),
    manifestPath,
  ])

  console.log('Checking MAI voices and required styles...')
  await fetchAvailableVoices(config)
  console.log('MAI voice preflight passed.')

  for (const voice of EXPRESSIVE_PILOT_VOICES) {
    await mkdir(path.join(outputDirectory, voice.id), { recursive: true })
  }

  const generatedFiles = []
  for (const { item, targetPath } of outputItems) {
    const byteLength = await synthesizePilotClip({
      config,
      item,
      targetPath,
    })
    generatedFiles.push({
      voiceId: item.voiceId,
      voiceShortName: item.voiceShortName,
      menuId: item.line.menuId,
      text: item.line.text,
      style: item.line.style,
      setupStyleDegree: item.line.setupStyleDegree,
      punchStyleDegree: item.line.punchStyleDegree,
      breakMs: item.line.breakMs,
      file: item.relativeFile,
      byteLength,
    })
    console.log(`Generated ${item.relativeFile} (${byteLength} bytes)`)
  }

  await writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        provider: 'Azure AI Speech',
        model: 'MAI-Voice-2-Flash',
        region: config.region,
        outputFormat: AZURE_MAI_OUTPUT_FORMAT,
        spokenCharacters,
        voices: EXPRESSIVE_PILOT_VOICES,
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
  console.error(`Expressive narration pilot failed: ${message}`)
  process.exitCode = 1
})

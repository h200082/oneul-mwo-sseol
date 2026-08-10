#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseNarrationCatalog } from './azureSpeechBatch.mjs'
import {
  AZURE_MAI_OUTPUT_FORMAT,
  parseCliArgs,
  readExpressivePilotConfig,
  readSafeAzureErrorDetail,
} from './azureExpressivePilot.mjs'
import {
  buildExpressiveRetakeSsml,
  createExpressiveRetakePlan,
  selectExpressiveRetakeVariants,
  validateExpressiveRetakeVoices,
} from './azureExpressiveRetakes.mjs'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '..', '..')
const catalogPath = path.join(projectRoot, 'src', 'data', 'menuNarrations.ts')
const defaultOutputDirectory = path.join(
  projectRoot,
  'tmp',
  'narration-preview',
  'expressive-retake-01',
)
const manifestFileName = 'retake-manifest.json'

function printHelp() {
  console.log(`Azure MAI expressive narration retakes

Usage:
  node scripts/narration/generate-azure-expressive-retakes.mjs [--dry-run]
  node scripts/narration/generate-azure-expressive-retakes.mjs --execute [--output <directory>]

Safety:
  Dry-run is the default and performs no network request or file write.
  --execute requires AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.
  Required voices and styles are validated before synthesis.
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

async function fetchAvailableVoices(config, variants) {
  const response = await fetch(getEndpoint(config, 'voices/list'), {
    headers: {
      'Ocp-Apim-Subscription-Key': config.key,
      'User-Agent': 'oneul-mwo-sseol-expressive-retakes',
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
  validateExpressiveRetakeVoices(payload, variants)
}

async function synthesizeRetake({ config, item, targetPath }) {
  const response = await fetch(getEndpoint(config, 'v1'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': config.key,
      'X-Microsoft-OutputFormat': AZURE_MAI_OUTPUT_FORMAT,
      'User-Agent': 'oneul-mwo-sseol-expressive-retakes',
    },
    body: buildExpressiveRetakeSsml({
      variant: item.variant,
      voiceShortName: item.voiceShortName,
    }),
  })
  if (!response.ok) {
    const detail = await readSafeAzureErrorDetail(response, [
      config.key,
      item.variant.text,
      item.variant.setupText,
      item.variant.punchText,
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
  const variants = selectExpressiveRetakeVariants(
    parseNarrationCatalog(source),
  )
  const plan = createExpressiveRetakePlan(variants)
  const outputDirectory = path.resolve(
    options.outputDir ?? defaultOutputDirectory,
  )
  const spokenCharacters = plan.reduce(
    (total, item) => total + Array.from(item.variant.text).length,
    0,
  )

  console.log(
    `Mode: ${options.execute ? 'EXECUTE' : 'DRY RUN (no network, no writes)'}`,
  )
  console.log(`Catalog: ${catalogPath}`)
  console.log(`Output: ${outputDirectory}`)
  console.log('Approved pilot clips preserved: 3')
  console.log(`Retake menus: ${new Set(plan.map((item) => item.variant.menuId)).size}`)
  console.log(`Retake clips: ${plan.length}`)
  console.log(`Spoken characters: ${spokenCharacters}`)
  for (const item of plan) {
    const variant = item.variant
    console.log(
      `- ${item.relativeFile} [${variant.setupStyle}->${variant.punchStyle}] ` +
        `${variant.setupText} | ${variant.breakMs}ms | ${variant.punchText}`,
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
  const outputItems = plan.map((item) => ({
    item,
    targetPath: path.join(outputDirectory, ...item.relativeFile.split('/')),
  }))
  const manifestPath = path.join(outputDirectory, manifestFileName)
  await assertNoOutputWillBeOverwritten([
    ...outputItems.map(({ targetPath }) => targetPath),
    manifestPath,
  ])

  console.log('Checking MAI voices and required styles...')
  await fetchAvailableVoices(config, variants)
  console.log('MAI voice preflight passed.')

  for (const menuId of new Set(plan.map((item) => item.variant.menuId))) {
    await mkdir(path.join(outputDirectory, menuId), { recursive: true })
  }

  const generatedFiles = []
  for (const { item, targetPath } of outputItems) {
    const byteLength = await synthesizeRetake({ config, item, targetPath })
    const variant = item.variant
    generatedFiles.push({
      menuId: variant.menuId,
      takeId: variant.takeId,
      voiceId: item.voiceId,
      voiceShortName: item.voiceShortName,
      text: variant.text,
      setupText: variant.setupText,
      punchText: variant.punchText,
      setupStyle: variant.setupStyle,
      punchStyle: variant.punchStyle,
      setupStyleDegree: variant.setupStyleDegree,
      punchStyleDegree: variant.punchStyleDegree,
      setupRate: variant.setupRate,
      setupPitch: variant.setupPitch,
      punchRate: variant.punchRate,
      punchPitch: variant.punchPitch,
      breakMs: variant.breakMs,
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
        qualityTargetSeconds: { minimum: 1.3, maximum: 2.2 },
        activePilotClipsPreserved: [
          'haena/kimchi-jjigae.mp3',
        ],
        historicalPilotClipsPreservedAtGeneration: [
          {
            file: 'junho/pasta.mp3',
            catalogTextAtGeneration:
              '이탈리아는 몰라도 돌돌은 안다!',
            currentStatus: 'retired-after-catalog-copy-change',
          },
          {
            file: 'haena/shabu-shabu.mp3',
            catalogTextAtGeneration: '고기 목욕, 삼 초 컷!',
            currentStatus: 'retired-after-catalog-copy-change',
          },
        ],
        generatedFiles,
      },
      null,
      2,
    )}\n`,
    { encoding: 'utf8', flag: 'wx' },
  )
  console.log(`Generated ${manifestPath}`)
  console.log('Listening QA target: 1.3-2.2s with a clear punch line.')
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Expressive narration retakes failed: ${message}`)
  process.exitCode = 1
})

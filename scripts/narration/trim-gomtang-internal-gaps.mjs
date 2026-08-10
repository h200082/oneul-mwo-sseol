import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { chromium } from 'playwright';

const DEFAULT_INPUT = 'tmp/narration-preview/slow-retake-batch-01/gomtang.mp3';
const DEFAULT_OUTPUT = 'tmp/narration-preview/gomtang-gap-trim-01';
const OUTPUT_FILE = 'gomtang-gap-trim-01.wav';
const MANIFEST_FILE = 'gomtang-gap-trim-01-manifest.json';
const DECODE_SAMPLE_RATE = 24_000;
const ANALYSIS_WINDOW_SECONDS = 0.01;
const ANALYSIS_HOP_SECONDS = 0.005;
const SELECTION_THRESHOLD_DBFS = -45;
const REPORTING_THRESHOLDS_DBFS = Object.freeze([-45, -40]);
const TARGET_REMAINING_GAP_SECONDS = 0.135;
const MIN_MAIN_GAP_SECONDS = 0.25;
const BOUNDARY_SEARCH_SECONDS = 0.006;
const MAX_CLICK_SAFE_JOIN_DELTA = 0.01;

function parseArgs(argv) {
  const result = { execute: false, input: DEFAULT_INPUT, output: DEFAULT_OUTPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--execute') result.execute = true;
    else if (arg === '--input') result.input = argv[++index];
    else if (arg === '--output') result.output = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!result.input || !result.output) throw new Error('--input and --output require values.');
  return result;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex').toUpperCase();
}

function float32Bytes(samples) {
  const bytes = Buffer.allocUnsafe(samples.length * 4);
  for (let index = 0; index < samples.length; index += 1) {
    bytes.writeFloatLE(samples[index], index * 4);
  }
  return bytes;
}

async function decodeMp3WithChrome(source) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    return await page.evaluate(async ({ sourceBase64, decodeSampleRate }) => {
      const binary = atob(sourceBase64);
      const encoded = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) encoded[index] = binary.charCodeAt(index);

      const context = new AudioContext({ sampleRate: decodeSampleRate });
      try {
        const decoded = await context.decodeAudioData(encoded.buffer);
        const samples = decoded.getChannelData(0);
        const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
        let raw = '';
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          raw += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
        }
        return {
          sampleRate: decoded.sampleRate,
          channels: decoded.numberOfChannels,
          sampleCount: decoded.length,
          durationSeconds: decoded.duration,
          pcmFloat32Base64: btoa(raw),
          userAgent: navigator.userAgent,
        };
      } finally {
        await context.close();
      }
    }, { sourceBase64: source.toString('base64'), decodeSampleRate: DECODE_SAMPLE_RATE });
  } finally {
    await browser.close();
  }
}

function decodeFloat32Base64(base64, expectedSampleCount) {
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length !== expectedSampleCount * 4) {
    throw new Error(`Chrome returned ${bytes.length} PCM bytes; expected ${expectedSampleCount * 4}.`);
  }
  const samples = new Float32Array(expectedSampleCount);
  for (let index = 0; index < expectedSampleCount; index += 1) {
    samples[index] = bytes.readFloatLE(index * 4);
  }
  return samples;
}

function amplitudeToDbfs(amplitude) {
  return amplitude > 0 ? 20 * Math.log10(amplitude) : Number.NEGATIVE_INFINITY;
}

function analyzeRms(samples, sampleRate, thresholdDbfs) {
  const windowSamples = Math.round(ANALYSIS_WINDOW_SECONDS * sampleRate);
  const hopSamples = Math.round(ANALYSIS_HOP_SECONDS * sampleRate);
  const windows = [];
  for (let startSample = 0; startSample + windowSamples <= samples.length; startSample += hopSamples) {
    let sumSquares = 0;
    for (let index = startSample; index < startSample + windowSamples; index += 1) {
      sumSquares += samples[index] * samples[index];
    }
    const rms = Math.sqrt(sumSquares / windowSamples);
    windows.push({
      startSample,
      endSample: startSample + windowSamples,
      dbfs: amplitudeToDbfs(rms),
      active: amplitudeToDbfs(rms) >= thresholdDbfs,
    });
  }

  const firstActiveWindow = windows.findIndex(({ active }) => active);
  let lastActiveWindow = -1;
  for (let index = windows.length - 1; index >= 0; index -= 1) {
    if (windows[index].active) {
      lastActiveWindow = index;
      break;
    }
  }

  const internalLowEnergyGaps = [];
  if (firstActiveWindow >= 0 && lastActiveWindow > firstActiveWindow) {
    let index = firstActiveWindow + 1;
    while (index < lastActiveWindow) {
      if (windows[index].active) {
        index += 1;
        continue;
      }
      const runStart = index;
      while (index < lastActiveWindow && !windows[index].active) index += 1;
      const runEnd = index - 1;
      const startSample = windows[runStart].startSample;
      const endSample = windows[runEnd].endSample;
      internalLowEnergyGaps.push({
        startSample,
        endSample,
        startSeconds: startSample / sampleRate,
        endSeconds: endSample / sampleRate,
        durationSeconds: (endSample - startSample) / sampleRate,
      });
    }
  }

  return {
    thresholdDbfs,
    windowMilliseconds: ANALYSIS_WINDOW_SECONDS * 1000,
    hopMilliseconds: ANALYSIS_HOP_SECONDS * 1000,
    firstActiveSeconds: firstActiveWindow >= 0 ? windows[firstActiveWindow].startSample / sampleRate : null,
    lastActiveSeconds: lastActiveWindow >= 0 ? windows[lastActiveWindow].endSample / sampleRate : null,
    activeSpanSeconds: firstActiveWindow >= 0 && lastActiveWindow >= 0
      ? (windows[lastActiveWindow].endSample - windows[firstActiveWindow].startSample) / sampleRate
      : 0,
    maximumInternalGapSeconds: internalLowEnergyGaps.reduce(
      (maximum, gap) => Math.max(maximum, gap.durationSeconds),
      0,
    ),
    internalLowEnergyGaps,
  };
}

function chooseClickSafeRemoval(samples, sampleRate, gap) {
  const desiredStart = gap.startSample + Math.round((TARGET_REMAINING_GAP_SECONDS / 2) * sampleRate);
  const desiredEnd = gap.endSample - Math.round((TARGET_REMAINING_GAP_SECONDS / 2) * sampleRate);
  const radius = Math.round(BOUNDARY_SEARCH_SECONDS * sampleRate);
  let best = null;

  for (let removeStartSample = desiredStart - radius; removeStartSample <= desiredStart + radius; removeStartSample += 1) {
    for (let removeEndSample = desiredEnd - radius; removeEndSample <= desiredEnd + radius; removeEndSample += 1) {
      if (
        removeStartSample <= gap.startSample
        || removeEndSample >= gap.endSample
        || removeEndSample <= removeStartSample
      ) continue;
      const left = samples[removeStartSample - 1];
      const right = samples[removeEndSample];
      const joinDelta = Math.abs(left - right);
      const durationError = Math.abs(
        ((gap.endSample - gap.startSample) - (removeEndSample - removeStartSample)) / sampleRate
          - TARGET_REMAINING_GAP_SECONDS,
      );
      const score = joinDelta * 8 + Math.abs(left) + Math.abs(right) + durationError * 0.01;
      if (!best || score < best.score) {
        best = {
          score,
          removeStartSample,
          removeEndSample,
          leftSample: left,
          rightSample: right,
          joinDelta,
          remainingGapSeconds:
            ((gap.endSample - gap.startSample) - (removeEndSample - removeStartSample)) / sampleRate,
        };
      }
    }
  }

  if (!best) throw new Error('Could not find a valid splice inside a selected low-energy gap.');
  if (best.joinDelta > MAX_CLICK_SAFE_JOIN_DELTA) {
    throw new Error(
      `Best splice discontinuity ${best.joinDelta} exceeds ${MAX_CLICK_SAFE_JOIN_DELTA}; refusing to alter retained PCM with a fade.`,
    );
  }
  return best;
}

function spliceSamples(source, removals) {
  const sorted = [...removals].sort((left, right) => left.removeStartSample - right.removeStartSample);
  const keptSegments = [];
  let sourceCursor = 0;
  let outputLength = source.length;
  for (const removal of sorted) {
    if (removal.removeStartSample < sourceCursor) throw new Error('Removal intervals overlap.');
    keptSegments.push({ startSample: sourceCursor, endSample: removal.removeStartSample });
    sourceCursor = removal.removeEndSample;
    outputLength -= removal.removeEndSample - removal.removeStartSample;
  }
  keptSegments.push({ startSample: sourceCursor, endSample: source.length });

  const output = new Float32Array(outputLength);
  let outputCursor = 0;
  const mappedSegments = keptSegments.map((segment) => {
    const slice = source.subarray(segment.startSample, segment.endSample);
    output.set(slice, outputCursor);
    const mapped = {
      sourceStartSample: segment.startSample,
      sourceEndSample: segment.endSample,
      outputStartSample: outputCursor,
      outputEndSample: outputCursor + slice.length,
    };
    outputCursor += slice.length;
    return mapped;
  });
  if (outputCursor !== output.length) throw new Error('Internal splice length mismatch.');

  for (const segment of mappedSegments) {
    for (let index = 0; index < segment.sourceEndSample - segment.sourceStartSample; index += 1) {
      if (source[segment.sourceStartSample + index] !== output[segment.outputStartSample + index]) {
        throw new Error('Retained PCM sample changed during splice.');
      }
    }
  }
  return { output, keptSegments: mappedSegments };
}

function encodeFloat32Wav(samples, sampleRate) {
  const bytesPerSample = 4;
  const dataBytes = samples.length * bytesPerSample;
  const wav = Buffer.allocUnsafe(44 + dataBytes);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write('WAVE', 8, 'ascii');
  wav.write('fmt ', 12, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(3, 20); // WAVE_FORMAT_IEEE_FLOAT
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * bytesPerSample, 28);
  wav.writeUInt16LE(bytesPerSample, 32);
  wav.writeUInt16LE(32, 34);
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(dataBytes, 40);
  for (let index = 0; index < samples.length; index += 1) wav.writeFloatLE(samples[index], 44 + index * 4);
  return wav;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(options.input);
  const outputDirectory = path.resolve(options.output);
  const outputPath = path.join(outputDirectory, OUTPUT_FILE);
  const manifestPath = path.join(outputDirectory, MANIFEST_FILE);
  const source = await readFile(inputPath);
  const decoded = await decodeMp3WithChrome(source);
  if (decoded.channels !== 1) throw new Error(`Expected mono input; Chrome decoded ${decoded.channels} channels.`);
  const sourceSamples = decodeFloat32Base64(decoded.pcmFloat32Base64, decoded.sampleCount);
  const sourceAnalyses = REPORTING_THRESHOLDS_DBFS.map((threshold) =>
    analyzeRms(sourceSamples, decoded.sampleRate, threshold));
  const selectionAnalysis = sourceAnalyses.find(({ thresholdDbfs }) => thresholdDbfs === SELECTION_THRESHOLD_DBFS);
  const selectedGaps = selectionAnalysis.internalLowEnergyGaps
    .filter(({ durationSeconds }) => durationSeconds >= MIN_MAIN_GAP_SECONDS)
    .sort((left, right) => right.durationSeconds - left.durationSeconds)
    .slice(0, 2)
    .sort((left, right) => left.startSample - right.startSample);
  if (selectedGaps.length !== 2) {
    throw new Error(`Expected two main internal gaps; found ${selectedGaps.length}.`);
  }

  const removals = selectedGaps.map((gap, index) => ({
    id: index === 0 ? 'gap-1' : 'gap-2',
    detectedGap: gap,
    ...chooseClickSafeRemoval(sourceSamples, decoded.sampleRate, gap),
  }));
  const { output: outputSamples, keptSegments } = spliceSamples(sourceSamples, removals);
  const wav = encodeFloat32Wav(outputSamples, decoded.sampleRate);
  const outputAnalyses = REPORTING_THRESHOLDS_DBFS.map((threshold) =>
    analyzeRms(outputSamples, decoded.sampleRate, threshold));
  const sourcePcmBytes = float32Bytes(sourceSamples);
  const outputPcmBytes = float32Bytes(outputSamples);
  const totalRemovedSamples = sourceSamples.length - outputSamples.length;

  const verifiedKeptSegments = keptSegments.map((segment) => {
    const sourceSegmentBytes = float32Bytes(
      sourceSamples.subarray(segment.sourceStartSample, segment.sourceEndSample),
    );
    const outputSegmentBytes = float32Bytes(
      outputSamples.subarray(segment.outputStartSample, segment.outputEndSample),
    );
    return {
      ...segment,
      sourcePcmSha256: sha256(sourceSegmentBytes),
      outputPcmSha256: sha256(outputSegmentBytes),
      bitExact: sourceSegmentBytes.equals(outputSegmentBytes),
    };
  });

  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    userFeedback: '곰탕도 발화부분은 괜찮은 거 같아',
    source: {
      path: path.relative(process.cwd(), inputPath).replaceAll('\\', '/'),
      bytes: source.length,
      sha256: sha256(source),
      immutable: true,
      decodedPcm: {
        format: 'IEEE 754 Float32 little-endian, mono',
        sampleRate: decoded.sampleRate,
        channels: decoded.channels,
        sampleCount: sourceSamples.length,
        durationSeconds: sourceSamples.length / decoded.sampleRate,
        sha256: sha256(sourcePcmBytes),
      },
    },
    tool: {
      runtime: process.version,
      script: 'scripts/narration/trim-gomtang-internal-gaps.mjs',
      decoder: 'Chrome Web Audio API AudioContext.decodeAudioData via Playwright channel chrome',
      requestedDecodeSampleRate: DECODE_SAMPLE_RATE,
      browserUserAgent: decoded.userAgent,
      networkOrAzureRequests: 0,
      method: 'Decode once to Float32 PCM, remove only the centers of two energy-gated internal gaps, concatenate retained PCM bit-exactly, then write an IEEE Float32 WAV without resampling.',
    },
    selection: {
      rmsWindowMilliseconds: ANALYSIS_WINDOW_SECONDS * 1000,
      rmsHopMilliseconds: ANALYSIS_HOP_SECONDS * 1000,
      thresholdDbfs: SELECTION_THRESHOLD_DBFS,
      minimumMainGapMilliseconds: MIN_MAIN_GAP_SECONDS * 1000,
      targetRemainingGapMilliseconds: TARGET_REMAINING_GAP_SECONDS * 1000,
      boundarySearchMilliseconds: BOUNDARY_SEARCH_SECONDS * 1000,
      selectedBy: 'two longest internal low-energy runs above the minimum duration, then chronological order',
    },
    edits: removals.map((removal) => ({
      id: removal.id,
      detectedLowEnergyInterval: {
        startSample: removal.detectedGap.startSample,
        endSample: removal.detectedGap.endSample,
        startSeconds: removal.detectedGap.startSeconds,
        endSeconds: removal.detectedGap.endSeconds,
        durationSeconds: removal.detectedGap.durationSeconds,
      },
      removedInterval: {
        startSample: removal.removeStartSample,
        endSample: removal.removeEndSample,
        startSeconds: removal.removeStartSample / decoded.sampleRate,
        endSeconds: removal.removeEndSample / decoded.sampleRate,
        durationSeconds: (removal.removeEndSample - removal.removeStartSample) / decoded.sampleRate,
      },
      resultingDetectedGapSeconds: removal.remainingGapSeconds,
      splice: {
        leftSample: removal.leftSample,
        rightSample: removal.rightSample,
        absoluteJoinDelta: removal.joinDelta,
        maximumAllowedJoinDelta: MAX_CLICK_SAFE_JOIN_DELTA,
        fadesApplied: false,
        note: 'No fade was necessary: splice endpoints were selected inside low-energy audio to minimize the sample discontinuity.',
      },
    })),
    preservation: {
      retainedPcmBitExact: true,
      activeSpeechSamplesModified: false,
      resampled: false,
      normalized: false,
      faded: false,
      headAndTailPreserved: true,
      keptSourceSegments: verifiedKeptSegments,
      limitation: 'The removed intervals are selected by short-window RMS, not word timestamps or forced alignment. They are acoustically low-energy gaps and are not asserted to be linguistic word boundaries.',
    },
    analysis: {
      source: sourceAnalyses,
      output: outputAnalyses,
    },
    output: {
      path: path.relative(process.cwd(), outputPath).replaceAll('\\', '/'),
      container: 'RIFF/WAVE',
      encoding: 'IEEE Float32 PCM',
      bitsPerSample: 32,
      sampleRate: decoded.sampleRate,
      channels: 1,
      sampleCount: outputSamples.length,
      durationSeconds: outputSamples.length / decoded.sampleRate,
      bytes: wav.length,
      sha256: sha256(wav),
      pcmSha256: sha256(outputPcmBytes),
      totalRemovedSamples,
      totalRemovedSeconds: totalRemovedSamples / decoded.sampleRate,
      runtimeIntegrated: false,
    },
  };

  console.log(JSON.stringify(manifest, null, 2));
  if (!options.execute) {
    console.log('Dry run only. Pass --execute to create the WAV candidate and manifest.');
    return;
  }

  await mkdir(outputDirectory, { recursive: false });
  await writeFile(outputPath, wav, { flag: 'wx' });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
}

main().catch((error) => {
  console.error(`Gomtang gap trim failed: ${error.message}`);
  process.exitCode = 1;
});

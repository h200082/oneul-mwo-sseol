import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_INPUT = 'tmp/narration-preview/full-batch-02/cheonggukjang.mp3';
const DEFAULT_OUTPUT = 'tmp/narration-preview/cheonggukjang-punch-adjust-01';
const INTERVAL = Object.freeze({ startSeconds: 1.7725, endSeconds: 2.4175 });
const RAMP_SECONDS = 0.024;
const GLOBAL_GAIN_STEP_DB = 1.5;
const VARIANTS = Object.freeze([
  Object.freeze({ id: 'A', requestedDb: -3, fileName: 'cheonggukjang-terminal-minus-3db.mp3' }),
  Object.freeze({ id: 'B', requestedDb: -5, fileName: 'cheonggukjang-terminal-minus-5db.mp3' }),
]);

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

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex').toUpperCase();
}

function readBits(buffer, baseOffset, bitOffset, bitCount) {
  let value = 0;
  for (let index = 0; index < bitCount; index += 1) {
    const absoluteBit = bitOffset + index;
    const byte = buffer[baseOffset + Math.floor(absoluteBit / 8)];
    value = (value << 1) | ((byte >> (7 - (absoluteBit % 8))) & 1);
  }
  return value;
}

function writeBits(buffer, baseOffset, bitOffset, bitCount, value) {
  for (let index = 0; index < bitCount; index += 1) {
    const absoluteBit = bitOffset + index;
    const byteOffset = baseOffset + Math.floor(absoluteBit / 8);
    const mask = 1 << (7 - (absoluteBit % 8));
    const sourceBit = (value >> (bitCount - index - 1)) & 1;
    buffer[byteOffset] = sourceBit ? buffer[byteOffset] | mask : buffer[byteOffset] & ~mask;
  }
}

function id3v2Length(buffer) {
  if (buffer.subarray(0, 3).toString('ascii') !== 'ID3') return 0;
  const size = ((buffer[6] & 0x7f) << 21)
    | ((buffer[7] & 0x7f) << 14)
    | ((buffer[8] & 0x7f) << 7)
    | (buffer[9] & 0x7f);
  return 10 + size + ((buffer[5] & 0x10) ? 10 : 0);
}

function parseFrames(buffer) {
  const mpeg2Layer3Bitrates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
  const mpeg2SampleRates = [22050, 24000, 16000];
  const frames = [];
  let offset = id3v2Length(buffer);

  while (offset < buffer.length) {
    if (offset + 4 > buffer.length) throw new Error(`Truncated MP3 header at byte ${offset}.`);
    const b0 = buffer[offset];
    const b1 = buffer[offset + 1];
    const b2 = buffer[offset + 2];
    const b3 = buffer[offset + 3];
    if (b0 !== 0xff || (b1 & 0xe0) !== 0xe0) throw new Error(`Missing MP3 sync at byte ${offset}.`);

    const versionBits = (b1 >> 3) & 0x03;
    const layerBits = (b1 >> 1) & 0x03;
    const hasCrc = (b1 & 0x01) === 0;
    const bitrateKbps = mpeg2Layer3Bitrates[b2 >> 4];
    const sampleRate = mpeg2SampleRates[(b2 >> 2) & 0x03];
    const padding = (b2 >> 1) & 0x01;
    const channelMode = b3 >> 6;
    if (versionBits !== 0x02 || layerBits !== 0x01 || channelMode !== 0x03) {
      throw new Error('Input must be MPEG-2 Layer III mono.');
    }
    if (!bitrateKbps || !sampleRate) throw new Error(`Unsupported MP3 header at byte ${offset}.`);

    const length = Math.floor((72000 * bitrateKbps) / sampleRate) + padding;
    if (offset + length > buffer.length) throw new Error(`Truncated MP3 frame at byte ${offset}.`);
    const sideInfoOffset = offset + 4 + (hasCrc ? 2 : 0);
    const globalGainBitOffset = 30;
    const globalGain = readBits(buffer, sideInfoOffset, globalGainBitOffset, 8);
    frames.push({
      index: frames.length,
      offset,
      length,
      bitrateKbps,
      sampleRate,
      channels: 1,
      samples: 576,
      startSeconds: frames.length * (576 / sampleRate),
      endSeconds: (frames.length + 1) * (576 / sampleRate),
      sideInfoOffset,
      globalGainBitOffset,
      globalGain,
    });
    offset += length;
  }

  if (!frames.length) throw new Error('No MP3 frames found.');
  return frames;
}

function envelopeAt(seconds) {
  if (seconds <= INTERVAL.startSeconds || seconds >= INTERVAL.endSeconds) return 0;
  if (seconds < INTERVAL.startSeconds + RAMP_SECONDS) {
    return (seconds - INTERVAL.startSeconds) / RAMP_SECONDS;
  }
  if (seconds > INTERVAL.endSeconds - RAMP_SECONDS) {
    return (INTERVAL.endSeconds - seconds) / RAMP_SECONDS;
  }
  return 1;
}

function averageEnvelope(frameStart, frameEnd) {
  const breakpoints = [
    frameStart,
    frameEnd,
    INTERVAL.startSeconds,
    INTERVAL.startSeconds + RAMP_SECONDS,
    INTERVAL.endSeconds - RAMP_SECONDS,
    INTERVAL.endSeconds,
  ].filter((value) => value >= frameStart && value <= frameEnd).sort((left, right) => left - right);
  const unique = [...new Set(breakpoints)];
  let integral = 0;
  for (let index = 0; index < unique.length - 1; index += 1) {
    const left = unique[index];
    const right = unique[index + 1];
    integral += envelopeAt((left + right) / 2) * (right - left);
  }
  return integral / (frameEnd - frameStart);
}

function renderVariant(source, frames, variant) {
  const output = Buffer.from(source);
  const changedFrames = [];
  const targetReductionDb = Math.abs(variant.requestedDb);
  for (const frame of frames) {
    const envelope = averageEnvelope(frame.startSeconds, frame.endSeconds);
    const requestedReductionDb = targetReductionDb * envelope;
    const gainSteps = Math.round(requestedReductionDb / GLOBAL_GAIN_STEP_DB);
    if (gainSteps === 0) continue;
    const nextGlobalGain = frame.globalGain - gainSteps;
    if (nextGlobalGain < 0) throw new Error(`global_gain underflow in frame ${frame.index}.`);
    writeBits(output, frame.sideInfoOffset, frame.globalGainBitOffset, 8, nextGlobalGain);
    changedFrames.push({
      index: frame.index,
      startSeconds: frame.startSeconds,
      endSeconds: frame.endSeconds,
      originalGlobalGain: frame.globalGain,
      adjustedGlobalGain: nextGlobalGain,
      requestedReductionDb,
      appliedReductionDb: gainSteps * GLOBAL_GAIN_STEP_DB,
    });
  }
  return { output, changedFrames };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(options.input);
  const outputPath = path.resolve(options.output);
  const source = await readFile(inputPath);
  const frames = parseFrames(source);
  const first = frames[0];
  const durationSeconds = frames.reduce((sum, frame) => sum + frame.samples / frame.sampleRate, 0);
  const rendered = VARIANTS.map((variant) => ({ variant, ...renderVariant(source, frames, variant) }));
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      path: path.relative(process.cwd(), inputPath).replaceAll('\\', '/'),
      bytes: source.length,
      sha256: sha256(source),
      frameCount: frames.length,
      durationSeconds,
      format: `MPEG-2 Layer III, ${first.bitrateKbps} kbps, ${first.sampleRate} Hz, mono`,
    },
    tool: {
      runtime: process.version,
      script: 'scripts/narration/adjust-cheonggukjang-terminal-punch.mjs',
      ffmpegAvailability: 'not found on PATH, Codex bundled dependencies, Python packages, or installed-app search',
      method: 'lossless MPEG-2 Layer III side-info global_gain edit; audio frames are not decoded or re-encoded',
      globalGainStepDb: GLOBAL_GAIN_STEP_DB,
    },
    filter: {
      intervalSeconds: INTERVAL,
      rampSeconds: RAMP_SECONDS,
      shape: 'linear fade-in, constant attenuation, linear fade-out',
      selectionBasis: 'approximate terminal acoustic interval supplied for review',
      wordAlignmentLimitation: 'No word timestamps or forced alignment are available; this interval cannot be attributed to a specific word.',
    },
    variants: rendered.map(({ variant, output, changedFrames }) => ({
      id: variant.id,
      requestedSteadyAttenuationDb: variant.requestedDb,
      appliedSteadyAttenuationDb: variant.requestedDb === -5 ? -4.5 : variant.requestedDb,
      quantizationNote: variant.requestedDb === -5
        ? 'MPEG Layer III global_gain is quantized in 1.5 dB steps; -5 dB is represented by the nearest lossless value, -4.5 dB.'
        : null,
      outputPath: path.relative(process.cwd(), path.join(outputPath, variant.fileName)).replaceAll('\\', '/'),
      bytes: output.length,
      sha256: sha256(output),
      frameCount: frames.length,
      durationSeconds,
      changedFrames,
    })),
  };

  console.log(JSON.stringify(manifest, null, 2));
  if (!options.execute) {
    console.log('Dry run only. Pass --execute to write the two candidates and manifest.');
    return;
  }

  await mkdir(outputPath, { recursive: false });
  for (const { variant, output } of rendered) {
    await writeFile(path.join(outputPath, variant.fileName), output, { flag: 'wx' });
  }
  await writeFile(
    path.join(outputPath, 'cheonggukjang-punch-adjust-01-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: 'wx' },
  );
}

main().catch((error) => {
  console.error(`Cheonggukjang punch adjustment failed: ${error.message}`);
  process.exitCode = 1;
});

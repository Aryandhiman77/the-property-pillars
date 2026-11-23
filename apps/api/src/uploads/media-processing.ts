import {execFile} from 'node:child_process';
import {open, readFile, stat, writeFile} from 'node:fs/promises';
import {promisify} from 'node:util';
import type {Request} from 'express';
import sharp from 'sharp';
import {env} from '../config/env.js';
import {ApiError} from '../utils/api-error.js';

const exec = promisify(execFile);
const megabyte = 1024 * 1024;
export const mediaLimits = {
  image: {inputMB: env.MEDIA_IMAGE_INPUT_MAX_MB, savedMB: env.MEDIA_IMAGE_MAX_MB},
  video: {inputMB: env.MEDIA_VIDEO_INPUT_MAX_MB, savedMB: env.MEDIA_VIDEO_MAX_MB},
};
export type MediaKind = keyof typeof mediaLimits;

export async function writeUpload(request: Request, destination: string, kind: MediaKind) {
  const limit = Math.floor(mediaLimits[kind].inputMB * megabyte);
  const tooLarge = () => new ApiError(413, 'MEDIA_INPUT_TOO_LARGE', `Choose a ${kind} up to ${mediaLimits[kind].inputMB} MB for compression.`);
  if (Number(request.get('Content-Length')) > limit) throw tooLarge();
  const file = await open(destination, 'wx');
  let received = 0;
  try {
    for await (const chunk of request.iterator({destroyOnReturn: false})) {
      received += chunk.length;
      if (received > limit) {request.resume(); throw tooLarge();}
      await file.writeFile(chunk);
    }
  } finally {await file.close();}
  if (!received) throw new ApiError(422, 'EMPTY_MEDIA', 'Choose a file containing media.');
}

export async function processImage(input: string, output: string) {
  const limit = mediaLimits.image.savedMB * megabyte;
  try {
    const source = sharp(await readFile(input), {limitInputPixels: 60_000_000, failOn: 'warning'});
    const {format} = await source.metadata();
    if (format !== 'jpeg' && format !== 'png' && format !== 'webp') throw new Error('Unsupported image format');
    for (const [size, quality] of [[2400, 85], [1800, 75], [1280, 68], [960, 60], [640, 50]]) {
      const image = await source.clone().rotate().resize({width: size, height: size, fit: 'inside', withoutEnlargement: true}).webp({quality}).toBuffer();
      if (image.length <= limit) {await writeFile(output, image, {flag: 'wx'}); return;}
    }
  } catch {
    throw new ApiError(422, 'INVALID_IMAGE', 'This image could not be saved. Choose a valid JPEG, PNG, or WebP image.');
  }
  throw new ApiError(422, 'MEDIA_COMPRESSION_LIMIT', `This image could not be compressed to ${mediaLimits.image.savedMB} MB.`);
}

let activeVideos = 0;
export function reserveVideo() {
  if (activeVideos >= 1) throw new ApiError(503, 'VIDEO_PROCESSOR_BUSY', 'Another video is processing. Try again shortly.');
  activeVideos++;
  return () => {activeVideos--;};
}

export async function processVideo(input: string, output: string, signal: AbortSignal) {
  const limit = mediaLimits.video.savedMB * megabyte;
  try {
    const {stdout} = await exec(env.FFPROBE_PATH ?? 'ffprobe', ['-v', 'error', '-protocol_whitelist', 'file', '-show_entries', 'format=duration,format_name:stream=codec_type', '-of', 'json', input], {timeout: 10000, signal});
    const info = JSON.parse(stdout) as {format?: {duration?: string; format_name?: string}; streams?: {codec_type?: string}[]};
    const duration = Number(info.format?.duration);
    if (!info.format?.format_name?.split(',').some((format) => ['mov', 'mp4', 'matroska', 'webm'].includes(format)) ||
      !info.streams?.some(({codec_type}) => codec_type === 'video') || !Number.isFinite(duration) || duration <= 0) {
      throw new ApiError(422, 'INVALID_VIDEO', 'Choose a valid MP4, MOV, or WebM video.');
    }
    for (const [margin, width] of [[0.9, 1280], [0.65, 854]]) {
      const budget = Math.floor((limit * 8 * margin) / duration / 1000);
      if (budget < 100) break;
      const audio = Math.min(96, Math.floor(budget / 4));
      const bitrate = Math.min(3000, budget - audio);
      await exec(env.FFMPEG_PATH ?? 'ffmpeg', ['-v', 'error', '-nostdin', '-protocol_whitelist', 'file', '-i', input,
        '-map', '0:v:0', '-map', '0:a:0?', '-map_metadata', '-1', '-vf', `scale=min(${width}\\,iw):-2`, '-c:v', 'libx264',
        '-threads', '2', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-b:v', `${bitrate}k`, '-maxrate', `${bitrate}k`,
        '-bufsize', `${bitrate * 2}k`, '-c:a', 'aac', '-b:a', `${audio}k`, '-movflags', '+faststart', '-y', output],
      {timeout: 100000, signal});
      if ((await stat(output)).size <= limit) return;
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new ApiError(503, 'VIDEO_PROCESSOR_UNAVAILABLE', 'Video processing is temporarily unavailable.');
    }
    throw new ApiError(422, 'VIDEO_PROCESSING_FAILED', 'This video could not be processed. Choose a shorter or different video.');
  }
  throw new ApiError(422, 'MEDIA_COMPRESSION_LIMIT', `This video could not be compressed to ${mediaLimits.video.savedMB} MB. Choose a shorter video.`);
}

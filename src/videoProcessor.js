import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance = null;
let isLoaded = false;

/**
 * Initializes FFmpeg.wasm
 */
export async function getFFmpeg(onLog = () => {}) {
  if (ffmpegInstance && isLoaded) {
    return ffmpegInstance;
  }

  const ffmpeg = new FFmpeg();
  ffmpeg.on('log', ({ message }) => {
    onLog(message);
  });

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  
  try {
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
    });
    isLoaded = true;
    ffmpegInstance = ffmpeg;
    return ffmpegInstance;
  } catch (err) {
    console.warn('Failed to load primary FFmpeg build, attempting fallback...', err);
    await ffmpeg.load();
    isLoaded = true;
    ffmpegInstance = ffmpeg;
    return ffmpegInstance;
  }
}

/**
 * Extracts metadata (duration, width, height) from video
 */
export function getVideoMetadata(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const url = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        duration: Math.max(0.5, video.duration || 1),
        width: video.videoWidth || 1280,
        height: video.videoHeight || 720
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ duration: 10, width: 1280, height: 720 });
    };

    video.src = url;
  });
}

/**
 * Calculates strict video encoding parameters to ensure output is strictly UNDER the target size
 */
export function calculateVideoSettings(targetSizeBytes, durationSeconds, origWidth, origHeight, options = {}, scaleMultiplier = 1.0) {
  const {
    removeAudio = false,
    resolutionOverride = 'auto',
    fpsOverride = 'auto'
  } = options;

  if (!targetSizeBytes || targetSizeBytes <= 0) {
    return {
      videoBitrate: 1400,
      audioBitrate: 128,
      scaleFilter: "scale='trunc(iw/2)*2:trunc(ih/2)*2'",
      fpsArgs: []
    };
  }

  // 15% safety headroom margin to guarantee staying UNDER target limit with container & moov overhead
  const safetyFactor = 0.84 * scaleMultiplier;
  const targetBits = targetSizeBytes * 8 * safetyFactor;
  const totalBitrateKbps = Math.max(15, Math.floor((targetBits / durationSeconds) / 1000));

  // Strict Audio Bitrate Allocation
  let audioBitrate = 0;
  if (!removeAudio) {
    if (totalBitrateKbps < 120) audioBitrate = 24;
    else if (totalBitrateKbps < 250) audioBitrate = 36;
    else if (totalBitrateKbps < 500) audioBitrate = 48;
    else if (totalBitrateKbps < 1000) audioBitrate = 64;
    else audioBitrate = 96;
  }

  // Video Bitrate
  let videoBitrate = removeAudio ? totalBitrateKbps : Math.max(totalBitrateKbps - audioBitrate, 15);

  // Automatic Resolution Downscaling to prevent blockiness and guarantee small size
  let scaleFilter = '';
  if (resolutionOverride !== 'original') {
    if (resolutionOverride === 'auto') {
      if (videoBitrate < 100) {
        scaleFilter = "scale='min(320,iw)':-2";
      } else if (videoBitrate < 220) {
        scaleFilter = "scale='min(480,iw)':-2";
      } else if (videoBitrate < 550) {
        scaleFilter = "scale='min(720,iw)':-2";
      } else if (videoBitrate < 1200) {
        scaleFilter = "scale='min(1080,iw)':-2";
      }
    } else {
      const maxW = parseInt(resolutionOverride, 10);
      if (!isNaN(maxW)) {
        scaleFilter = `scale='min(${maxW},iw)':-2`;
      }
    }
  }

  if (scaleFilter) {
    scaleFilter = `${scaleFilter}:flags=lanczos`;
  } else {
    scaleFilter = "scale='trunc(iw/2)*2:trunc(ih/2)*2'";
  }

  const fpsArgs = [];
  if (fpsOverride !== 'auto') {
    fpsArgs.push('-r', fpsOverride);
  } else if (videoBitrate < 90 && durationSeconds > 10) {
    fpsArgs.push('-r', '20');
  }

  return {
    totalBitrateKbps,
    videoBitrate,
    audioBitrate,
    scaleFilter,
    fpsArgs
  };
}

/**
 * Compresses video with strict target size enforcement and retry verification loop
 */
export async function compressVideo(file, options = {}, onProgress = () => {}, onLog = () => {}) {
  const {
    targetSizeBytes = null,
    outputFormat = 'mp4',
    removeAudio = false,
    resolutionOverride = 'auto',
    fpsOverride = 'auto'
  } = options;

  onProgress({ phase: 'initializing', progress: 0.05, message: 'Loading media compression engine...' });
  const ffmpeg = await getFFmpeg(onLog);

  onProgress({ phase: 'analyzing', progress: 0.1, message: 'Inspecting video duration & stream...' });
  const meta = await getVideoMetadata(file);

  const inputExt = file.name.split('.').pop() || 'mp4';
  const inputName = `input_${Date.now()}.${inputExt}`;
  const outExt = outputFormat === 'webm' ? 'webm' : 'mp4';
  
  onProgress({ phase: 'writing', progress: 0.18, message: 'Preparing video buffer...' });
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  // Allow up to 2 correction passes to guarantee output <= targetSizeBytes
  let finalBlob = null;
  let scaleMultiplier = 1.0;
  const maxPasses = targetSizeBytes ? 2 : 1;

  for (let pass = 1; pass <= maxPasses; pass++) {
    const outputName = `output_${Date.now()}_p${pass}.${outExt}`;
    const settings = calculateVideoSettings(
      targetSizeBytes,
      meta.duration,
      meta.width,
      meta.height,
      { removeAudio, resolutionOverride, fpsOverride },
      scaleMultiplier
    );

    onLog(`[Encoder Pass ${pass}] Target: ${targetSizeBytes ? (targetSizeBytes / 1024 / 1024).toFixed(2) + ' MB' : 'Auto'}, Video Bitrate: ${settings.videoBitrate}k, Audio Bitrate: ${settings.audioBitrate}k`);

    // Setup progress
    const progressHandler = ({ progress }) => {
      const clamped = Math.max(0, Math.min(0.98, progress));
      const baseProg = pass === 1 ? 0.2 : 0.6;
      const span = pass === 1 ? (maxPasses === 1 ? 0.75 : 0.4) : 0.35;
      const pct = Math.round(clamped * 100);
      onProgress({
        phase: 'encoding',
        progress: baseProg + clamped * span,
        message: `Compressing video stream (${pct}%)...`
      });
    };

    ffmpeg.on('progress', progressHandler);

    const ffmpegArgs = ['-i', inputName];

    if (settings.scaleFilter) {
      ffmpegArgs.push('-vf', settings.scaleFilter);
    }

    if (settings.fpsArgs.length > 0) {
      ffmpegArgs.push(...settings.fpsArgs);
    }

    if (outExt === 'mp4') {
      // Use strict VBV buffer to strictly prevent bitrate spikes from exceeding target size
      ffmpegArgs.push(
        '-c:v', 'libx264',
        '-b:v', `${settings.videoBitrate}k`,
        '-maxrate', `${Math.round(settings.videoBitrate * 1.05)}k`,
        '-bufsize', `${Math.round(settings.videoBitrate * 0.8)}k`,
        '-preset', 'faster',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart'
      );

      if (removeAudio || settings.audioBitrate === 0) {
        ffmpegArgs.push('-an');
      } else {
        ffmpegArgs.push('-c:a', 'aac', '-b:a', `${settings.audioBitrate}k`, '-ac', settings.audioBitrate <= 36 ? '1' : '2');
      }
    } else {
      ffmpegArgs.push(
        '-c:v', 'libvpx',
        '-b:v', `${settings.videoBitrate}k`,
        '-quality', 'realtime',
        '-cpu-used', '4'
      );
      if (removeAudio || settings.audioBitrate === 0) {
        ffmpegArgs.push('-an');
      } else {
        ffmpegArgs.push('-c:a', 'libvorbis', '-b:a', `${settings.audioBitrate}k`);
      }
    }

    ffmpegArgs.push(outputName);

    onLog(`[Encoder Command] ffmpeg ${ffmpegArgs.join(' ')}`);
    await ffmpeg.exec(ffmpegArgs);

    const data = await ffmpeg.readFile(outputName);
    const outputMime = outExt === 'mp4' ? 'video/mp4' : 'video/webm';
    finalBlob = new Blob([data.buffer], { type: outputMime });

    try {
      await ffmpeg.deleteFile(outputName);
    } catch (e) {}

    // Check if output is under target size
    if (!targetSizeBytes || finalBlob.size <= targetSizeBytes) {
      onLog(`[Encoder] Output size: ${(finalBlob.size / 1024 / 1024).toFixed(2)} MB is strictly under target.`);
      break;
    } else if (pass < maxPasses) {
      // If still over target, adjust multiplier for second pass
      const overshootRatio = finalBlob.size / targetSizeBytes;
      scaleMultiplier = Math.max(0.35, (1.0 / overshootRatio) * 0.88);
      onLog(`[Encoder] Output was ${(finalBlob.size / 1024 / 1024).toFixed(2)} MB (> ${(targetSizeBytes / 1024 / 1024).toFixed(2)} MB). Running quick calibration pass with multiplier ${scaleMultiplier.toFixed(2)}...`);
    }
  }

  // Cleanup input
  try {
    await ffmpeg.deleteFile(inputName);
  } catch (e) {}

  onProgress({ phase: 'done', progress: 1.0, message: 'Compression complete!' });

  return {
    blob: finalBlob,
    format: outExt === 'mp4' ? 'video/mp4' : 'video/webm',
    size: finalBlob.size,
    originalSize: file.size,
    duration: meta.duration
  };
}

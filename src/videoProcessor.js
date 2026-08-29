import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance = null;
let isLoaded = false;

/**
 * Loads and initializes FFmpeg.wasm with single/multi-thread fallback
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
    // Fallback load
    await ffmpeg.load();
    isLoaded = true;
    ffmpegInstance = ffmpeg;
    return ffmpegInstance;
  }
}

/**
 * Extracts metadata (duration, width, height) from video file
 */
export function getVideoMetadata(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    const url = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        duration: video.duration || 1,
        width: video.videoWidth || 1280,
        height: video.videoHeight || 720
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      // Fallback defaults if browser can't decode container directly
      resolve({ duration: 10, width: 1280, height: 720 });
    };

    video.src = url;
  });
}

/**
 * Calculates video encoding parameters based on target size and constraints
 */
export function calculateVideoSettings(targetSizeBytes, durationSeconds, origWidth, origHeight, options = {}) {
  const {
    removeAudio = false,
    resolutionOverride = 'auto', // 'auto', '1080', '720', '480', '360', '240', 'original'
    fpsOverride = 'auto'          // 'auto', '30', '24', '15'
  } = options;

  if (!targetSizeBytes || targetSizeBytes <= 0) {
    // Quality-based default if no target size
    return {
      videoBitrate: 1500,
      audioBitrate: 128,
      scaleFilter: '',
      fpsArgs: []
    };
  }

  // 7% safety margin for MP4 header overhead & bitrate fluctuations
  const safetyFactor = 0.93;
  const targetBits = targetSizeBytes * 8 * safetyFactor;
  const totalBitrateKbps = Math.max(20, Math.floor((targetBits / durationSeconds) / 1000));

  // Determine Audio Bitrate
  let audioBitrate = 0;
  if (!removeAudio) {
    if (totalBitrateKbps < 150) audioBitrate = 32;
    else if (totalBitrateKbps < 300) audioBitrate = 48;
    else if (totalBitrateKbps < 600) audioBitrate = 64;
    else if (totalBitrateKbps < 1200) audioBitrate = 96;
    else audioBitrate = 128;
  }

  // Determine Video Bitrate
  let videoBitrate = removeAudio ? totalBitrateKbps : Math.max(totalBitrateKbps - audioBitrate, 25);

  // Determine Resolution / Scaling
  let scaleFilter = '';
  if (resolutionOverride !== 'original') {
    if (resolutionOverride === 'auto') {
      // Smart adaptive scaling for low-bitrate targets (< 8MB, < 2MB, < 500KB)
      if (videoBitrate < 120) {
        scaleFilter = "scale='min(360,iw)':-2";
      } else if (videoBitrate < 260) {
        scaleFilter = "scale='min(480,iw)':-2";
      } else if (videoBitrate < 650) {
        scaleFilter = "scale='min(720,iw)':-2";
      } else if (videoBitrate < 1400) {
        scaleFilter = "scale='min(1080,iw)':-2";
      }
    } else {
      const maxW = parseInt(resolutionOverride, 10);
      if (!isNaN(maxW)) {
        scaleFilter = `scale='min(${maxW},iw)':-2`;
      }
    }
  }

  // Ensure dimensions are even numbers (required by H.264 yuv420p)
  if (scaleFilter) {
    scaleFilter = `${scaleFilter}:flags=lanczos`;
  } else {
    scaleFilter = "scale='trunc(iw/2)*2:trunc(ih/2)*2'";
  }

  // FPS adjustment for ultra low bitrate
  const fpsArgs = [];
  if (fpsOverride !== 'auto') {
    fpsArgs.push('-r', fpsOverride);
  } else if (videoBitrate < 100 && durationSeconds > 15) {
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
 * Compresses and converts a video file using FFmpeg.wasm
 */
export async function compressVideo(file, options = {}, onProgress = () => {}, onLog = () => {}) {
  const {
    targetSizeBytes = null,
    outputFormat = 'mp4', // 'mp4' or 'webm'
    removeAudio = false,
    resolutionOverride = 'auto',
    fpsOverride = 'auto'
  } = options;

  onProgress({ phase: 'initializing', progress: 0.05, message: 'Loading Windows XP Media Engine (FFmpeg)...' });

  const ffmpeg = await getFFmpeg(onLog);

  onProgress({ phase: 'analyzing', progress: 0.12, message: 'Analyzing video stream & duration...' });
  const meta = await getVideoMetadata(file);

  const settings = calculateVideoSettings(
    targetSizeBytes,
    meta.duration,
    meta.width,
    meta.height,
    { removeAudio, resolutionOverride, fpsOverride }
  );

  onLog(`[MediaShrink XP] Target Size: ${targetSizeBytes ? (targetSizeBytes / 1024 / 1024).toFixed(2) + ' MB' : 'Automatic'}`);
  onLog(`[MediaShrink XP] Duration: ${meta.duration.toFixed(1)}s, Source: ${meta.width}x${meta.height}`);
  onLog(`[MediaShrink XP] Video Bitrate: ${settings.videoBitrate}k, Audio Bitrate: ${settings.audioBitrate}k`);

  const inputName = `input_${Date.now()}.${file.name.split('.').pop() || 'mp4'}`;
  const outExt = outputFormat === 'webm' ? 'webm' : 'mp4';
  const outputName = `output_${Date.now()}.${outExt}`;

  onProgress({ phase: 'writing', progress: 0.2, message: 'Preparing video buffer...' });
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  // Setup progress listener
  const progressHandler = ({ progress, time }) => {
    // progress is 0.0 to 1.0 from ffmpeg
    const clamped = Math.max(0, Math.min(0.98, progress));
    const pct = Math.round(clamped * 100);
    onProgress({
      phase: 'encoding',
      progress: 0.2 + clamped * 0.75,
      message: `Compressing video stream (${pct}%)...`
    });
  };

  ffmpeg.on('progress', progressHandler);

  // Construct FFmpeg command
  const ffmpegArgs = ['-i', inputName];

  // Video filter
  if (settings.scaleFilter) {
    ffmpegArgs.push('-vf', settings.scaleFilter);
  }

  // FPS arguments
  if (settings.fpsArgs.length > 0) {
    ffmpegArgs.push(...settings.fpsArgs);
  }

  if (outExt === 'mp4') {
    // H.264 encoding with target bitrate and ultrafast/veryfast preset for browser WASM speed
    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-b:v', `${settings.videoBitrate}k`,
      '-maxrate', `${Math.round(settings.videoBitrate * 1.2)}k`,
      '-bufsize', `${Math.round(settings.videoBitrate * 2)}k`,
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart' // Enables web streaming / immediate playback
    );

    if (removeAudio) {
      ffmpegArgs.push('-an');
    } else {
      ffmpegArgs.push('-c:a', 'aac', '-b:a', `${settings.audioBitrate}k`, '-ac', '2');
    }
  } else {
    // WebM VP8/VP9
    ffmpegArgs.push(
      '-c:v', 'libvpx',
      '-b:v', `${settings.videoBitrate}k`,
      '-quality', 'realtime',
      '-cpu-used', '4'
    );
    if (removeAudio) {
      ffmpegArgs.push('-an');
    } else {
      ffmpegArgs.push('-c:a', 'libvorbis', '-b:a', `${settings.audioBitrate}k`);
    }
  }

  ffmpegArgs.push(outputName);

  onProgress({ phase: 'encoding', progress: 0.25, message: 'Encoding video frames...' });
  onLog(`[MediaShrink XP] Executing: ffmpeg ${ffmpegArgs.join(' ')}`);

  await ffmpeg.exec(ffmpegArgs);

  onProgress({ phase: 'finalizing', progress: 0.96, message: 'Extracting compressed output...' });

  const data = await ffmpeg.readFile(outputName);
  const outputMime = outExt === 'mp4' ? 'video/mp4' : 'video/webm';
  const outBlob = new Blob([data.buffer], { type: outputMime });

  // Cleanup virtual files
  try {
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);
  } catch (e) {}

  onProgress({ phase: 'done', progress: 1.0, message: 'Video compression complete!' });

  return {
    blob: outBlob,
    format: outputMime,
    size: outBlob.size,
    originalSize: file.size,
    duration: meta.duration
  };
}

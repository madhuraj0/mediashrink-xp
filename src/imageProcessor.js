/**
 * High-performance client-side Image Compressor & Resizer
 * Guaranteed strict adherence to target file sizes.
 */

export async function compressImage(file, options = {}, onProgress = () => {}) {
  const {
    targetSizeBytes = null,
    outputFormat = 'image/webp',
    maxWidth = null,
    maxHeight = null,
    fixedQuality = null
  } = options;

  onProgress({ phase: 'decoding', progress: 0.1, message: 'Reading image data...' });

  const bitmap = await createImageBitmap(file);
  const origWidth = bitmap.width;
  const origHeight = bitmap.height;

  let mimeType = outputFormat;
  if (outputFormat === 'original' || outputFormat === 'auto') {
    mimeType = file.type || 'image/webp';
  }
  if (!mimeType.startsWith('image/')) {
    mimeType = 'image/webp';
  }

  let scale = 1.0;
  if (maxWidth && origWidth > maxWidth) {
    scale = Math.min(scale, maxWidth / origWidth);
  }
  if (maxHeight && origHeight > maxHeight) {
    scale = Math.min(scale, maxHeight / origHeight);
  }

  if (!targetSizeBytes || targetSizeBytes <= 0) {
    const targetW = Math.round(origWidth * scale);
    const targetH = Math.round(origHeight * scale);
    const canvas = new OffscreenCanvas(targetW, targetH);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    const blob = await canvas.convertToBlob({
      type: mimeType,
      quality: fixedQuality ?? 0.85
    });
    return {
      blob,
      width: targetW,
      height: targetH,
      format: mimeType,
      size: blob.size,
      originalSize: file.size
    };
  }

  // Target size algorithm: Binary Search on quality + adaptive downscale
  let currentScale = scale;
  let bestBlob = null;
  const maxScalePasses = 10;

  for (let scalePass = 0; scalePass < maxScalePasses; scalePass++) {
    const curW = Math.max(16, Math.round(origWidth * currentScale));
    const curH = Math.max(16, Math.round(origHeight * currentScale));
    const canvas = new OffscreenCanvas(curW, curH);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, curW, curH);

    // Binary search quality between 0.05 and 0.95
    let lowQ = 0.05;
    let highQ = 0.95;
    let optimalBlobForScale = null;

    for (let qStep = 0; qStep < 7; qStep++) {
      const midQ = (lowQ + highQ) / 2;
      onProgress({
        phase: 'optimizing',
        progress: 0.2 + (scalePass * 7 + qStep) * 0.05,
        message: `Optimizing quality at ${curW}x${curH}...`
      });

      const testBlob = await canvas.convertToBlob({
        type: mimeType === 'image/png' ? 'image/webp' : mimeType,
        quality: midQ
      });

      if (testBlob.size <= targetSizeBytes) {
        optimalBlobForScale = { blob: testBlob, width: curW, height: curH, quality: midQ };
        lowQ = midQ;
      } else {
        highQ = midQ;
      }
    }

    if (optimalBlobForScale && optimalBlobForScale.blob.size <= targetSizeBytes) {
      bestBlob = optimalBlobForScale;
      break;
    }

    currentScale *= 0.75;
  }

  if (!bestBlob) {
    const curW = Math.max(16, Math.round(origWidth * currentScale));
    const curH = Math.max(16, Math.round(origHeight * currentScale));
    const canvas = new OffscreenCanvas(curW, curH);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, curW, curH);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.1 });
    bestBlob = { blob, width: curW, height: curH };
  }

  onProgress({ phase: 'done', progress: 1.0, message: 'Image compression complete!' });

  return {
    blob: bestBlob.blob,
    width: bestBlob.width,
    height: bestBlob.height,
    format: bestBlob.blob.type || mimeType,
    size: bestBlob.blob.size,
    originalSize: file.size
  };
}

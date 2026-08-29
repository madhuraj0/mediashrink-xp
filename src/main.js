import { sound } from './audioSynth.js';
import { compressImage } from './imageProcessor.js';
import { compressVideo } from './videoProcessor.js';
import JSZip from 'jszip';

// State variables
let currentFile = null;
let compressedResult = null;
let batchQueue = [];
let isProcessing = false;

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfoBox = document.getElementById('fileInfoBox');
const infoFileName = document.getElementById('infoFileName');
const infoFileSize = document.getElementById('infoFileSize');
const infoFileType = document.getElementById('infoFileType');
const infoDurationWrap = document.getElementById('infoDurationWrap');
const infoDuration = document.getElementById('infoDuration');

const presetBtns = document.querySelectorAll('.preset-btn');
const targetSizeVal = document.getElementById('targetSizeVal');
const targetSizeUnit = document.getElementById('targetSizeUnit');
const targetCalculatedNote = document.getElementById('targetCalculatedNote');

const formatSelect = document.getElementById('formatSelect');
const resolutionSelect = document.getElementById('resolutionSelect');
const audioSelect = document.getElementById('audioSelect');
const fpsSelect = document.getElementById('fpsSelect');
const audioOptionWrap = document.getElementById('audioOptionWrap');
const fpsOptionWrap = document.getElementById('fpsOptionWrap');

const btnProcess = document.getElementById('btnProcess');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressStatusLabel = document.getElementById('progressStatusLabel');
const progressPctLabel = document.getElementById('progressPctLabel');

const comparisonPanel = document.getElementById('comparisonPanel');
const origPreviewContainer = document.getElementById('origPreviewContainer');
const compressedPreviewContainer = document.getElementById('compressedPreviewContainer');
const origSizeLabel = document.getElementById('origSizeLabel');
const origFormatLabel = document.getElementById('origFormatLabel');
const compSizeLabel = document.getElementById('compSizeLabel');
const compFormatLabel = document.getElementById('compFormatLabel');
const badgeSavings = document.getElementById('badgeSavings');
const btnDownload = document.getElementById('btnDownload');
const tbBtnSave = document.getElementById('tbBtnSave');

const cmdLogOutput = document.getElementById('cmdLogOutput');
const statusMessage = document.getElementById('statusMessage');

// Sound toggles
const soundStatusText = document.getElementById('soundStatusText');
const tbBtnSound = document.getElementById('tbBtnSound');
const traySoundIcon = document.getElementById('traySoundIcon');

// Batch elements
const btnBatchAdd = document.getElementById('btnBatchAdd');
const batchFileInput = document.getElementById('batchFileInput');
const btnBatchClear = document.getElementById('btnBatchClear');
const btnBatchStart = document.getElementById('btnBatchStart');
const btnBatchZip = document.getElementById('btnBatchZip');
const batchTableBody = document.getElementById('batchTableBody');

// Utility to format bytes
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Log to XP Terminal
function appendLog(msg) {
  if (!cmdLogOutput) return;
  const timestamp = new Date().toLocaleTimeString();
  cmdLogOutput.textContent += `\n[${timestamp}] ${msg}`;
  cmdLogOutput.scrollTop = cmdLogOutput.scrollHeight;
}

// Update Target Size Note
function updateTargetSizeNote() {
  const val = parseFloat(targetSizeVal.value);
  const unit = targetSizeUnit.value;
  if (isNaN(val) || val <= 0) {
    targetCalculatedNote.textContent = 'Auto / Unconstrained';
    return;
  }
  const bytes = unit === 'MB' ? val * 1024 * 1024 : val * 1024;
  targetCalculatedNote.textContent = `Target: ${formatBytes(bytes)}`;
}

// Sound state sync
function syncSoundUI() {
  const muted = sound.isMuted();
  soundStatusText.textContent = muted ? 'MUTED' : 'ON';
  tbBtnSound.textContent = muted ? '🔇 Retro Sound: OFF' : '🔊 Retro Sound: ON';
  traySoundIcon.textContent = muted ? '🔇' : '🔊';
}

// Setup Tab Navigation
document.querySelectorAll('.xp-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    sound.playClick();
    document.querySelectorAll('.xp-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

    tab.classList.add('active');
    const targetPaneId = tab.dataset.tab;
    const pane = document.getElementById(targetPaneId);
    if (pane) pane.classList.add('active');
  });
});

// Setup Target Size Presets
presetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    sound.playClick();
    presetBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const size = btn.dataset.size;
    const unit = btn.dataset.unit;
    if (size === 'custom') {
      targetSizeVal.focus();
    } else {
      targetSizeVal.value = size;
      targetSizeUnit.value = unit;
    }
    updateTargetSizeNote();
  });
});

targetSizeVal.addEventListener('input', () => {
  presetBtns.forEach(b => b.classList.remove('active'));
  updateTargetSizeNote();
});
targetSizeUnit.addEventListener('change', updateTargetSizeNote);

// Handle Media Selection
function handleFileSelected(file) {
  if (!file) return;
  sound.playClick();
  currentFile = file;
  compressedResult = null;

  fileInfoBox.style.display = 'block';
  infoFileName.textContent = file.name;
  infoFileSize.textContent = formatBytes(file.size);
  const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v|flv)$/i.test(file.name);
  const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|avif|svg)$/i.test(file.name);

  infoFileType.textContent = isVideo ? `Video (${file.type || 'video'})` : isImage ? `Image (${file.type || 'image'})` : 'Media';

  // Toggle video specific options
  audioOptionWrap.style.display = isVideo ? 'flex' : 'none';
  fpsOptionWrap.style.display = isVideo ? 'flex' : 'none';

  // Populate Format Dropdown smartly
  if (isVideo) {
    formatSelect.innerHTML = `
      <option value="mp4" selected>Video: MP4 (H.264 / AAC - Universal)</option>
      <option value="webm">Video: WebM (VP8 / Vorbis)</option>
    `;
    infoDurationWrap.style.display = 'block';
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      infoDuration.textContent = `${video.duration.toFixed(1)} seconds (${video.videoWidth}x${video.videoHeight})`;
      URL.revokeObjectURL(video.src);
    };
  } else {
    formatSelect.innerHTML = `
      <option value="image/webp" selected>Image: WebP (Best Compression)</option>
      <option value="image/jpeg">Image: JPEG</option>
      <option value="image/png">Image: PNG</option>
      <option value="original">Original Format</option>
    `;
    infoDurationWrap.style.display = 'none';
  }

  // Setup Original Preview
  origPreviewContainer.innerHTML = '';
  if (isImage) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    origPreviewContainer.appendChild(img);
  } else if (isVideo) {
    const vid = document.createElement('video');
    vid.src = URL.createObjectURL(file);
    vid.controls = true;
    vid.muted = true;
    origPreviewContainer.appendChild(vid);
  }

  origSizeLabel.textContent = formatBytes(file.size);
  origFormatLabel.textContent = file.type || file.name.split('.').pop()?.toUpperCase();

  btnProcess.disabled = false;
  statusMessage.textContent = `Loaded ${file.name} (${formatBytes(file.size)})`;
  appendLog(`Loaded file: ${file.name}, Size: ${formatBytes(file.size)}, MIME: ${file.type}`);
}

// Drag & Drop handlers
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    handleFileSelected(e.target.files[0]);
  }
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleFileSelected(e.dataTransfer.files[0]);
  }
});

// Process File Button Handler
btnProcess.addEventListener('click', async () => {
  if (!currentFile || isProcessing) return;
  isProcessing = true;
  sound.playClick();

  btnProcess.disabled = true;
  progressContainer.classList.add('visible');
  comparisonPanel.classList.remove('visible');
  progressBar.style.width = '0%';
  progressPctLabel.textContent = '0%';
  progressStatusLabel.textContent = 'Initializing compression engine...';
  statusMessage.textContent = 'Processing media...';

  const val = parseFloat(targetSizeVal.value);
  const unit = targetSizeUnit.value;
  const targetBytes = (!isNaN(val) && val > 0) ? (unit === 'MB' ? val * 1024 * 1024 : val * 1024) : null;

  const isVideo = currentFile.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(currentFile.name);

  try {
    let result = null;
    if (isVideo) {
      result = await compressVideo(
        currentFile,
        {
          targetSizeBytes: targetBytes,
          outputFormat: formatSelect.value,
          removeAudio: audioSelect.value === 'mute',
          resolutionOverride: resolutionSelect.value,
          fpsOverride: fpsSelect.value
        },
        ({ phase, progress, message }) => {
          progressBar.style.width = `${Math.round(progress * 100)}%`;
          progressPctLabel.textContent = `${Math.round(progress * 100)}%`;
          progressStatusLabel.textContent = message;
        },
        (logMsg) => appendLog(logMsg)
      );
    } else {
      result = await compressImage(
        currentFile,
        {
          targetSizeBytes: targetBytes,
          outputFormat: formatSelect.value,
          maxWidth: resolutionSelect.value !== 'original' && resolutionSelect.value !== 'auto' ? parseInt(resolutionSelect.value) : null
        },
        ({ progress, message }) => {
          progressBar.style.width = `${Math.round(progress * 100)}%`;
          progressPctLabel.textContent = `${Math.round(progress * 100)}%`;
          progressStatusLabel.textContent = message;
        }
      );
    }

    compressedResult = result;
    renderComparisonResult(result, isVideo);
    sound.playSuccess();
    statusMessage.textContent = `Completed! Saved ${(100 - (result.size / result.originalSize) * 100).toFixed(1)}% space.`;
    appendLog(`[Success] Output size: ${formatBytes(result.size)} (Target was: ${targetBytes ? formatBytes(targetBytes) : 'None'})`);
  } catch (err) {
    console.error(err);
    sound.playError();
    alert(`Compression Error: ${err.message || err}`);
    appendLog(`[ERROR] ${err.message || err}`);
    statusMessage.textContent = 'Error during compression';
  } finally {
    isProcessing = false;
    btnProcess.disabled = false;
  }
});

// Render Results
function renderComparisonResult(result, isVideo) {
  comparisonPanel.classList.add('visible');
  compressedPreviewContainer.innerHTML = '';

  const outUrl = URL.createObjectURL(result.blob);

  if (isVideo) {
    const vid = document.createElement('video');
    vid.src = outUrl;
    vid.controls = true;
    compressedPreviewContainer.appendChild(vid);
  } else {
    const img = document.createElement('img');
    img.src = outUrl;
    compressedPreviewContainer.appendChild(img);
  }

  compSizeLabel.textContent = formatBytes(result.size);
  compFormatLabel.textContent = result.format;

  const pctSaved = Math.max(0, ((result.originalSize - result.size) / result.originalSize) * 100).toFixed(1);
  badgeSavings.textContent = `-${pctSaved}% Space Saved`;

  btnDownload.disabled = false;
  tbBtnSave.disabled = false;

  const downloadFilename = getDownloadName(currentFile.name, result.format);
  btnDownload.onclick = () => triggerDownload(result.blob, downloadFilename);
  tbBtnSave.onclick = () => triggerDownload(result.blob, downloadFilename);
}

function getDownloadName(origName, mimeType) {
  const baseName = origName.substring(0, origName.lastIndexOf('.')) || origName;
  let ext = 'mp4';
  if (mimeType.includes('webp')) ext = 'webp';
  else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
  else if (mimeType.includes('png')) ext = 'png';
  else if (mimeType.includes('webm')) ext = 'webm';
  return `${baseName}_shrinked.${ext}`;
}

function triggerDownload(blob, filename) {
  sound.playClick();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Batch Processing Logic
btnBatchAdd.addEventListener('click', () => {
  sound.playClick();
  batchFileInput.click();
});

batchFileInput.addEventListener('change', (e) => {
  if (!e.target.files) return;
  Array.from(e.target.files).forEach(file => {
    batchQueue.push({
      id: Math.random().toString(36).substring(2, 9),
      file,
      status: 'Ready',
      compressedBlob: null,
      compressedSize: null
    });
  });
  renderBatchTable();
  btnBatchStart.disabled = batchQueue.length === 0;
});

btnBatchClear.addEventListener('click', () => {
  sound.playClick();
  batchQueue = [];
  renderBatchTable();
  btnBatchStart.disabled = true;
  btnBatchZip.disabled = true;
});

function renderBatchTable() {
  if (batchQueue.length === 0) {
    batchTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: #666; padding: 16px;">
          No files in batch queue. Click "Add Files to Queue" to begin.
        </td>
      </tr>
    `;
    return;
  }

  const val = parseFloat(targetSizeVal.value);
  const unit = targetSizeUnit.value;
  const targetLabel = !isNaN(val) && val > 0 ? `${val} ${unit}` : 'Auto';

  batchTableBody.innerHTML = batchQueue.map(item => `
    <tr>
      <td><strong>${item.file.name}</strong></td>
      <td>${formatBytes(item.file.size)}</td>
      <td>${targetLabel}</td>
      <td><span style="font-weight: bold; color: ${item.status === 'Complete' ? '#2e7d32' : item.status === 'Processing' ? '#0055ea' : '#333'}">${item.status}</span></td>
      <td>${item.compressedSize ? formatBytes(item.compressedSize) : '-'}</td>
      <td>
        ${item.compressedBlob ? `<button class="xp-button" onclick="window.downloadBatchItem('${item.id}')">💾 Save</button>` : ''}
      </td>
    </tr>
  `).join('');
}

window.downloadBatchItem = (id) => {
  const item = batchQueue.find(x => x.id === id);
  if (item && item.compressedBlob) {
    triggerDownload(item.compressedBlob, getDownloadName(item.file.name, item.compressedBlob.type));
  }
};

btnBatchStart.addEventListener('click', async () => {
  if (batchQueue.length === 0 || isProcessing) return;
  isProcessing = true;
  sound.playClick();
  btnBatchStart.disabled = true;

  const val = parseFloat(targetSizeVal.value);
  const unit = targetSizeUnit.value;
  const targetBytes = (!isNaN(val) && val > 0) ? (unit === 'MB' ? val * 1024 * 1024 : val * 1024) : null;

  for (const item of batchQueue) {
    if (item.status === 'Complete') continue;
    item.status = 'Processing';
    renderBatchTable();

    const isVideo = item.file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(item.file.name);
    try {
      let res = null;
      if (isVideo) {
        res = await compressVideo(item.file, {
          targetSizeBytes: targetBytes,
          outputFormat: 'mp4',
          removeAudio: audioSelect.value === 'mute',
          resolutionOverride: resolutionSelect.value
        });
      } else {
        res = await compressImage(item.file, {
          targetSizeBytes: targetBytes,
          outputFormat: 'image/webp'
        });
      }
      item.compressedBlob = res.blob;
      item.compressedSize = res.size;
      item.status = 'Complete';
    } catch (e) {
      console.error(e);
      item.status = 'Failed';
    }
    renderBatchTable();
  }

  sound.playSuccess();
  isProcessing = false;
  btnBatchZip.disabled = false;
});

btnBatchZip.addEventListener('click', async () => {
  sound.playClick();
  const zip = new JSZip();
  batchQueue.forEach(item => {
    if (item.compressedBlob) {
      const fn = getDownloadName(item.file.name, item.compressedBlob.type);
      zip.file(fn, item.compressedBlob);
    }
  });

  const content = await zip.generateAsync({ type: 'blob' });
  triggerDownload(content, 'MediaShrink_Batch.zip');
});

// Menu Bar & Toolbar handlers
document.getElementById('tbBtnOpen').addEventListener('click', () => fileInput.click());
document.getElementById('menuFileOpen').addEventListener('click', () => fileInput.click());
document.getElementById('tbBtnStart').addEventListener('click', () => btnProcess.click());
document.getElementById('tbBtnClear').addEventListener('click', () => {
  sound.playClick();
  currentFile = null;
  compressedResult = null;
  fileInfoBox.style.display = 'none';
  comparisonPanel.classList.remove('visible');
  progressContainer.classList.remove('visible');
  btnProcess.disabled = true;
  btnDownload.disabled = true;
  tbBtnSave.disabled = true;
  statusMessage.textContent = 'Ready for media input';
});

// Sound toggles
function handleSoundToggle() {
  sound.toggleMute();
  syncSoundUI();
  if (!sound.isMuted()) sound.playDing();
}
document.getElementById('menuSoundToggle').addEventListener('click', handleSoundToggle);
tbBtnSound.addEventListener('click', handleSoundToggle);
traySoundIcon.addEventListener('click', handleSoundToggle);

document.getElementById('menuViewLog').addEventListener('click', () => {
  document.querySelector('[data-tab="cmdTab"]').click();
});
document.getElementById('menuHelpAbout').addEventListener('click', () => {
  document.querySelector('[data-tab="aboutTab"]').click();
});
document.getElementById('btnClearLogs').addEventListener('click', () => {
  sound.playClick();
  cmdLogOutput.textContent = 'C:\\MediaShrink> Log buffer cleared.\n';
});

// Desktop icons
document.getElementById('dIconApp').addEventListener('click', () => {
  sound.playClick();
  document.getElementById('mainWindow').style.display = 'flex';
});
document.getElementById('dIconGitHub').addEventListener('click', () => {
  sound.playClick();
  window.open('https://github.com/madhuraj0/mediashrink-xp', '_blank');
});
document.getElementById('dIconTrash').addEventListener('click', () => {
  sound.playDing();
  alert('Recycle Bin is empty!');
});

// Window controls
document.getElementById('winCloseBtn').addEventListener('click', () => {
  sound.playClick();
  document.getElementById('mainWindow').style.display = 'none';
});
document.getElementById('taskbarAppItem').addEventListener('click', () => {
  const win = document.getElementById('mainWindow');
  win.style.display = win.style.display === 'none' ? 'flex' : 'none';
});

// Update System Clock
function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById('systemTime').textContent = timeStr;
}
setInterval(updateClock, 1000);
updateClock();
syncSoundUI();
updateTargetSizeNote();

// Play initial startup sound on first user gesture
let hasStarted = false;
window.addEventListener('click', () => {
  if (!hasStarted) {
    hasStarted = true;
    sound.playStartupSound();
  }
}, { once: true });

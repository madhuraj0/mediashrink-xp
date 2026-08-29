import { sound } from './audioSynth.js';
import { compressImage } from './imageProcessor.js';
import { compressVideo } from './videoProcessor.js';
import JSZip from 'jszip';

// State
let selectedFile = null;
let currentCompressedResult = null;
let batchFiles = [];
let isBusy = false;

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileCard = document.getElementById('fileCard');
const selectedFileName = document.getElementById('selectedFileName');
const selectedFileMeta = document.getElementById('selectedFileMeta');
const fileIcon = document.getElementById('fileIcon');
const btnClearFile = document.getElementById('btnClearFile');

const presetChips = document.querySelectorAll('.preset-chip[data-size]');
const targetInput = document.getElementById('targetInput');
const targetUnit = document.getElementById('targetUnit');

const toggleMoreSettings = document.getElementById('toggleMoreSettings');
const moreSettingsContent = document.getElementById('moreSettingsContent');
const moreSettingsIcon = document.getElementById('moreSettingsIcon');
const formatSelect = document.getElementById('formatSelect');
const resSelect = document.getElementById('resSelect');
const audioSelect = document.getElementById('audioSelect');
const audioSettingWrap = document.getElementById('audioSettingWrap');

const btnCompress = document.getElementById('btnCompress');
const progressPanel = document.getElementById('progressPanel');
const progressFill = document.getElementById('progressFill');
const progressMessage = document.getElementById('progressMessage');
const progressPercent = document.getElementById('progressPercent');

const resultsCard = document.getElementById('resultsCard');
const resOrigSize = document.getElementById('resOrigSize');
const resCompSize = document.getElementById('resCompSize');
const savingsBadge = document.getElementById('savingsBadge');
const origPreview = document.getElementById('origPreview');
const compPreview = document.getElementById('compPreview');
const btnDownload = document.getElementById('btnDownload');

const btnToggleSound = document.getElementById('btnToggleSound');
const soundIcon = document.getElementById('soundIcon');
const soundLabel = document.getElementById('soundLabel');

const terminalLog = document.getElementById('terminalLog');
const btnClearTerminal = document.getElementById('btnClearTerminal');
const statusLabel = document.getElementById('statusLabel');

// Batch Elements
const btnAddBatchFiles = document.getElementById('btnAddBatchFiles');
const batchInput = document.getElementById('batchInput');
const btnClearBatch = document.getElementById('btnClearBatch');
const btnStartBatch = document.getElementById('btnStartBatch');
const btnDownloadZip = document.getElementById('btnDownloadZip');
const batchTableBody = document.getElementById('batchTableBody');

function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function logToTerminal(msg) {
  if (!terminalLog) return;
  const time = new Date().toLocaleTimeString();
  terminalLog.textContent += `\n[${time}] ${msg}`;
  terminalLog.scrollTop = terminalLog.scrollHeight;
}

// Sound Sync
function updateSoundUI() {
  const muted = sound.isMuted();
  soundIcon.textContent = muted ? '🔇' : '🔊';
  soundLabel.textContent = muted ? 'Sound OFF' : 'Sound ON';
}

btnToggleSound.addEventListener('click', () => {
  sound.toggleMute();
  updateSoundUI();
  if (!sound.isMuted()) sound.playDing();
});

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sound.playClick();
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    const target = document.getElementById(btn.dataset.tab);
    if (target) target.classList.add('active');
  });
});

// Preset Size Chips
presetChips.forEach(chip => {
  chip.addEventListener('click', () => {
    sound.playClick();
    presetChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    targetInput.value = chip.dataset.size;
    targetUnit.value = chip.dataset.unit;
  });
});

targetInput.addEventListener('input', () => {
  presetChips.forEach(c => c.classList.remove('active'));
});
targetUnit.addEventListener('change', () => {
  presetChips.forEach(c => c.classList.remove('active'));
});

// Toggle Advanced Options
toggleMoreSettings.addEventListener('click', () => {
  sound.playClick();
  const isOpen = moreSettingsContent.classList.toggle('open');
  moreSettingsIcon.textContent = isOpen ? '▼' : '▶';
});

// Dropzone & File Selection
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    onFileChosen(e.target.files[0]);
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
    onFileChosen(e.dataTransfer.files[0]);
  }
});

function onFileChosen(file) {
  sound.playClick();
  selectedFile = file;
  currentCompressedResult = null;

  fileCard.style.display = 'flex';
  selectedFileName.textContent = file.name;
  
  const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(file.name);
  fileIcon.textContent = isVideo ? '🎬' : '🖼️';
  audioSettingWrap.style.display = isVideo ? 'flex' : 'none';

  selectedFileMeta.textContent = `Size: ${formatBytes(file.size)} • Type: ${isVideo ? 'Video' : 'Image'}`;

  // Populate smart formats
  if (isVideo) {
    formatSelect.innerHTML = `
      <option value="mp4" selected>Video: MP4 (H.264 / AAC)</option>
      <option value="webm">Video: WebM</option>
    `;
  } else {
    formatSelect.innerHTML = `
      <option value="image/webp" selected>Image: WebP (Optimal)</option>
      <option value="image/jpeg">Image: JPEG</option>
      <option value="image/png">Image: PNG</option>
      <option value="original">Original Format</option>
    `;
  }

  btnCompress.disabled = false;
  resultsCard.classList.remove('visible');
  statusLabel.textContent = `Selected: ${file.name} (${formatBytes(file.size)})`;
  logToTerminal(`File selected: ${file.name} (${formatBytes(file.size)})`);
}

btnClearFile.addEventListener('click', (e) => {
  e.stopPropagation();
  sound.playClick();
  selectedFile = null;
  currentCompressedResult = null;
  fileCard.style.display = 'none';
  btnCompress.disabled = true;
  resultsCard.classList.remove('visible');
  progressPanel.classList.remove('visible');
  statusLabel.textContent = 'Ready';
});

// Compress Action
btnCompress.addEventListener('click', async () => {
  if (!selectedFile || isBusy) return;
  isBusy = true;
  sound.playClick();

  btnCompress.disabled = true;
  progressPanel.classList.add('visible');
  resultsCard.classList.remove('visible');
  progressFill.style.width = '0%';
  progressPercent.textContent = '0%';
  progressMessage.textContent = 'Starting compression...';
  statusLabel.textContent = 'Compressing...';

  const val = parseFloat(targetInput.value);
  const unit = targetUnit.value;
  const targetBytes = (!isNaN(val) && val > 0) ? (unit === 'MB' ? val * 1024 * 1024 : val * 1024) : null;
  const isVideo = selectedFile.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi)$/i.test(selectedFile.name);

  try {
    let result = null;
    if (isVideo) {
      result = await compressVideo(
        selectedFile,
        {
          targetSizeBytes: targetBytes,
          outputFormat: formatSelect.value,
          removeAudio: audioSelect.value === 'mute',
          resolutionOverride: resSelect.value
        },
        ({ progress, message }) => {
          const pct = Math.round(progress * 100);
          progressFill.style.width = `${pct}%`;
          progressPercent.textContent = `${pct}%`;
          progressMessage.textContent = message;
        },
        (logMsg) => logToTerminal(logMsg)
      );
    } else {
      result = await compressImage(
        selectedFile,
        {
          targetSizeBytes: targetBytes,
          outputFormat: formatSelect.value,
          maxWidth: resSelect.value !== 'original' && resSelect.value !== 'auto' ? parseInt(resSelect.value) : null
        },
        ({ progress, message }) => {
          const pct = Math.round(progress * 100);
          progressFill.style.width = `${pct}%`;
          progressPercent.textContent = `${pct}%`;
          progressMessage.textContent = message;
        }
      );
    }

    currentCompressedResult = result;
    renderResults(result, isVideo);
    sound.playSuccess();
    statusLabel.textContent = `Completed: ${formatBytes(result.size)}`;
    logToTerminal(`[Complete] Compressed size: ${formatBytes(result.size)} (Target: ${targetBytes ? formatBytes(targetBytes) : 'Auto'})`);
  } catch (err) {
    console.error(err);
    sound.playError();
    alert(`Compression Error: ${err.message || err}`);
    logToTerminal(`[ERROR] ${err.message || err}`);
    statusLabel.textContent = 'Error during compression';
  } finally {
    isBusy = false;
    btnCompress.disabled = false;
  }
});

function renderResults(result, isVideo) {
  resultsCard.classList.add('visible');
  origPreview.innerHTML = '';
  compPreview.innerHTML = '';

  const origUrl = URL.createObjectURL(selectedFile);
  const compUrl = URL.createObjectURL(result.blob);

  if (isVideo) {
    const v1 = document.createElement('video');
    v1.src = origUrl;
    v1.controls = true;
    v1.muted = true;
    origPreview.appendChild(v1);

    const v2 = document.createElement('video');
    v2.src = compUrl;
    v2.controls = true;
    compPreview.appendChild(v2);
  } else {
    const img1 = document.createElement('img');
    img1.src = origUrl;
    origPreview.appendChild(img1);

    const img2 = document.createElement('img');
    img2.src = compUrl;
    compPreview.appendChild(img2);
  }

  resOrigSize.textContent = formatBytes(selectedFile.size);
  resCompSize.textContent = formatBytes(result.size);

  const pctSaved = Math.max(0, ((selectedFile.size - result.size) / selectedFile.size) * 100).toFixed(1);
  savingsBadge.textContent = `-${pctSaved}% Saved (${formatBytes(selectedFile.size - result.size)})`;

  const downloadFilename = getDownloadName(selectedFile.name, result.format);
  btnDownload.onclick = () => triggerDownload(result.blob, downloadFilename);
}

function getDownloadName(origName, mimeType) {
  const baseName = origName.substring(0, origName.lastIndexOf('.')) || origName;
  let ext = 'mp4';
  if (mimeType.includes('webp')) ext = 'webp';
  else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
  else if (mimeType.includes('png')) ext = 'png';
  else if (mimeType.includes('webm')) ext = 'webm';
  return `${baseName}_compressed.${ext}`;
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

// Batch Logic
btnAddBatchFiles.addEventListener('click', () => {
  sound.playClick();
  batchInput.click();
});

batchInput.addEventListener('change', (e) => {
  if (!e.target.files) return;
  Array.from(e.target.files).forEach(file => {
    batchFiles.push({
      id: Math.random().toString(36).substring(2, 9),
      file,
      status: 'Pending',
      compressedBlob: null,
      compressedSize: null
    });
  });
  renderBatch();
  btnStartBatch.disabled = batchFiles.length === 0;
});

btnClearBatch.addEventListener('click', () => {
  sound.playClick();
  batchFiles = [];
  renderBatch();
  btnStartBatch.disabled = true;
  btnDownloadZip.disabled = true;
});

function renderBatch() {
  if (batchFiles.length === 0) {
    batchTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: #777; padding: 20px;">
          No files added yet. Click "Add Files" to batch compress multiple items.
        </td>
      </tr>
    `;
    return;
  }

  const val = parseFloat(targetInput.value);
  const unit = targetUnit.value;
  const targetLabel = !isNaN(val) && val > 0 ? `${val} ${unit}` : 'Auto';

  batchTableBody.innerHTML = batchFiles.map(item => `
    <tr>
      <td><strong>${item.file.name}</strong></td>
      <td>${formatBytes(item.file.size)}</td>
      <td>${targetLabel}</td>
      <td><span style="font-weight: bold; color: ${item.status === 'Complete' ? '#2e7d32' : item.status === 'Processing' ? '#0055ea' : '#555'}">${item.status}</span></td>
      <td>${item.compressedSize ? formatBytes(item.compressedSize) : '-'}</td>
      <td>
        ${item.compressedBlob ? `<button class="preset-chip" style="padding: 4px 8px;" onclick="window.saveBatchItem('${item.id}')">💾 Save</button>` : '-'}
      </td>
    </tr>
  `).join('');
}

window.saveBatchItem = (id) => {
  const item = batchFiles.find(x => x.id === id);
  if (item && item.compressedBlob) {
    triggerDownload(item.compressedBlob, getDownloadName(item.file.name, item.compressedBlob.type));
  }
};

btnStartBatch.addEventListener('click', async () => {
  if (batchFiles.length === 0 || isBusy) return;
  isBusy = true;
  sound.playClick();
  btnStartBatch.disabled = true;

  const val = parseFloat(targetInput.value);
  const unit = targetUnit.value;
  const targetBytes = (!isNaN(val) && val > 0) ? (unit === 'MB' ? val * 1024 * 1024 : val * 1024) : null;

  for (const item of batchFiles) {
    if (item.status === 'Complete') continue;
    item.status = 'Processing';
    renderBatch();

    const isVideo = item.file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(item.file.name);
    try {
      let res = null;
      if (isVideo) {
        res = await compressVideo(item.file, {
          targetSizeBytes: targetBytes,
          outputFormat: 'mp4',
          removeAudio: audioSelect.value === 'mute',
          resolutionOverride: resSelect.value
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
    renderBatch();
  }

  sound.playSuccess();
  isBusy = false;
  btnDownloadZip.disabled = false;
});

btnDownloadZip.addEventListener('click', async () => {
  sound.playClick();
  const zip = new JSZip();
  batchFiles.forEach(item => {
    if (item.compressedBlob) {
      zip.file(getDownloadName(item.file.name, item.compressedBlob.type), item.compressedBlob);
    }
  });
  const content = await zip.generateAsync({ type: 'blob' });
  triggerDownload(content, 'MediaShrink_Batch.zip');
});

btnClearTerminal.addEventListener('click', () => {
  sound.playClick();
  terminalLog.textContent = 'Log buffer cleared.\n';
});

// Initialization
updateSoundUI();

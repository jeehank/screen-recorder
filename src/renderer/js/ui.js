// Initialize Engine
const engine = new ScreenRecorderEngine();

// UI Elements
const statusPill = document.getElementById('status-pill');
const statusText = document.getElementById('status-text');
const timerText = document.getElementById('recording-timer');
const recDot = document.getElementById('rec-dot');

const btnRecord = document.getElementById('btn-record');
const btnRecordText = document.getElementById('btn-record-text');
const btnPause = document.getElementById('btn-pause');
const btnPauseText = document.getElementById('btn-pause-text');
const iconPause = document.getElementById('icon-pause');
const iconResume = document.getElementById('icon-resume');
const btnStop = document.getElementById('btn-stop');

const modeFullscreen = document.getElementById('mode-fullscreen');
const modeRegion = document.getElementById('mode-region');
const modeWindow = document.getElementById('mode-window');
const regionDesc = document.getElementById('region-desc');

const sourceBar = document.getElementById('source-bar');
const sourceLabel = document.getElementById('source-label');
const sourceSelect = document.getElementById('source-select');
const btnSelectRegionOverlay = document.getElementById('btn-select-region-overlay');

const previewVideo = document.getElementById('preview-video');
const viewportEmpty = document.getElementById('viewport-empty');
const previewResolutionText = document.getElementById('preview-resolution-text');
const previewFpsText = document.getElementById('preview-fps-text');

// Audio & Settings
const toggleMic = document.getElementById('toggle-mic');
const selectMicDevice = document.getElementById('select-mic-device');
const vuBarFill = document.getElementById('vu-bar-fill');
const vuDbText = document.getElementById('vu-db-text');
const toggleSystemAudio = document.getElementById('toggle-system-audio');
const selectFramerate = document.getElementById('select-framerate');
const selectBitrate = document.getElementById('select-bitrate');

// Modal Elements
const modalExport = document.getElementById('modal-export');
const modalVideoPlayer = document.getElementById('modal-video-player');
const metaDuration = document.getElementById('meta-duration');
const metaResolution = document.getElementById('meta-resolution');
const btnSaveMp4 = document.getElementById('btn-save-mp4');
const btnOpenFolder = document.getElementById('btn-open-folder');
const btnDiscard = document.getElementById('btn-discard');
const btnCloseModal = document.getElementById('btn-close-modal');
const conversionBox = document.getElementById('conversion-box');
const conversionPercent = document.getElementById('conversion-percent');
const conversionBar = document.getElementById('conversion-bar');

let currentMode = 'fullscreen'; // 'fullscreen' | 'region' | 'window'
let currentSources = [];
let previewStream = null;
let currentRecordingResult = null;
let savedMp4Path = null;

// Format milliseconds to HH:MM:SS
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Update UI State
function updateRecordingState(state) {
  if (state === 'recording') {
    statusPill.className = 'status-pill recording';
    statusText.textContent = 'RECORDING';
    recDot.className = 'timer-dot active';

    btnRecord.disabled = true;
    btnRecord.style.display = 'none';

    btnPause.disabled = false;
    btnPauseText.textContent = 'Pause';
    iconPause.style.display = 'block';
    iconResume.style.display = 'none';

    btnStop.disabled = false;
    disableConfigControls(true);
  } else if (state === 'paused') {
    statusPill.className = 'status-pill paused';
    statusText.textContent = 'PAUSED';
    recDot.className = 'timer-dot paused';

    btnPause.disabled = false;
    btnPauseText.textContent = 'Resume';
    iconPause.style.display = 'none';
    iconResume.style.display = 'block';
  } else {
    // idle
    statusPill.className = 'status-pill ready';
    statusText.textContent = 'READY';
    recDot.className = 'timer-dot';
    timerText.textContent = '00:00:00';

    btnRecord.disabled = false;
    btnRecord.style.display = 'inline-flex';
    btnRecordText.textContent = 'Start Recording';

    btnPause.disabled = true;
    btnPauseText.textContent = 'Pause';
    iconPause.style.display = 'block';
    iconResume.style.display = 'none';

    btnStop.disabled = true;
    disableConfigControls(false);
  }
}

function disableConfigControls(disabled) {
  modeFullscreen.disabled = disabled;
  modeRegion.disabled = disabled;
  modeWindow.disabled = disabled;
  sourceSelect.disabled = disabled;
  btnSelectRegionOverlay.disabled = disabled;
  toggleMic.disabled = disabled;
  selectMicDevice.disabled = disabled;
  toggleSystemAudio.disabled = disabled;
  selectFramerate.disabled = disabled;
  selectBitrate.disabled = disabled;
}

// Populate Microphones
async function loadMicrophones() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');

    selectMicDevice.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = 'default';
    defaultOpt.textContent = 'Default Microphone';
    selectMicDevice.appendChild(defaultOpt);

    audioInputs.forEach((device, idx) => {
      const opt = document.createElement('option');
      opt.value = device.deviceId;
      opt.textContent = device.label || `Microphone ${idx + 1}`;
      selectMicDevice.appendChild(opt);
    });
  } catch (err) {
    console.warn('Unable to list audio devices:', err);
  }
}

// Populate Screen and Window sources
async function refreshSources() {
  if (!window.electronAPI) return;

  try {
    currentSources = await window.electronAPI.getSources();
    sourceSelect.innerHTML = '';

    let filtered = [];
    if (currentMode === 'fullscreen' || currentMode === 'region') {
      filtered = currentSources.filter(s => s.id.startsWith('screen:'));
      sourceLabel.textContent = 'Select Display:';
    } else {
      filtered = currentSources.filter(s => s.id.startsWith('window:'));
      sourceLabel.textContent = 'Select App Window:';
    }

    if (filtered.length === 0) {
      filtered = currentSources;
    }

    filtered.forEach(source => {
      const opt = document.createElement('option');
      opt.value = source.id;
      opt.textContent = source.name;
      sourceSelect.appendChild(opt);
    });

    if (filtered.length > 0) {
      updateLivePreview(filtered[0].id);
    }
  } catch (err) {
    console.error('Failed to load screen sources:', err);
  }
}

// Live Viewport Preview
async function updateLivePreview(sourceId) {
  if (!sourceId) return;

  try {
    if (previewStream) {
      previewStream.getTracks().forEach(t => t.stop());
    }

    previewStream = await navigator.mediaDevices.getUserMedia({
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: sourceId,
          minFrameRate: 30,
          maxFrameRate: 60
        }
      },
      audio: false
    });

    previewVideo.srcObject = previewStream;
    viewportEmpty.style.display = 'none';
    previewVideo.style.display = 'block';

    previewVideo.onloadedmetadata = () => {
      previewResolutionText.textContent = `${previewVideo.videoWidth} × ${previewVideo.videoHeight}`;
      previewFpsText.textContent = `${selectFramerate.value} FPS`;
    };
  } catch (err) {
    console.warn('Preview stream error:', err);
    viewportEmpty.style.display = 'flex';
    previewVideo.style.display = 'none';
  }
}

// Switch Capture Modes
function setMode(mode) {
  currentMode = mode;
  [modeFullscreen, modeRegion, modeWindow].forEach(btn => btn.classList.remove('active'));

  if (mode === 'fullscreen') {
    modeFullscreen.classList.add('active');
    btnSelectRegionOverlay.style.display = 'none';
    engine.clearRegion();
    regionDesc.textContent = 'Select screen area';
  } else if (mode === 'region') {
    modeRegion.classList.add('active');
    btnSelectRegionOverlay.style.display = 'inline-flex';
  } else if (mode === 'window') {
    modeWindow.classList.add('active');
    btnSelectRegionOverlay.style.display = 'none';
    engine.clearRegion();
  }

  refreshSources();
}

modeFullscreen.addEventListener('click', () => setMode('fullscreen'));
modeRegion.addEventListener('click', () => {
  setMode('region');
  openRegionOverlay();
});
modeWindow.addEventListener('click', () => setMode('window'));

// Open Region Selector Overlay
function openRegionOverlay() {
  if (window.electronAPI) {
    const selectedSource = sourceSelect.value;
    window.electronAPI.openRegionSelector(selectedSource);
  }
}

btnSelectRegionOverlay.addEventListener('click', openRegionOverlay);

// Handle Selected Region
if (window.electronAPI) {
  window.electronAPI.onRegionSelected((region) => {
    if (region) {
      engine.setRegion(region);
      regionDesc.textContent = `${region.width} × ${region.height} px`;
      previewResolutionText.textContent = `${region.width} × ${region.height} (Region)`;
    }
  });

  window.electronAPI.onConversionProgress((percent) => {
    conversionBox.style.display = 'block';
    conversionPercent.textContent = `${percent}%`;
    conversionBar.style.width = `${percent}%`;
  });

  window.electronAPI.onShortcutRecord(() => {
    if (engine.state === 'idle') {
      startRecording();
    } else {
      stopRecording();
    }
  });

  window.electronAPI.onShortcutPause(() => {
    if (engine.state === 'recording') {
      engine.pause();
    } else if (engine.state === 'paused') {
      engine.resume();
    }
  });
}

sourceSelect.addEventListener('change', () => {
  updateLivePreview(sourceSelect.value);
});

selectFramerate.addEventListener('change', () => {
  previewFpsText.textContent = `${selectFramerate.value} FPS`;
  engine.setOptions({ fps: selectFramerate.value });
});

selectBitrate.addEventListener('change', () => {
  engine.setOptions({ videoBitrate: selectBitrate.value });
});

toggleMic.addEventListener('change', () => {
  engine.setOptions({ includeMic: toggleMic.checked });
  document.getElementById('mic-settings-body').style.opacity = toggleMic.checked ? '1' : '0.4';
});

selectMicDevice.addEventListener('change', () => {
  engine.setOptions({ micDeviceId: selectMicDevice.value });
});

toggleSystemAudio.addEventListener('change', () => {
  engine.setOptions({ includeSystemAudio: toggleSystemAudio.checked });
});

// Engine callbacks
engine.onTick = (ms) => {
  timerText.textContent = formatTime(ms);
};

engine.onStateChange = (state) => {
  updateRecordingState(state);
};

engine.onAudioLevel = (level) => {
  vuBarFill.style.width = `${level}%`;
  vuDbText.textContent = level > 0 ? `-${Math.round((100 - level) * 0.4)} dB` : '-inf dB';
};

// Start Recording
async function startRecording() {
  const selectedSource = sourceSelect.value;
  if (!selectedSource) {
    alert('Please select a screen or window source first.');
    return;
  }

  // Stop preview to free up stream resources
  if (previewStream) {
    previewStream.getTracks().forEach(t => t.stop());
    previewStream = null;
  }

  engine.setOptions({
    fps: selectFramerate.value,
    videoBitrate: selectBitrate.value,
    includeMic: toggleMic.checked,
    includeSystemAudio: toggleSystemAudio.checked,
    micDeviceId: selectMicDevice.value
  });

  try {
    await engine.start(selectedSource);
  } catch (err) {
    console.error('Failed to start recording:', err);
    alert('Recording failed to start: ' + err.message);
    updateRecordingState('idle');
    refreshSources();
  }
}

// Pause / Resume
btnPause.addEventListener('click', () => {
  if (engine.state === 'recording') {
    engine.pause();
  } else if (engine.state === 'paused') {
    engine.resume();
  }
});

// Stop Recording
async function stopRecording() {
  try {
    const result = await engine.stop();
    if (result) {
      currentRecordingResult = result;
      showExportModal(result);
    }
  } catch (err) {
    console.error('Failed to stop recording:', err);
  } finally {
    refreshSources();
  }
}

btnRecord.addEventListener('click', startRecording);
btnStop.addEventListener('click', stopRecording);

// Export Modal Handling
function showExportModal(result) {
  const videoUrl = URL.createObjectURL(result.blob);
  modalVideoPlayer.src = videoUrl;
  metaDuration.textContent = formatTime(result.duration);
  metaResolution.textContent = result.resolution;

  conversionBox.style.display = 'none';
  btnSaveMp4.style.display = 'inline-flex';
  btnOpenFolder.style.display = 'none';
  modalExport.classList.add('open');
}

function closeModal() {
  modalExport.classList.remove('open');
  if (modalVideoPlayer.src) {
    URL.revokeObjectURL(modalVideoPlayer.src);
    modalVideoPlayer.src = '';
  }
}

btnCloseModal.addEventListener('click', closeModal);
btnDiscard.addEventListener('click', closeModal);

// Save MP4
btnSaveMp4.addEventListener('click', async () => {
  if (!currentRecordingResult || !window.electronAPI) return;

  const defaultName = `ScreenRecording_${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`;
  const targetPath = await window.electronAPI.selectSavePath(defaultName);

  if (!targetPath) return;

  btnSaveMp4.disabled = true;
  btnSaveMp4.innerHTML = 'Converting & Saving...';
  conversionBox.style.display = 'block';
  conversionPercent.textContent = '0%';
  conversionBar.style.width = '0%';

  try {
    const response = await window.electronAPI.convertToMp4({
      tempBuffer: currentRecordingResult.buffer,
      outputFilePath: targetPath,
      fps: parseInt(selectFramerate.value, 10)
    });

    savedMp4Path = response.path;
    btnSaveMp4.style.display = 'none';
    btnOpenFolder.style.display = 'inline-flex';
    conversionPercent.textContent = '100% (Done)';
    conversionBar.style.width = '100%';
  } catch (err) {
    console.error('Error saving MP4:', err);
    alert('Error saving MP4 file: ' + err.message);
  } finally {
    btnSaveMp4.disabled = false;
    btnSaveMp4.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      Save MP4 Video`;
  }
});

btnOpenFolder.addEventListener('click', () => {
  if (savedMp4Path && window.electronAPI) {
    window.electronAPI.showInFolder(savedMp4Path);
  }
});

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  loadMicrophones();
  refreshSources();
});

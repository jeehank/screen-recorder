// Initialize Recorder Engine
const engine = new ScreenRecorderEngine();

// UI Elements
const cardMode = document.getElementById('card-mode');
const dropdownMode = document.getElementById('dropdown-mode');
const labelMode = document.getElementById('label-mode');
const dropdownRegionDesc = document.getElementById('dropdown-region-desc');

const cardAudio = document.getElementById('card-audio');
const dropdownAudio = document.getElementById('dropdown-audio');
const labelAudio = document.getElementById('label-audio');
const checkSystemAudio = document.getElementById('check-system-audio');
const checkMic = document.getElementById('check-mic');
const selectMicSource = document.getElementById('select-mic-source');
const cardLedMeter = document.getElementById('card-led-meter');

const cardFormat = document.getElementById('card-format');
const dropdownFormat = document.getElementById('dropdown-format');
const labelFormat = document.getElementById('label-format');
const selectFps = document.getElementById('select-fps');
const selectQuality = document.getElementById('select-quality');

const sliderSpeaker = document.getElementById('slider-speaker');
const sliderMic = document.getElementById('slider-mic');
const btnToggleSpeakerMute = document.getElementById('btn-toggle-speaker-mute');
const btnToggleMicMute = document.getElementById('btn-toggle-mic-mute');

const btnMainRecord = document.getElementById('btn-main-record');
const startBtnText = document.getElementById('start-btn-text');

const infoFolderPath = document.getElementById('info-folder-path');
const btnBrowseFolder = document.getElementById('btn-browse-folder');

const footerStatus = document.getElementById('footer-status');
const footerTimer = document.getElementById('footer-timer');
const btnFooterPause = document.getElementById('btn-footer-pause');
const btnFooterStop = document.getElementById('btn-footer-stop');

// Modals
const modalSettings = document.getElementById('modal-settings');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnNavSetting = document.getElementById('btn-nav-setting');
const btnNavMore = document.getElementById('btn-nav-more');
const settingFolderInput = document.getElementById('setting-folder-input');
const btnChangeFolderModal = document.getElementById('btn-change-folder-modal');

const modalMedia = document.getElementById('modal-media');
const btnCloseMedia = document.getElementById('btn-close-media');
const btnNavMedia = document.getElementById('btn-nav-media');
const mediaVideoPlayer = document.getElementById('media-video-player');
const btnSaveAsMp4 = document.getElementById('btn-save-as-mp4');
const btnShowFolder = document.getElementById('btn-show-folder');

let currentMode = 'fullscreen'; // 'fullscreen' | 'region' | 'window'
let currentDisplayId = null;
let currentWindowId = null;
let currentSources = [];
let defaultOutputDir = '';
let currentRecordingResult = null;
let lastSavedFilePath = null;

// LED segments
const ledSegments = Array.from(cardLedMeter.querySelectorAll('.led-seg'));

// Format Milliseconds
function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Close all open dropdowns
function closeAllDropdowns() {
  dropdownMode.classList.remove('show');
  dropdownAudio.classList.remove('show');
  dropdownFormat.classList.remove('show');
}

// Dropdown Toggles
cardMode.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = dropdownMode.classList.contains('show');
  closeAllDropdowns();
  if (!isOpen) dropdownMode.classList.add('show');
});

cardAudio.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = dropdownAudio.classList.contains('show');
  closeAllDropdowns();
  if (!isOpen) dropdownAudio.classList.add('show');
});

cardFormat.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = dropdownFormat.classList.contains('show');
  closeAllDropdowns();
  if (!isOpen) dropdownFormat.classList.add('show');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.control-card-wrapper')) {
    closeAllDropdowns();
  }
});

const btnCloseModePopout = document.getElementById('btn-close-mode-popout');
const btnDrawAreaTrigger = document.getElementById('btn-draw-area-trigger');
const windowSelectContainer = document.getElementById('window-select-container');
const selectWindowSource = document.getElementById('select-window-source');

if (btnCloseModePopout) {
  btnCloseModePopout.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMode.classList.remove('show');
  });
}

if (btnDrawAreaTrigger) {
  btnDrawAreaTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    currentMode = 'region';
    labelMode.textContent = 'Custom';
    dropdownMode.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
    const regItem = dropdownMode.querySelector('[data-mode="region"]');
    if (regItem) regItem.classList.add('active');
    closeAllDropdowns();
    openRegionSelector();
  });
}

// Mode Selection Handlers
dropdownMode.querySelectorAll('.dropdown-item').forEach(item => {
  item.addEventListener('click', () => {
    const mode = item.dataset.mode;
    dropdownMode.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    currentMode = mode;
    if (mode === 'fullscreen') {
      labelMode.textContent = 'Full';
      engine.clearRegion();
      windowSelectContainer.style.display = 'none';
      closeAllDropdowns();
    } else if (mode === 'region') {
      labelMode.textContent = 'Custom';
      windowSelectContainer.style.display = 'none';
      closeAllDropdowns();
      openRegionSelector();
    } else if (mode === 'window') {
      labelMode.textContent = 'Window';
      engine.clearRegion();
      windowSelectContainer.style.display = 'block';
      populateWindowSources();
    }
  });
});

async function populateWindowSources() {
  if (window.electronAPI) {
    try {
      currentSources = await window.electronAPI.getSources();
      const windows = currentSources.filter(s => s.id.startsWith('window:'));
      selectWindowSource.innerHTML = '';
      windows.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w.id;
        opt.textContent = w.name;
        selectWindowSource.appendChild(opt);
      });
    } catch (e) {}
  }
}

function openRegionSelector() {
  if (window.electronAPI) {
    const screenSource = currentSources.find(s => s.id.startsWith('screen:'));
    window.electronAPI.openRegionSelector(screenSource ? screenSource.id : null);
  }
}

if (window.electronAPI) {
  window.electronAPI.onRegionSelected((region) => {
    if (region) {
      engine.setRegion(region);
      labelMode.textContent = 'Custom';
      dropdownRegionDesc.textContent = `${region.width} × ${region.height} px`;
    }
  });

  window.electronAPI.onShortcutRecord(() => {
    handleStartOrStop();
  });

  window.electronAPI.onShortcutPause(() => {
    handlePauseResume();
  });
}

// Audio Handlers
checkSystemAudio.addEventListener('change', () => {
  engine.setOptions({ includeSystemAudio: checkSystemAudio.checked });
  updateAudioCardLabel();
});

checkMic.addEventListener('change', () => {
  engine.setOptions({ includeMic: checkMic.checked });
  updateAudioCardLabel();
});

function updateAudioCardLabel() {
  if (checkSystemAudio.checked && checkMic.checked) {
    labelAudio.textContent = 'Speaker';
  } else if (checkSystemAudio.checked) {
    labelAudio.textContent = 'Speaker';
  } else if (checkMic.checked) {
    labelAudio.textContent = 'Mic';
  } else {
    labelAudio.textContent = 'Mute';
  }
}

selectMicSource.addEventListener('change', () => {
  engine.setOptions({ micDeviceId: selectMicSource.value });
});

// Format Handlers
selectFps.addEventListener('change', () => {
  engine.setOptions({ fps: selectFps.value });
});

selectQuality.addEventListener('change', () => {
  engine.setOptions({ videoBitrate: selectQuality.value });
});

// Slider Mute Toggles
let prevSpeakerVal = 100;
btnToggleSpeakerMute.addEventListener('click', () => {
  if (sliderSpeaker.value > 0) {
    prevSpeakerVal = sliderSpeaker.value;
    sliderSpeaker.value = 0;
    checkSystemAudio.checked = false;
  } else {
    sliderSpeaker.value = prevSpeakerVal || 100;
    checkSystemAudio.checked = true;
  }
  engine.setOptions({ includeSystemAudio: checkSystemAudio.checked });
  updateAudioCardLabel();
});

let prevMicVal = 85;
btnToggleMicMute.addEventListener('click', () => {
  if (sliderMic.value > 0) {
    prevMicVal = sliderMic.value;
    sliderMic.value = 0;
    checkMic.checked = false;
  } else {
    sliderMic.value = prevMicVal || 85;
    checkMic.checked = true;
  }
  engine.setOptions({ includeMic: checkMic.checked });
  updateAudioCardLabel();
});

sliderSpeaker.addEventListener('input', () => {
  checkSystemAudio.checked = sliderSpeaker.value > 0;
  engine.setOptions({ includeSystemAudio: checkSystemAudio.checked });
  updateAudioCardLabel();
});

sliderMic.addEventListener('input', () => {
  checkMic.checked = sliderMic.value > 0;
  engine.setOptions({ includeMic: checkMic.checked });
  updateAudioCardLabel();
});

// LED VU Meter Update Callback
engine.onAudioLevel = (level) => {
  const activeCount = Math.round((level / 100) * ledSegments.length);
  ledSegments.forEach((seg, idx) => {
    seg.className = 'led-seg';
    if (idx < activeCount) {
      if (idx >= ledSegments.length - 1) {
        seg.classList.add('on-red');
      } else if (idx >= ledSegments.length - 3) {
        seg.classList.add('on-yellow');
      } else {
        seg.classList.add('on-green');
      }
    }
  });
};

// Engine Time & State Sync
engine.onTick = (ms) => {
  const formatted = formatTime(ms);
  footerTimer.textContent = formatted;
  if (engine.state === 'recording') {
    startBtnText.textContent = formatted.slice(3); // Shows mm:ss in circle
  }
};

engine.onStateChange = (state) => {
  if (state === 'recording') {
    btnMainRecord.className = 'start-circle-btn recording';
    footerStatus.style.display = 'flex';
    btnFooterPause.textContent = '⏸';
  } else if (state === 'paused') {
    btnMainRecord.className = 'start-circle-btn paused';
    startBtnText.textContent = 'Pause';
    btnFooterPause.textContent = '▶';
  } else {
    btnMainRecord.className = 'start-circle-btn';
    startBtnText.textContent = 'Start';
    footerStatus.style.display = 'none';
    footerTimer.textContent = '00:00:00';
    ledSegments.forEach(s => s.className = 'led-seg');
  }
};

// Start or Stop Action
async function handleStartOrStop() {
  if (engine.state === 'idle') {
    await startRecording();
  } else {
    await stopRecording();
  }
}

function handlePauseResume() {
  if (engine.state === 'recording') {
    engine.pause();
  } else if (engine.state === 'paused') {
    engine.resume();
  }
}

btnMainRecord.addEventListener('click', handleStartOrStop);
btnFooterPause.addEventListener('click', handlePauseResume);
btnFooterStop.addEventListener('click', stopRecording);

// Start Recording Flow
async function startRecording() {
  try {
    let source = currentSources.find(s => s.id.startsWith('screen:'));
    if (currentMode === 'window') {
      source = currentSources.find(s => s.id.startsWith('window:')) || source;
    }

    if (!source && currentSources.length > 0) {
      source = currentSources[0];
    }

    if (!source) {
      alert('No display source found.');
      return;
    }

    engine.setOptions({
      fps: selectFps.value,
      videoBitrate: selectQuality.value,
      includeMic: checkMic.checked && sliderMic.value > 0,
      includeSystemAudio: checkSystemAudio.checked && sliderSpeaker.value > 0,
      micDeviceId: selectMicSource.value
    });

    await engine.start(source.id);
  } catch (err) {
    console.error('Error starting recording:', err);
    alert('Recording failed: ' + err.message);
  }
}

// Stop Recording Flow
async function stopRecording() {
  try {
    const result = await engine.stop();
    if (result) {
      currentRecordingResult = result;
      openMediaModal(result);
    }
  } catch (err) {
    console.error('Error stopping recording:', err);
  }
}

// Media Modal Handlers
function openMediaModal(result) {
  const url = URL.createObjectURL(result.blob);
  mediaVideoPlayer.src = url;
  modalMedia.classList.add('open');
  btnSaveAsMp4.textContent = 'Save MP4 Video';
  btnSaveAsMp4.disabled = false;
  btnShowFolder.style.display = lastSavedFilePath ? 'inline-block' : 'none';
}

function closeMediaModal() {
  modalMedia.classList.remove('open');
  if (mediaVideoPlayer.src) {
    URL.revokeObjectURL(mediaVideoPlayer.src);
    mediaVideoPlayer.src = '';
  }
}

btnCloseMedia.addEventListener('click', closeMediaModal);
btnNavMedia.addEventListener('click', () => {
  if (currentRecordingResult) {
    openMediaModal(currentRecordingResult);
  } else {
    alert('No recording made yet. Click "Start" to record your screen.');
  }
});

// Save MP4 handler
btnSaveAsMp4.addEventListener('click', async () => {
  if (!currentRecordingResult || !window.electronAPI) return;

  const defaultName = `ScreenRecord_${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`;
  const targetPath = await window.electronAPI.selectSavePath(defaultName);

  if (!targetPath) return;

  btnSaveAsMp4.textContent = 'Converting to MP4...';
  btnSaveAsMp4.disabled = true;

  try {
    const res = await window.electronAPI.convertToMp4({
      tempBuffer: currentRecordingResult.buffer,
      outputFilePath: targetPath,
      fps: parseInt(selectFps.value, 10)
    });

    lastSavedFilePath = res.path;
    btnSaveAsMp4.textContent = 'Saved Successfully!';
    btnShowFolder.style.display = 'inline-block';
  } catch (err) {
    console.error('Save failed:', err);
    alert('Error saving MP4: ' + err.message);
    btnSaveAsMp4.textContent = 'Save MP4 Video';
    btnSaveAsMp4.disabled = false;
  }
});

btnShowFolder.addEventListener('click', () => {
  if (lastSavedFilePath && window.electronAPI) {
    window.electronAPI.showInFolder(lastSavedFilePath);
  }
});

// Settings Modal Handlers
btnNavSetting.addEventListener('click', () => {
  settingFolderInput.value = defaultOutputDir;
  modalSettings.classList.add('open');
});

btnNavMore.addEventListener('click', () => {
  settingFolderInput.value = defaultOutputDir;
  modalSettings.classList.add('open');
});

btnCloseSettings.addEventListener('click', () => {
  modalSettings.classList.remove('open');
});

btnChangeFolderModal.addEventListener('click', async () => {
  if (window.electronAPI) {
    const folder = await window.electronAPI.selectFolder();
    if (folder) {
      defaultOutputDir = folder;
      infoFolderPath.textContent = folder;
      settingFolderInput.value = folder;
    }
  }
});

btnBrowseFolder.addEventListener('click', async () => {
  if (window.electronAPI) {
    const folder = await window.electronAPI.selectFolder();
    if (folder) {
      defaultOutputDir = folder;
      infoFolderPath.textContent = folder;
      settingFolderInput.value = folder;
    }
  }
});

// Initialize Devices & Sources
async function init() {
  if (window.electronAPI) {
    try {
      const paths = await window.electronAPI.getUserPaths();
      if (paths && paths.videosPath) {
        defaultOutputDir = paths.videosPath;
        infoFolderPath.textContent = paths.videosPath;
      }
      currentSources = await window.electronAPI.getSources();
    } catch (e) {
      console.warn('Init error:', e);
    }
  }

  // Load mic devices
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter(d => d.kind === 'audioinput');
    selectMicSource.innerHTML = '';

    const def = document.createElement('option');
    def.value = 'default';
    def.textContent = 'Default Microphone';
    selectMicSource.appendChild(def);

    mics.forEach((mic, i) => {
      const opt = document.createElement('option');
      opt.value = mic.deviceId;
      opt.textContent = mic.label || `Microphone ${i + 1}`;
      selectMicSource.appendChild(opt);
    });
  } catch (e) {
    console.warn('Mic enum error:', e);
  }
}

window.addEventListener('DOMContentLoaded', init);

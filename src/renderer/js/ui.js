// Initialize Recorder Engine
const engine = new ScreenRecorderEngine();

// UI Elements
const cardMode = document.getElementById('card-mode');
const labelMode = document.getElementById('label-mode');
const popoutModeOverlay = document.getElementById('popout-mode-overlay');
const btnCloseModeDialog = document.getElementById('btn-close-mode-dialog');
const btnPopoutDrawAction = document.getElementById('btn-popout-draw-action');
const popoutRegionDesc = document.getElementById('popout-region-desc');
const windowPickerBox = document.getElementById('window-picker-box');
const selectWindowPicker = document.getElementById('select-window-picker');

const cardAudio = document.getElementById('card-audio');
const labelAudio = document.getElementById('label-audio');
const popoutAudioOverlay = document.getElementById('popout-audio-overlay');
const btnCloseAudioDialog = document.getElementById('btn-close-audio-dialog');
const checkSystemAudio = document.getElementById('check-system-audio');
const checkMic = document.getElementById('check-mic');
const selectMicSource = document.getElementById('select-mic-source');
const cardLedMeter = document.getElementById('card-led-meter');

const cardFormat = document.getElementById('card-format');
const labelFormat = document.getElementById('label-format');
const popoutFormatOverlay = document.getElementById('popout-format-overlay');
const btnCloseFormatDialog = document.getElementById('btn-close-format-dialog');
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

// Dialog Open / Close Helpers
function closeAllPopouts() {
  popoutModeOverlay.classList.remove('open');
  popoutAudioOverlay.classList.remove('open');
  popoutFormatOverlay.classList.remove('open');
}

cardMode.addEventListener('click', () => {
  closeAllPopouts();
  popoutModeOverlay.classList.add('open');
});

cardAudio.addEventListener('click', () => {
  closeAllPopouts();
  popoutAudioOverlay.classList.add('open');
});

cardFormat.addEventListener('click', () => {
  closeAllPopouts();
  popoutFormatOverlay.classList.add('open');
});

btnCloseModeDialog.addEventListener('click', () => popoutModeOverlay.classList.remove('open'));
btnCloseAudioDialog.addEventListener('click', () => popoutAudioOverlay.classList.remove('open'));
btnCloseFormatDialog.addEventListener('click', () => popoutFormatOverlay.classList.remove('open'));

// Close popout on backdrop click
[popoutModeOverlay, popoutAudioOverlay, popoutFormatOverlay].forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('open');
    }
  });
});

// Mode Selection Cards
const modeChoiceCards = document.querySelectorAll('.mode-choice-card');
modeChoiceCards.forEach(card => {
  card.addEventListener('click', (e) => {
    // If clicked the draw area button, handle separately
    if (e.target === btnPopoutDrawAction) return;

    const mode = card.dataset.mode;
    modeChoiceCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    currentMode = mode;

    if (mode === 'fullscreen') {
      labelMode.textContent = 'Full';
      engine.clearRegion();
      windowPickerBox.style.display = 'none';
      popoutModeOverlay.classList.remove('open');
    } else if (mode === 'region') {
      labelMode.textContent = 'Custom';
      windowPickerBox.style.display = 'none';
      popoutModeOverlay.classList.remove('open');
      openRegionSelector();
    } else if (mode === 'window') {
      labelMode.textContent = 'Window';
      engine.clearRegion();
      windowPickerBox.style.display = 'flex';
      populateWindowSources();
    }
  });
});

if (btnPopoutDrawAction) {
  btnPopoutDrawAction.addEventListener('click', (e) => {
    e.stopPropagation();
    currentMode = 'region';
    labelMode.textContent = 'Custom';
    modeChoiceCards.forEach(c => c.classList.remove('active'));
    const regCard = document.querySelector('.mode-choice-card[data-mode="region"]');
    if (regCard) regCard.classList.add('active');
    popoutModeOverlay.classList.remove('open');
    openRegionSelector();
  });
}

function openRegionSelector() {
  if (window.electronAPI) {
    const screenSource = currentSources.find(s => s.id.startsWith('screen:'));
    window.electronAPI.openRegionSelector(screenSource ? screenSource.id : null);
  }
}

async function populateWindowSources() {
  if (window.electronAPI) {
    try {
      currentSources = await window.electronAPI.getSources();
      const windows = currentSources.filter(s => s.id.startsWith('window:'));
      selectWindowPicker.innerHTML = '';
      windows.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w.id;
        opt.textContent = w.name;
        selectWindowPicker.appendChild(opt);
      });
    } catch (e) {}
  }
}

if (window.electronAPI) {
  window.electronAPI.onRegionSelected((region) => {
    if (region) {
      engine.setRegion(region);
      labelMode.textContent = 'Custom';
      popoutRegionDesc.textContent = `${region.width} x ${region.height} px`;
    }
  });

  window.electronAPI.onShortcutRecord(() => {
    handleStartOrStop();
  });

  window.electronAPI.onShortcutPause(() => {
    handlePauseResume();
  });
}

// Audio Configuration
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

// Format Configuration
selectFps.addEventListener('change', () => {
  engine.setOptions({ fps: selectFps.value });
});

selectQuality.addEventListener('change', () => {
  engine.setOptions({ videoBitrate: selectQuality.value });
});

// Slider Controls
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

// Audio VU Meter Callback
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

// Engine Time Sync
engine.onTick = (ms) => {
  const formatted = formatTime(ms);
  footerTimer.textContent = formatted;
  if (engine.state === 'recording') {
    startBtnText.textContent = formatted.slice(3);
  }
};

engine.onStateChange = (state) => {
  if (state === 'recording') {
    btnMainRecord.className = 'start-circle-btn recording';
    footerStatus.style.display = 'flex';
    btnFooterPause.textContent = 'Pause';
  } else if (state === 'paused') {
    btnMainRecord.className = 'start-circle-btn paused';
    startBtnText.textContent = 'Pause';
    btnFooterPause.textContent = 'Resume';
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
      const selectedWinId = selectWindowPicker.value;
      if (selectedWinId) {
        source = currentSources.find(s => s.id === selectedWinId) || source;
      } else {
        source = currentSources.find(s => s.id.startsWith('window:')) || source;
      }
    }

    if (!source && currentSources.length > 0) {
      source = currentSources[0];
    }

    if (!source) {
      alert('No display or window source detected.');
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
    alert('No recording found. Click "Start" to record your screen.');
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

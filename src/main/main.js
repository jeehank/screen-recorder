const { app, BrowserWindow, ipcMain, desktopCapturer, screen, dialog, shell, globalShortcut, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');

// Set ffmpeg path
try {
  const ffmpegStatic = require('ffmpeg-static');
  if (ffmpegStatic) {
    const ffmpegPath = app.isPackaged
      ? path.join(process.resourcesPath, 'bin', 'ffmpeg.exe')
      : ffmpegStatic.replace('app.asar', 'app.asar.unpacked');
    
    if (fs.existsSync(ffmpegPath)) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    } else if (fs.existsSync(ffmpegStatic)) {
      ffmpeg.setFfmpegPath(ffmpegStatic);
    }
  }
} catch (err) {
  console.warn('FFmpeg static path setup warning:', err.message);
}

// Disable default Electron menu bar
Menu.setApplicationMenu(null);

let mainWindow = null;
let regionWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 860,
    height: 440,
    minWidth: 780,
    minHeight: 380,
    title: 'Screen Record HD',
    backgroundColor: '#f4f7fb',
    autoHideMenuBar: true,
    frame: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (regionWindow && !regionWindow.isDestroyed()) {
      regionWindow.close();
    }
  });
}

// Region selector window
function openRegionSelector(displayId) {
  if (regionWindow && !regionWindow.isDestroyed()) {
    regionWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  let targetDisplay = displays[0];
  if (displayId) {
    const found = displays.find(d => String(d.id) === String(displayId));
    if (found) targetDisplay = found;
  }

  const { x, y, width, height } = targetDisplay.bounds;

  regionWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    fullscreen: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  regionWindow.loadFile(path.join(__dirname, '../renderer/region.html'));

  regionWindow.webContents.on('did-finish-load', () => {
    regionWindow.webContents.send('init-region-bounds', {
      bounds: targetDisplay.bounds,
      scaleFactor: targetDisplay.scaleFactor || 1
    });
  });

  regionWindow.on('closed', () => {
    regionWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  createMainWindow();

  // Register Global Shortcuts
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('shortcut-toggle-record');
    }
  });

  globalShortcut.register('CommandOrControl+Shift+P', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('shortcut-toggle-pause');
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('get-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 480, height: 270 },
      fetchWindowIcons: true
    });

    return sources.map(src => ({
      id: src.id,
      name: src.name,
      display_id: src.display_id,
      thumbnail: src.thumbnail.toDataURL()
    }));
  } catch (error) {
    console.error('Error fetching sources:', error);
    throw error;
  }
});

ipcMain.handle('get-displays', () => {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  return {
    displays: displays.map(d => ({
      id: d.id,
      bounds: d.bounds,
      scaleFactor: d.scaleFactor,
      isPrimary: d.id === primary.id
    })),
    primaryId: primary.id
  };
});

ipcMain.handle('open-region-selector', (event, displayId) => {
  openRegionSelector(displayId);
  return true;
});

ipcMain.handle('close-region-selector', () => {
  if (regionWindow && !regionWindow.isDestroyed()) {
    regionWindow.close();
  }
  return true;
});

ipcMain.on('region-selected', (event, region) => {
  if (regionWindow && !regionWindow.isDestroyed()) {
    regionWindow.close();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('on-region-selected', region);
  }
});

ipcMain.handle('get-user-paths', () => {
  const videosPath = app.getPath('videos') || path.join(os.homedir(), 'Videos');
  return {
    videosPath,
    homedir: os.homedir()
  };
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('select-save-path', async (event, defaultName = 'recording.mp4') => {
  const defaultDir = app.getPath('videos') || os.homedir();
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save MP4 Recording',
    defaultPath: path.join(defaultDir, defaultName),
    filters: [
      { name: 'MP4 Video', extensions: ['mp4'] }
    ]
  });

  return result.canceled ? null : result.filePath;
});

ipcMain.handle('convert-to-mp4', async (event, { tempBuffer, outputFilePath, fps = 30 }) => {
  const tempWebmPath = path.join(app.getPath('temp'), `rec_${Date.now()}.webm`);
  
  try {
    // Write the buffer to temp webm
    fs.writeFileSync(tempWebmPath, Buffer.from(tempBuffer));

    return new Promise((resolve, reject) => {
      ffmpeg(tempWebmPath)
        .outputOptions([
          '-c:v libx264',
          '-preset ultrafast',
          '-crf 18',
          '-pix_fmt yuv420p',
          '-c:a aac',
          '-b:a 192k',
          '-movflags +faststart'
        ])
        .output(outputFilePath)
        .on('start', (cmd) => {
          console.log('FFmpeg started with:', cmd);
        })
        .on('progress', (progress) => {
          if (mainWindow && !mainWindow.isDestroyed() && progress.percent) {
            mainWindow.webContents.send('conversion-progress', Math.round(progress.percent));
          }
        })
        .on('end', () => {
          try {
            if (fs.existsSync(tempWebmPath)) fs.unlinkSync(tempWebmPath);
          } catch (e) {}
          resolve({ success: true, path: outputFilePath });
        })
        .on('error', (err) => {
          console.error('FFmpeg Conversion Error:', err);
          // If ffmpeg fails, fallback to directly copying or remuxing
          try {
            if (fs.existsSync(tempWebmPath)) fs.unlinkSync(tempWebmPath);
          } catch (e) {}
          reject(new Error(err.message || 'FFmpeg conversion failed'));
        })
        .run();
    });
  } catch (err) {
    if (fs.existsSync(tempWebmPath)) {
      try { fs.unlinkSync(tempWebmPath); } catch (e) {}
    }
    throw err;
  }
});

ipcMain.handle('show-in-folder', async (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('open-file', async (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.openPath(filePath);
    return true;
  }
  return false;
});

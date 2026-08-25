const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  openRegionSelector: (displayId) => ipcRenderer.invoke('open-region-selector', displayId),
  closeRegionSelector: () => ipcRenderer.invoke('close-region-selector'),
  sendRegionSelected: (region) => ipcRenderer.send('region-selected', region),
  getUserPaths: () => ipcRenderer.invoke('get-user-paths'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectSavePath: (defaultName) => ipcRenderer.invoke('select-save-path', defaultName),
  convertToMp4: (data) => ipcRenderer.invoke('convert-to-mp4', data),
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),

  // Events listeners
  onInitRegionBounds: (callback) => {
    ipcRenderer.on('init-region-bounds', (event, data) => callback(data));
  },
  onRegionSelected: (callback) => {
    ipcRenderer.on('on-region-selected', (event, data) => callback(data));
  },
  onConversionProgress: (callback) => {
    ipcRenderer.on('conversion-progress', (event, percent) => callback(percent));
  },
  onShortcutRecord: (callback) => {
    ipcRenderer.on('shortcut-toggle-record', () => callback());
  },
  onShortcutPause: (callback) => {
    ipcRenderer.on('shortcut-toggle-pause', () => callback());
  }
});

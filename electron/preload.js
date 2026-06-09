const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls (send — fire and forget)
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow:    () => ipcRenderer.send('window-close'),

  // Maximize state change listener
  onMaximizeChange: (callback) => ipcRenderer.on('maximize-change', callback),

  // Legacy invoke-based controls (used by existing app pages)
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close:    () => ipcRenderer.invoke('window:close'),

  // File dialogs
  openDirectory: ()          => ipcRenderer.invoke('dialog:openDirectory'),
  saveFile:      (options)   => ipcRenderer.invoke('dialog:saveFile', options),
  openPath:      (filePath)  => ipcRenderer.invoke('shell:openPath', filePath),
  getVersion:    ()          => ipcRenderer.invoke('app:getVersion'),
})

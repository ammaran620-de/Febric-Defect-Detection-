const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const { spawn, execSync } = require('child_process')
const fs = require('fs')

let mainWindow = null
let pythonProcess = null
const isDev = process.env.NODE_ENV !== 'production'

function killPortProcess(port) {
  try {
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] })
      const pids = new Set()
      result.split('\n').forEach(line => {
        const m = line.trim().match(/LISTENING\s+(\d+)$/)
        if (m) pids.add(m[1])
      })
      pids.forEach(pid => {
        try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' }) } catch {}
      })
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'pipe' })
    }
  } catch {}
}

function startPythonBackend() {
  const backendPath = path.join(__dirname, '..', 'backend')
  const pythonExe = process.platform === 'win32' ? 'python' : 'python3'

  killPortProcess(8000)
  console.log('[Electron] Starting Python backend...')

  pythonProcess = spawn(pythonExe, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: backendPath,
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
  })

  pythonProcess.stdout.on('data', d => console.log(`[Backend] ${d.toString().trim()}`))
  pythonProcess.stderr.on('data', d => console.error(`[Backend ERR] ${d.toString().trim()}`))
  pythonProcess.on('close', code => console.log(`[Backend] exited ${code}`))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    backgroundColor: '#264C59',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
  })

  const url = isDev
    ? 'http://localhost:5174'
    : `file://${path.join(__dirname, '../dist/index.html')}`

  mainWindow.loadURL(url)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' })
  })

  mainWindow.on('maximize', () => mainWindow.webContents.send('maximize-change', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('maximize-change', false))
  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  startPythonBackend()
  setTimeout(createWindow, 2000)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (pythonProcess) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${pythonProcess.pid}`, { stdio: 'pipe' })
      } else {
        process.kill(-pythonProcess.pid, 'SIGKILL')
      }
    } catch { pythonProcess.kill() }
  }
  killPortProcess(8000)
  if (process.platform !== 'darwin') app.quit()
})

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window-close', () => mainWindow?.close())

// Legacy invoke handlers (used by existing app pages)
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  return result.filePaths[0] || null
})
ipcMain.handle('dialog:saveFile', async (event, { defaultPath, filters }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath,
    filters: filters || [{ name: 'CSV Files', extensions: ['csv'] }],
  })
  return result.filePath || null
})
ipcMain.handle('shell:openPath', async (event, filePath) => { await shell.openPath(filePath) })
ipcMain.handle('app:getVersion', () => app.getVersion())
ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('window:close', () => mainWindow?.close())

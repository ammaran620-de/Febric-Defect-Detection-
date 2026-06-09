#!/usr/bin/env node
// Launches electron.exe with ELECTRON_RUN_AS_NODE removed from env
const { spawn } = require('child_process')
const path = require('path')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const electronExe = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'electron.exe')

const child = spawn(electronExe, ['.'], {
  cwd: path.join(__dirname, '..'),
  env,
  stdio: 'inherit',
  windowsHide: false,
})

child.on('close', code => process.exit(code || 0))

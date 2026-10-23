#!/usr/bin/env node
// Start the NIR producer with the project's isolated Python env. Extra arguments go to serve.py:
//   node nir-serving/run.js                  live detection using nir-serving/config.json
//   node nir-serving/run.js replay           camera-free smoke test
//   node nir-serving/run.js --confidence 0.4 override a setting for this run
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const VENV = path.join(__dirname, '.venv');
const PY = process.platform === 'win32' ? path.join(VENV, 'Scripts', 'python.exe') : path.join(VENV, 'bin', 'python');

if (!fs.existsSync(PY)) {
  console.error('Python environment not found. Run first:  node nir-serving/setup.js');
  process.exit(1);
}

const child = spawn(PY, [path.join(__dirname, 'serve.py'), ...process.argv.slice(2)], { stdio: 'inherit' });
process.on('SIGINT', () => {}); // Ctrl+C reaches serve.py too; let it shut down cleanly
child.on('exit', (code) => process.exit(code === null ? 1 : code));

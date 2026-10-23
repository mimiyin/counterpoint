#!/usr/bin/env node
// One-time setup for the NIR producer. Safe to re-run: finished steps are skipped.
//   node nir-serving/setup.js              auto-detect NVIDIA GPU
//   node nir-serving/setup.js --cpu        force CPU-only PyTorch
//   node nir-serving/setup.js --cuda cu126 force a specific CUDA build of PyTorch
//
// 1. Node packages for the sandbox server   2. uv (installed on request)
// 3. isolated Python env in nir-serving/.venv   4. PyTorch (CUDA or CPU) + requirements
// 5. checks that the model weights are in place
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

const HERE = __dirname;
const SANDBOX = path.join(HERE, '..', 'sandbox');
const VENV = path.join(HERE, '.venv');
const WIN = process.platform === 'win32';
const MAC = process.platform === 'darwin';
const PY = WIN ? path.join(VENV, 'Scripts', 'python.exe') : path.join(VENV, 'bin', 'python');
const WEIGHTS = path.join(HERE, 'weights', 'pL1_MWHB1024_Mar11_4000.ckpt');
const WEIGHTS_URL = 'https://drive.google.com/drive/folders/1vjXdGT9oiqAUCPA6TDGyumSLaI-vW11I';

const args = process.argv.slice(2);
const forceCpu = args.includes('--cpu');
const forcedCuda = args.includes('--cuda') ? args[args.indexOf('--cuda') + 1] : null;

const step = (msg) => console.log(`\n==> ${msg}`);
function fail(msg) {
  console.error(`\nERROR: ${msg}`);
  process.exit(1);
}
function run(cmd, cmdArgs, opts = {}) {
  const res = spawnSync(cmd, cmdArgs, { stdio: 'inherit', ...opts });
  if (res.error || res.status !== 0) fail(`command failed: ${cmd} ${cmdArgs.join(' ')}`);
}
function capture(cmd, cmdArgs) {
  const res = spawnSync(cmd, cmdArgs, { encoding: 'utf8' });
  return { ok: !res.error && res.status === 0, out: (res.stdout || '').trim() };
}
function ask(question) {
  if (!process.stdin.isTTY) return Promise.resolve(false);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => {
    rl.close();
    resolve(!/^n/i.test(a.trim()));
  }));
}

function findUv() {
  if (capture('uv', ['--version']).ok) return 'uv';
  const names = WIN ? ['uv.exe'] : ['uv'];
  for (const dir of [path.join(os.homedir(), '.local', 'bin'), path.join(os.homedir(), '.cargo', 'bin')]) {
    for (const name of names) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

async function ensureUv() {
  let uv = findUv();
  if (uv) return uv;
  console.log('uv (Python package manager) was not found.');
  const manual = WIN
    ? 'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"'
    : 'curl -LsSf https://astral.sh/uv/install.sh | sh';
  console.log(`Official installer: ${manual}`);
  if (!(await ask('Run it now? [Y/n] '))) fail('install uv (https://docs.astral.sh/uv/), then re-run this script.');
  if (WIN) run('powershell', ['-NoProfile', '-ExecutionPolicy', 'ByPass', '-Command', 'irm https://astral.sh/uv/install.ps1 | iex']);
  else run('sh', ['-c', 'curl -LsSf https://astral.sh/uv/install.sh | sh']);
  uv = findUv();
  if (!uv) fail('uv was installed but cannot be found. Open a new terminal and re-run this script.');
  return uv;
}

// Pick the PyTorch wheel index. Returns { index: url|null, label }.
function chooseTorch() {
  const cpu = { index: MAC ? null : 'https://download.pytorch.org/whl/cpu', label: 'CPU' };
  if (forceCpu) return cpu;
  if (forcedCuda) return { index: `https://download.pytorch.org/whl/${forcedCuda}`, label: `CUDA (${forcedCuda}, forced)` };
  if (MAC) return cpu;
  const smi = capture('nvidia-smi', ['--query-gpu=name,driver_version', '--format=csv,noheader']);
  if (!smi.ok || !smi.out) {
    console.log('No NVIDIA GPU detected (nvidia-smi not found): installing the CPU build. Detection will be slow.');
    return cpu;
  }
  const [name, driver] = smi.out.split('\n')[0].split(',').map((s) => s.trim());
  const major = parseInt(driver, 10);
  console.log(`NVIDIA GPU: ${name}, driver ${driver}`);
  if (major >= 570) return { index: 'https://download.pytorch.org/whl/cu128', label: 'CUDA 12.8' };
  if (major >= 525) return { index: 'https://download.pytorch.org/whl/cu126', label: 'CUDA 12.6' };
  console.log('NVIDIA driver is too old for current PyTorch CUDA builds; update it for GPU speed. Installing the CPU build.');
  return cpu;
}

(async () => {
  console.log(`Platform: ${process.platform} ${process.arch}, Node ${process.version}`);
  if (parseInt(process.versions.node, 10) < 18) fail('Node 18 or newer is required.');

  step('1/5 Node packages (sandbox)');
  if (fs.existsSync(path.join(SANDBOX, 'node_modules', 'express'))) console.log('already installed');
  else run('npm', ['install'], { cwd: SANDBOX, shell: true });

  step('2/5 uv');
  const uv = await ensureUv();
  console.log(capture(uv, ['--version']).out);

  step('3/5 Python environment (nir-serving/.venv)');
  if (fs.existsSync(PY)) console.log('already exists');
  else run(uv, ['venv', VENV, '--python', '3.11']);

  step('4/5 PyTorch + dependencies');
  const torch = chooseTorch();
  console.log(`PyTorch build: ${torch.label} (large download, a few GB for CUDA)`);
  run(uv, ['pip', 'install', '--python', PY, 'torch', ...(torch.index ? ['--index-url', torch.index] : [])]);
  run(uv, ['pip', 'install', '--python', PY, '-r', path.join(HERE, 'requirements.txt')]);
  const check = capture(PY, ['-c', 'import torch, cv2, numpy; print(torch.__version__, "cuda=" + str(torch.cuda.is_available()))']);
  if (!check.ok) fail('Python packages did not import correctly.');
  console.log(`torch ${check.out}`);
  if (torch.label.startsWith('CUDA') && !check.out.includes('cuda=True')) {
    console.log('WARNING: a CUDA build was installed but CUDA is not available. Detection will fall back to CPU (slow).');
  }

  step('5/5 Model weights');
  fs.mkdirSync(path.dirname(WEIGHTS), { recursive: true });
  const ok = fs.existsSync(WEIGHTS) && fs.statSync(WEIGHTS).size > 100 * 1024 * 1024;
  if (ok) console.log('found ' + path.relative(process.cwd(), WEIGHTS));
  else {
    console.log('MISSING: nir-serving/weights/pL1_MWHB1024_Mar11_4000.ckpt (about 246 MB)');
    console.log(`Download it by hand from: ${WEIGHTS_URL}`);
    console.log('and put it in nir-serving/weights/ . Not needed for the camera-free test (replay).');
  }

  console.log('\nSetup finished. Next:');
  console.log('  terminal 1:  cd sandbox && node server.js');
  console.log('  terminal 2:  node nir-serving/run.js');
  console.log('  browser:     http://localhost:8001/nir-tracking/configure.html');
})();

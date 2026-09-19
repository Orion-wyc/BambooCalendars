const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BOOTSTRAP = path.join(__dirname, 'bootstrap.cjs');
const TIMEOUT_MS = Number(process.env.E2E_TIMEOUT || 120000);

function resolveElectron() {
  try {
    const binary = require('electron');
    if (typeof binary === 'string' && binary) return binary;
  } catch {}
  const local = path.join(REPO_ROOT, 'node_modules', 'electron', 'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron');
  if (fs.existsSync(local)) return local;
  return null;
}

function hasXvfb() {
  return spawnSync('which', ['xvfb-run'], { stdio: 'ignore' }).status === 0;
}

function prepareUserData() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bamboo-e2e-'));
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'data', 'app-state.json'), JSON.stringify({
    alwaysOnTop: false,
    compactMode: false,
    requestExitConfirmation: true,
    checkUpdateOnStartup: false,
  }));
  return dir;
}

function launch(electron, userData) {
  const args = [BOOTSTRAP, '--no-sandbox', `--user-data-dir=${userData}`];
  const needXvfb = !process.env.DISPLAY && process.platform === 'linux' && hasXvfb();
  const cmd = needXvfb ? 'xvfb-run' : electron;
  const fullArgs = needXvfb ? ['-a', electron, ...args] : args;
  return { child: spawn(cmd, fullArgs, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] }), needXvfb };
}

function report(payload, stdout, code) {
  if (!payload) {
    console.log('FAIL  未获取到冒烟结果（进程退出码 ' + code + '）');
    console.log(stdout.slice(-3000));
    return 1;
  }
  payload.results.forEach(r => {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.extra ? ' → ' + r.extra : ''}`);
  });
  if (payload.warnings && payload.warnings.length) {
    console.log('\n开发模式告警（不计入失败）:');
    payload.warnings.forEach(w => console.log('  ' + w));
  }
  if (payload.errors && payload.errors.length) {
    console.log('\n控制台错误:');
    payload.errors.forEach(e => console.log('  ' + e));
  }
  const quitOk = /SMOKE_QUIT_OK (\d+)ms/.exec(stdout);
  const quitTimeout = /SMOKE_QUIT_TIMEOUT/.test(stdout);
  console.log(`${quitOk ? 'PASS' : 'FAIL'}  BUG-01 app.quit() 正常退出${quitOk ? '（' + quitOk[1] + 'ms）' : ''}`);
  if (quitTimeout) console.log('  → 进程未能在超时内退出');

  const fail = payload.fail + (quitOk ? 0 : 1) + (payload.errors && payload.errors.length ? 1 : 0);
  console.log(`\n[Electron 端到端] 共 ${payload.results.length + 1} 项，失败 ${fail} 项`);
  return fail ? 1 : 0;
}

function main() {
  const electron = resolveElectron();
  if (!electron) {
    console.log('SKIP  未找到 electron 可执行文件，跳过端到端测试（请先 npm install）');
    process.exit(0);
  }

  const userData = prepareUserData();
  const { child, needXvfb } = launch(electron, userData);
  console.log(`启动 Electron 端到端测试（${needXvfb ? 'xvfb-run ' : ''}userData=${userData}）\n`);

  let stdout = '';
  let stderr = '';
  let settled = false;
  child.stdout.on('data', d => { stdout += d; });
  child.stderr.on('data', d => { stderr += d; });

  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    child.kill('SIGKILL');
    console.log('FAIL  端到端测试超时被强制终止');
    console.log((stdout + stderr).slice(-3000));
    process.exit(1);
  }, TIMEOUT_MS);

  child.on('close', (code) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    const match = /SMOKE_RESULT (\{.*\})/.exec(stdout);
    let payload = null;
    if (match) {
      try { payload = JSON.parse(match[1]); } catch {}
    }
    const failures = report(payload, stdout + stderr, code);
    fs.rmSync(userData, { recursive: true, force: true });
    process.exit(failures || code !== 0 ? 1 : 0);
  });
}

main();

const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BOOTSTRAP = path.join(__dirname, 'bootstrap-migration.cjs');
const TIMEOUT_MS = Number(process.env.E2E_TIMEOUT || 90000);

const FIXTURE = {
  lists: [
    { id: 'tasks', name: '任务', createdAt: 1000, order: 0 },
    { id: 'work', name: '工作', createdAt: 2000, order: 1 },
  ],
  tags: [{ id: 'tag1', name: '紧急', color: '#ff0000' }],
  tasks: [
    {
      id: 't1', listId: 'work', title: '任务一', note: '备注', completed: false,
      important: true, inMyDay: true, priority: 1, tags: ['tag1'],
      dueDate: '2026-09-20', repeat: 'daily',
      subtasks: [{ id: 's1', title: '步骤1', completed: true }],
      createdAt: 100, updatedAt: 200, order: 5,
    },
    { id: 't2', listId: 'tasks', title: '任务二', completed: true, completedAt: 300, createdAt: 110, updatedAt: 120 },
  ],
  settings: { theme: 'default', sortBy: 'created' },
};

const USER_THEMES = [{ id: 'u1', name: '自定义主题', colors: { primary: '#123456', accent: '#654321', secondary: '#333333' } }];

function resolveElectron() {
  try {
    const binary = require('electron');
    if (typeof binary === 'string' && binary) return binary;
  } catch {}
  const local = path.join(REPO_ROOT, 'node_modules', 'electron', 'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron');
  return fs.existsSync(local) ? local : null;
}

function hasXvfb() {
  return spawnSync('which', ['xvfb-run'], { stdio: 'ignore' }).status === 0;
}

function prepareUserData({ withJson, withThemes }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bamboo-mig-'));
  const data = path.join(dir, 'data');
  fs.mkdirSync(data, { recursive: true });
  fs.writeFileSync(path.join(data, 'app-state.json'), JSON.stringify({
    alwaysOnTop: false, compactMode: false, requestExitConfirmation: true, checkUpdateOnStartup: false,
  }));
  if (withJson) fs.writeFileSync(path.join(data, 'store.json'), JSON.stringify(FIXTURE, null, 2));
  if (withThemes) fs.writeFileSync(path.join(data, 'user-themes.json'), JSON.stringify(USER_THEMES));
  return dir;
}

function launch(electron, userData, scenario) {
  const args = [BOOTSTRAP, '--no-sandbox', `--user-data-dir=${userData}`];
  const needXvfb = !process.env.DISPLAY && process.platform === 'linux' && hasXvfb();
  const cmd = needXvfb ? 'xvfb-run' : electron;
  const fullArgs = needXvfb ? ['-a', electron, ...args] : args;
  return new Promise((resolve) => {
    const child = spawn(cmd, fullArgs, {
      cwd: REPO_ROOT,
      env: { ...process.env, MIG_SCENARIO: scenario },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', () => {});
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      const match = /MIGRATION_RESULT (\{.*\})/.exec(stdout);
      let payload = null;
      try { payload = match ? JSON.parse(match[1]) : null; } catch {}
      resolve({ payload, code, stdout });
    });
  });
}

async function main() {
  const electron = resolveElectron();
  if (!electron) {
    console.log('SKIP  未找到 electron，跳过迁移端到端测试');
    process.exit(0);
  }

  let failed = 0;
  const runScenario = async (name, userData, scenario) => {
    console.log(`\n--- 迁移 e2e 场景: ${name} ---`);
    const { payload, code, stdout } = await launch(electron, userData, scenario);
    if (!payload) {
      console.log(`FAIL  场景 ${name} 未产出结果（退出码 ${code}）`);
      console.log(stdout.slice(-1500));
      failed += 1;
      return false;
    }
    payload.results.forEach(r => console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.extra ? ' → ' + r.extra : ''}`));
    (payload.errors || []).forEach(e => console.log('  ERR ' + e));
    const fail = payload.fail + (payload.errors && payload.errors.length ? 1 : 0);
    failed += fail;
    return fail === 0;
  };

  // 场景 1+2：迁移 → 冲突（同一 userData 连续两次启动）
  const dir1 = prepareUserData({ withJson: true, withThemes: true });
  await runScenario('migrate（旧版 json 覆盖安装）', dir1, 'migrate');
  fs.writeFileSync(path.join(dir1, 'data', 'store.json'), JSON.stringify(FIXTURE, null, 2));
  await runScenario('conflict（db 有数据且 json 再现）', dir1, 'conflict');
  fs.rmSync(dir1, { recursive: true, force: true });

  // 场景 3：全新安装
  const dir2 = prepareUserData({ withJson: false, withThemes: false });
  await runScenario('fresh（全新安装）', dir2, 'fresh');
  fs.rmSync(dir2, { recursive: true, force: true });

  console.log(`\n[迁移端到端] 失败 ${failed} 项`);
  process.exit(failed ? 1 : 0);
}

main();

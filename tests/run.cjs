const { spawnSync } = require('child_process');
const path = require('path');

const HERE = __dirname;
const TIMEZONES = ['Asia/Shanghai', 'UTC', 'America/New_York', 'Pacific/Kiritimati'];

const jobs = [];
TIMEZONES.forEach(tz => jobs.push({
  name: `store.test.mjs (TZ=${tz})`,
  cmd: process.execPath,
  args: [path.join(HERE, 'store.test.mjs')],
  env: { ...process.env, TZ: tz },
}));
['components.test.mjs', 'app.test.mjs', 'migration.test.mjs'].forEach(file => jobs.push({
  name: file,
  cmd: process.execPath,
  args: [path.join(HERE, file)],
  env: { ...process.env, TZ: process.env.TZ || 'Asia/Shanghai' },
}));
if (!process.env.SKIP_E2E) {
  jobs.push({
    name: 'e2e/run.cjs (Electron + xvfb)',
    cmd: process.execPath,
    args: [path.join(HERE, 'e2e', 'run.cjs')],
    env: process.env,
  });
  jobs.push({
    name: 'e2e/migration-run.cjs (JSON→SQLite 迁移演练)',
    cmd: process.execPath,
    args: [path.join(HERE, 'e2e', 'migration-run.cjs')],
    env: process.env,
  });
}

let failed = 0;
jobs.forEach(job => {
  console.log(`\n${'='.repeat(60)}\n▶ ${job.name}\n${'='.repeat(60)}`);
  const res = spawnSync(job.cmd, job.args, { stdio: 'inherit', env: job.env, cwd: path.join(HERE, '..') });
  if (res.status !== 0) {
    failed += 1;
    console.log(`✖ ${job.name} 失败（退出码 ${res.status}）`);
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log(failed === 0
  ? `全部 ${jobs.length} 个测试任务通过`
  : `${jobs.length} 个测试任务中有 ${failed} 个失败`);
process.exit(failed === 0 ? 0 : 1);

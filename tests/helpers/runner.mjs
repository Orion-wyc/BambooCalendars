export function createSuite(title) {
  const cases = [];
  const results = [];

  function test(name, fn) {
    cases.push({ name, fn });
  }

  async function run() {
    for (const c of cases) {
      try {
        await c.fn();
        results.push({ name: c.name, pass: true });
      } catch (e) {
        results.push({
          name: c.name,
          pass: false,
          error: String((e && e.message) || e).trim().replace(/\s*\n\s*/g, ' '),
        });
      }
    }
    return report();
  }

  function report() {
    const tz = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
    results.forEach(r => {
      console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.error ? ' → ' + r.error : ''}`);
    });
    const failed = results.filter(r => !r.pass).length;
    console.log(`\n[${title}] TZ=${tz} 共 ${results.length} 项，失败 ${failed} 项`);
    return failed;
  }

  return { test, run, results };
}

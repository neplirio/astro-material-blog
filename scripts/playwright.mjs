import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
// Keep browser binaries in this project, including on CI.
const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', ...(process.argv.length > 2 ? process.argv.slice(2) : ['test'])], {
  stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: resolve('.playwright'), ASTRO_TELEMETRY_DISABLED: '1' },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);

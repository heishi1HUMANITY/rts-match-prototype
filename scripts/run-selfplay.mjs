import { spawnSync } from 'node:child_process';

const seedCount = process.env.SELFPLAY_SEEDS ?? '100';
console.log(`Running selfplay ${seedCount} seeds test...`);
const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

const result = spawnSync(
  npxCmd,
  ['vitest', 'run', 'src/selfplay.report.test.ts'],
  {
    stdio: 'inherit',
    shell: isWindows,
    env: {
      ...process.env,
      SELFPLAY: '1',
    },
  },
);

process.exit(result.status ?? 1);

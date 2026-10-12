import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
let commit = 'unknown';
let dirty = true;
try {
  commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  dirty =
    execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().length > 0;
} catch {
  // A source archive can still build, but cannot claim an identified clean revision.
}
const config = readFileSync(
  join(projectRoot, 'src/simulation/config.ts'),
  'utf8',
);
const rules = readFileSync(
  join(projectRoot, 'src/simulation/rules.ts'),
  'utf8',
);
const schemaVersion = Number(
  config.match(/export const SCHEMA_VERSION = (\d+) as const/)?.[1],
);
const rulesVersion = rules.match(
  /export const RULES_VERSION = '([^']+)' as const/,
)?.[1];
if (!Number.isSafeInteger(schemaVersion) || rulesVersion === undefined)
  throw new Error(
    'Unable to read schemaVersion/rulesVersion from simulation source',
  );
const info = { commit, dirty, rulesVersion, schemaVersion };
const json = JSON.stringify(info, null, 2) + '\n';
if (process.argv.includes('--write')) {
  mkdirSync(join(projectRoot, 'dist'), { recursive: true });
  writeFileSync(join(projectRoot, 'dist', 'build-info.json'), json);
} else {
  process.stdout.write(json);
}

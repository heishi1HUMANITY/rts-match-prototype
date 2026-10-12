import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
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
const info = { commit, dirty, rulesVersion: 'f03-v1', schemaVersion: 8 };
const json = JSON.stringify(info, null, 2) + '\n';
if (process.argv.includes('--write')) {
  mkdirSync(join(projectRoot, 'dist'), { recursive: true });
  writeFileSync(join(projectRoot, 'dist', 'build-info.json'), json);
} else {
  process.stdout.write(json);
}

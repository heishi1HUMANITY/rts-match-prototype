import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(
  await readFile(
    path.join(root, 'docs/project/reference-manifest.json'),
    'utf8',
  ),
);
const failures = [];
for (const entry of manifest.files) {
  try {
    const bytes = await readFile(path.join(root, entry.path));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== entry.sha256) failures.push(entry.path);
  } catch {
    failures.push(entry.path);
  }
}
// Report new unregistered reference files as well as modifications/deletions.
const known = new Set(manifest.files.map((entry) => entry.path));
async function scan(directory) {
  for (const entry of await readdir(path.join(root, directory), {
    withFileTypes: true,
  })) {
    const relative = directory + '/' + entry.name;
    if (
      relative === 'docs/project' ||
      relative === 'docs/video' ||
      entry.name.includes('Zone.Identifier')
    )
      continue;
    if (entry.isDirectory()) await scan(relative);
    else if (!known.has(relative)) failures.push(relative + ' (unregistered)');
  }
}
await scan('docs');
await scan('artwork');
if (failures.length) {
  console.error(
    'Reference snapshot changed; record the reason before updating the manifest:\n' +
      failures.join('\n'),
  );
  process.exitCode = 1;
} else {
  console.log(`Verified ${manifest.files.length} inherited reference files.`);
}

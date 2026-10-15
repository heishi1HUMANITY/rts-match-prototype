import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { checkSpecs } from './check-specs.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'rts-specs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'docs/project/specs'), { recursive: true });
  await mkdir(path.join(root, 'src'));
  const write = (name, text) => writeFile(path.join(root, name), text);
  await write('src/rule.ts', 'export const rule = 1;\n');
  await write('docs/project/specs/README.md', '[TEST](TEST.md)\n');
  await write(
    'docs/project/specs/TEST.md',
    '# TEST: fixture\n[code](../../../src/rule.ts)\n',
  );
  await write(
    'docs/project/specs/registry.json',
    JSON.stringify({
      schemaVersion: 1,
      specs: [
        {
          id: 'TEST',
          features: Array.from(
            { length: 21 },
            (_, i) => `F${String(i + 1).padStart(2, '0')}`,
          ),
          document: 'docs/project/specs/TEST.md',
          sources: { 'src/rule.ts': '' },
        },
      ],
    }),
  );
  assert.deepEqual(await checkSpecs(root, ['TEST']), []);
  return { root, write };
}

test('detects code drift; review records only explicit valid IDs and normalizes CRLF', async (t) => {
  const { root, write } = await fixture(t);
  await write('src/rule.ts', 'export const rule = 1;\r\n');
  assert.deepEqual(await checkSpecs(root), []);
  await write('src/rule.ts', 'export const rule = 2;\n');
  assert.match((await checkSpecs(root)).join('\n'), /要仕様確認 TEST/);
  const before = await readFile(
    path.join(root, 'docs/project/specs/registry.json'),
    'utf8',
  );
  assert.match(
    (await checkSpecs(root, ['UNKNOWN'])).join('\n'),
    /未知の仕様ID/,
  );
  assert.equal(
    await readFile(path.join(root, 'docs/project/specs/registry.json'), 'utf8'),
    before,
  );
  assert.deepEqual(await checkSpecs(root, ['TEST']), []);
  assert.deepEqual(await checkSpecs(root), []);
});

test('detects broken links and anchors, and refuses to review with broken references', async (t) => {
  const { root, write } = await fixture(t);
  await write(
    'docs/project/specs/TEST.md',
    '# TEST: fixture\n[x](missing.md)\n[y](TEST.md#missing)\n',
  );
  const errors = (await checkSpecs(root, ['TEST'])).join('\n');
  assert.match(errors, /リンク切れ/);
  assert.match(errors, /明示アンカーなし/);
});

test('detects unassigned production files and renamed source files', async (t) => {
  const { root, write } = await fixture(t);
  await write('src/new.ts', 'export {};');
  assert.match(
    (await checkSpecs(root)).join('\n'),
    /本番ファイルの仕様割当なし: src\/new.ts/,
  );
  await rm(path.join(root, 'src/rule.ts'));
  assert.match((await checkSpecs(root)).join('\n'), /実装参照先なし TEST/);
});

test('detects missing feature assignments, duplicate IDs, and missing entry links', async (t) => {
  const { root, write } = await fixture(t);
  const registry = JSON.parse(
    await readFile(path.join(root, 'docs/project/specs/registry.json'), 'utf8'),
  );
  registry.specs[0].features.pop();
  registry.specs.push(registry.specs[0]);
  await write('docs/project/specs/registry.json', JSON.stringify(registry));
  await write('docs/project/specs/README.md', '# Empty');
  const errors = (await checkSpecs(root)).join('\n');
  assert.match(errors, /機能の仕様割当なし: F21/);
  assert.match(errors, /重複仕様ID/);
  assert.match(errors, /入口に仕様リンクなし/);
});

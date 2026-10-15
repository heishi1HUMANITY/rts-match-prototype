import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const registryPath = 'docs/project/specs/registry.json';
const specDirectory = 'docs/project/specs';
const digest = (text) =>
  createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');

async function filesBelow(root, directory) {
  const files = [];
  for (const entry of await readdir(path.join(root, directory), {
    withFileTypes: true,
  })) {
    const name = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await filesBelow(root, name)));
    else files.push(name);
  }
  return files;
}

function resolveLocal(root, relative) {
  const resolved = path.resolve(root, relative);
  const inside = path.relative(root, resolved);
  if (inside.startsWith('..') || path.isAbsolute(inside))
    throw new Error(`Repository外のパス: ${relative}`);
  return resolved;
}

export async function checkSpecs(root, reviewIds = []) {
  const registry = JSON.parse(
    await readFile(path.join(root, registryPath), 'utf8'),
  );
  if (registry.schemaVersion !== 2 || !Array.isArray(registry.specs))
    throw new Error('Invalid specs registry schema');
  const failures = [];
  const ids = new Set();
  const names = new Set();
  const docs = new Set();
  const coveredSources = new Set();
  const reviewed = new Set(reviewIds);
  for (const id of reviewed)
    if (!registry.specs.some((entry) => entry.id === id))
      failures.push(`未知の仕様キー: ${id}`);

  for (const entry of registry.specs) {
    if (ids.has(entry.id)) failures.push(`重複仕様キー: ${entry.id}`);
    ids.add(entry.id);
    if (typeof entry.name !== 'string' || !entry.name.trim())
      failures.push(`機能名なし: ${entry.id}`);
    if (names.has(entry.name)) failures.push(`重複機能名: ${entry.name}`);
    names.add(entry.name);
    if (docs.has(entry.document)) failures.push(`重複文書: ${entry.document}`);
    docs.add(entry.document);
    if (!entry.document.startsWith(`${specDirectory}/`))
      failures.push(`仕様ディレクトリ外: ${entry.document}`);
    try {
      const text = await readFile(resolveLocal(root, entry.document), 'utf8');
      if (text.replace(/\r\n/g, '\n').split('\n')[0] !== `# ${entry.name}`)
        failures.push(`文書先頭の機能名が不一致: ${entry.document}`);
    } catch (error) {
      failures.push(`仕様参照先なし: ${entry.document} (${error.message})`);
    }
    if (Object.keys(entry.sources).length === 0)
      failures.push(`実装参照が未登録: ${entry.id}`);
    for (const [source, expected] of Object.entries(entry.sources)) {
      coveredSources.add(source);
      try {
        const actual = digest(
          await readFile(resolveLocal(root, source), 'utf8'),
        );
        if (reviewed.has(entry.id)) entry.sources[source] = actual;
        else if (actual !== expected)
          failures.push(`要仕様確認 ${entry.id}（${entry.name}）: ${source}`);
      } catch (error) {
        failures.push(
          `実装参照先なし ${entry.id}: ${source} (${error.message})`,
        );
      }
    }
  }
  for (const file of await filesBelow(root, 'src')) {
    if (
      /\.(ts|css)$/.test(file) &&
      !file.endsWith('.test.ts') &&
      !file.endsWith('.d.ts') &&
      !coveredSources.has(file)
    )
      failures.push(`本番ファイルの仕様割当なし: ${file}`);
  }

  const markdownFiles = (await filesBelow(root, specDirectory)).filter((file) =>
    file.endsWith('.md'),
  );
  const index = await readFile(
    path.join(root, specDirectory, 'README.md'),
    'utf8',
  );
  for (const document of docs)
    if (!index.includes(`](${path.posix.basename(document)})`))
      failures.push(`入口に仕様リンクなし: ${document}`);
  for (const document of markdownFiles) {
    if (document !== `${specDirectory}/README.md` && !docs.has(document))
      failures.push(`文書の仕様割当なし: ${document}`);
    const text = (await readFile(path.join(root, document), 'utf8')).replace(
      /```[^]*?```/g,
      '',
    );
    for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      const link = match[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(link)) continue;
      try {
        const [target, anchor] = decodeURIComponent(link).split('#');
        const destination = resolveLocal(
          root,
          path.join(path.dirname(document), target || path.basename(document)),
        );
        await stat(destination);
        if (anchor) {
          const content = await readFile(destination, 'utf8');
          if (!content.includes(`id="${anchor}"`))
            failures.push(`明示アンカーなし: ${document} → ${link}`);
        }
      } catch (error) {
        failures.push(`リンク切れ: ${document} → ${link} (${error.message})`);
      }
    }
  }
  if (reviewed.size > 0 && failures.length === 0)
    await writeFile(
      path.join(root, registryPath),
      JSON.stringify(registry, null, 2) + '\n',
    );
  return failures;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args[0] !== '--review' || args.length === 1))
      throw new Error('Usage: node scripts/check-specs.mjs [--review KEY ...]');
    const root = fileURLToPath(new URL('../', import.meta.url));
    const failures = await checkSpecs(root, args.slice(1));
    if (failures.length) {
      console.error(failures.join('\n'));
      console.error(
        '担当仕様を確認・修正し、npm run specs:review -- KEY ... を実行。',
      );
      process.exitCode = 1;
    } else console.log('仕様リンク・機能割当・確認済み実装を検証しました。');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

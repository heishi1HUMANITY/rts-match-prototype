import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const SAFE_AUDIT_PREFIXES = ['artifacts/cp12-84-v5/', 'artifacts/cp12-84-v6/'];

export function isDocumentationOnlyPath(path) {
  const normalized = path.replaceAll('\\', '/');
  if (normalized.startsWith('docs/')) return true;
  if (/(^|\/)AGENTS\.md$/i.test(normalized)) return true;
  if (/^README(?:\.(?:md|txt|rst))?$/i.test(normalized)) return true;
  return SAFE_AUDIT_PREFIXES.some(
    (prefix) =>
      normalized.startsWith(prefix) &&
      /\.(?:json|jsonl|csv|md)$/i.test(normalized),
  );
}

export function classifyChangedPaths(paths) {
  const e2ePaths = paths.filter((path) => !isDocumentationOnlyPath(path));
  return {
    shouldRun: e2ePaths.length > 0,
    reason: e2ePaths.length
      ? `E2E-impacting or unknown paths: ${e2ePaths.join(', ')}`
      : 'Only documentation or known audit-result paths changed',
    changedPaths: paths,
  };
}

function git(repo, args) {
  const result = spawnSync('git', ['-C', repo, ...args], {
    encoding: 'buffer',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr?.toString('utf8') || `git ${args[0]} failed`);
  }
  return result.stdout;
}

export function changedPathsBetween(repo, base, head) {
  if (!base || !head)
    throw new Error('Both base and head revisions are required');
  const mergeBase = git(repo, ['merge-base', base, head])
    .toString('utf8')
    .trim();
  if (!mergeBase) throw new Error('Could not find merge base');
  const output = git(repo, [
    'diff',
    '--name-status',
    '-z',
    '--find-renames',
    mergeBase,
    head,
    '--',
  ]);
  return parseNameStatus(output);
}

export function changedPathsInPush(repo, before, after) {
  if (!before || /^0+$/.test(before) || !after) {
    throw new Error('Push before/after revisions are unavailable');
  }
  const output = git(repo, [
    'diff',
    '--name-status',
    '-z',
    '--find-renames',
    before,
    after,
    '--',
  ]);
  return parseNameStatus(output);
}

function parseNameStatus(output) {
  const fields = output.toString('utf8').split('\0').filter(Boolean);
  const paths = [];
  for (let index = 0; index < fields.length; ) {
    const status = fields[index++];
    const pathCount = /^[RC]/.test(status) ? 2 : 1;
    for (let count = 0; count < pathCount; count++) {
      const path = fields[index++];
      if (path === undefined)
        throw new Error('Malformed git diff name-status output');
      paths.push(path);
    }
  }
  return paths;
}

export function classifyEvent({ eventName, event, repo = process.cwd() }) {
  if (eventName === 'workflow_dispatch') {
    return {
      shouldRun: true,
      reason: 'Manual workflow dispatch always runs E2E',
    };
  }
  if (eventName === 'pull_request') {
    const base = event.pull_request?.base?.sha;
    const head = event.pull_request?.head?.sha;
    return classifyChangedPaths(changedPathsBetween(repo, base, head));
  }
  if (eventName === 'push') {
    return classifyChangedPaths(
      changedPathsInPush(repo, event.before, event.after),
    );
  }
  throw new Error(`Unsupported event: ${eventName}`);
}

function writeOutput(result) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(
      outputFile,
      `shouldRun=${result.shouldRun}\nreason=${result.reason.replace(/[\r\n]/g, ' ')}\n`,
    );
  }
  console.log(`${result.shouldRun ? 'run' : 'skip'} E2E: ${result.reason}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const eventName = process.env.GITHUB_EVENT_NAME;
  try {
    const event = JSON.parse(
      await (
        await import('node:fs/promises')
      ).readFile(process.env.GITHUB_EVENT_PATH, 'utf8'),
    );
    writeOutput(classifyEvent({ eventName, event }));
  } catch (error) {
    // Errors are fail-closed: run browser checks, never skip them.
    writeOutput({
      shouldRun: true,
      reason: `Classification failed; running E2E: ${error.message}`,
    });
  }
}

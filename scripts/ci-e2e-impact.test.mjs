import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  changedPathsBetween,
  changedPathsInPush,
  classifyChangedPaths,
  classifyEvent,
} from './ci-e2e-impact.mjs';
import { browserJobShouldRun, e2eGateSucceeds } from './ci-e2e-gate.mjs';

function withRepo(run) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'e2e impact repo '));
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, stdio: 'pipe' }).toString().trim();
  const commit = (message) => {
    git('add', '-A');
    git('commit', '-m', message);
    return git('rev-parse', 'HEAD');
  };
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.name', 'CI test');
    git('config', 'user.email', 'ci-test@example.invalid');
    writeFileSync(path.join(root, 'README.md'), 'base\n');
    const base = commit('base');
    run({ root, git, commit, base });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('documentation and known audit outputs skip, but executable and unknown paths run', () => {
  assert.equal(
    classifyChangedPaths(['docs/guide.md', 'README.md']).shouldRun,
    false,
  );
  assert.equal(
    classifyChangedPaths([
      'artifacts/cp12-84-v6/final.json',
      'AGENTS.md',
      'src/game.ts',
    ]).shouldRun,
    true,
  );
  assert.equal(
    classifyChangedPaths(['artifacts/other/result.json']).shouldRun,
    true,
  );
  assert.equal(classifyChangedPaths(['package-lock.json']).shouldRun, true);
  assert.equal(classifyChangedPaths(['README.ts']).shouldRun, true);
  assert.equal(classifyChangedPaths(['README.rst']).shouldRun, false);
  assert.equal(
    classifyChangedPaths(['.github/workflows/ci.yml']).shouldRun,
    true,
  );
});

test('pull-request three-dot range and push before/after include all commits', () => {
  withRepo(({ root, git, commit, base }) => {
    mkdirSync(path.join(root, 'docs'), { recursive: true });
    writeFileSync(path.join(root, 'docs', 'note.md'), 'one\n');
    const docHead = commit('docs');
    assert.deepEqual(changedPathsBetween(root, base, docHead), [
      'docs/note.md',
    ]);
    assert.equal(
      classifyEvent({
        repo: root,
        eventName: 'pull_request',
        event: {
          pull_request: { base: { sha: base }, head: { sha: docHead } },
        },
      }).shouldRun,
      false,
    );

    mkdirSync(path.join(root, 'src'));
    writeFileSync(path.join(root, 'src', 'sim.ts'), 'export {};\n');
    const codeHead = commit('code');
    writeFileSync(path.join(root, 'src', 'later.ts'), 'export {};\n');
    const pushHead = commit('second code commit');
    assert.deepEqual(changedPathsInPush(root, docHead, pushHead), [
      'src/later.ts',
      'src/sim.ts',
    ]);
    assert.equal(
      classifyEvent({
        repo: root,
        eventName: 'push',
        event: { before: docHead, after: pushHead },
      }).shouldRun,
      true,
    );
    assert.equal(
      classifyChangedPaths(changedPathsBetween(root, base, codeHead)).shouldRun,
      true,
    );
  });
});

test('renames, deletions, and paths containing spaces are parsed conservatively', () => {
  withRepo(({ root, git, commit }) => {
    mkdirSync(path.join(root, 'docs'), { recursive: true });
    writeFileSync(path.join(root, 'docs', 'original.md'), 'text\n');
    const base = commit('add doc');
    git('mv', 'docs/original.md', 'src renamed.ts');
    const renameHead = commit('rename doc to code');
    const renamedPaths = changedPathsBetween(root, base, renameHead);
    assert.ok(renamedPaths.includes('docs/original.md'));
    assert.ok(renamedPaths.includes('src renamed.ts'));
    assert.equal(classifyChangedPaths(renamedPaths).shouldRun, true);

    const deletionBase = renameHead;
    git('rm', 'src renamed.ts');
    const deletionHead = commit('delete code');
    assert.deepEqual(changedPathsBetween(root, deletionBase, deletionHead), [
      'src renamed.ts',
    ]);
    assert.equal(
      classifyChangedPaths(
        changedPathsBetween(root, deletionBase, deletionHead),
      ).shouldRun,
      true,
    );
  });
});

test('manual dispatch always runs and any diff/ref failure fails closed', () => {
  assert.equal(
    classifyEvent({ eventName: 'workflow_dispatch', event: {} }).shouldRun,
    true,
  );
  withRepo(({ root, base }) => {
    assert.throws(() => changedPathsInPush(root, '0'.repeat(40), base));
    assert.throws(() => changedPathsBetween(root, 'missing-base', base));
    assert.throws(() =>
      classifyEvent({ eventName: 'schedule', event: {}, repo: root }),
    );
  });
});

test('aggregate gate accepts only a valid skip or successful required run', () => {
  assert.equal(browserJobShouldRun('success', 'false'), false);
  assert.equal(browserJobShouldRun('success', 'true'), true);
  assert.equal(browserJobShouldRun('failure', ''), true);
  assert.equal(browserJobShouldRun('cancelled', 'false'), true);

  assert.equal(e2eGateSucceeds('success', 'false', 'skipped'), true);
  assert.equal(e2eGateSucceeds('success', 'true', 'success'), true);
  assert.equal(e2eGateSucceeds('success', 'true', 'skipped'), false);
  assert.equal(e2eGateSucceeds('success', 'false', 'success'), false);
  assert.equal(e2eGateSucceeds('success', 'true', 'failure'), false);
  assert.equal(e2eGateSucceeds('success', 'true', 'cancelled'), false);
  assert.equal(e2eGateSucceeds('failure', 'true', 'success'), false);
  assert.equal(e2eGateSucceeds('cancelled', 'false', 'skipped'), false);
  assert.equal(e2eGateSucceeds('success', '', 'success'), false);
  assert.equal(e2eGateSucceeds('success', 'unexpected', 'skipped'), false);
});

test('workflow delegates required-status behavior to the tested gate', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/ci.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /e2e-impact:/);
  assert.match(workflow, /needs: \[e2e-impact, e2e-browser\]/);
  assert.match(workflow, /node scripts\/ci-e2e-gate\.mjs/);
  assert.match(workflow, /needs\.e2e-impact\.outputs\.shouldRun != 'false'/);
  assert.match(workflow, /workflow_dispatch:/);
});

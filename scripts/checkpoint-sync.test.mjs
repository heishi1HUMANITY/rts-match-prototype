import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  checkpointBody,
  carriedIssues,
  dispatchMergedNumbers,
  findCheckpoint,
  planSync,
  playVerified,
  updateMergedColumn,
} from './checkpoint-sync.mjs';

const body = `| 機能 | Issue | マージ済み | プレイ検証済み | 依存 |
| --- | --- | --- | --- | --- |
| F03 | #15 | [ ] | [ ] | #16 |
| F04 | [#16](https://github.com/example/repo/issues/16) | [x] | [x] | #15 |`;

test('only matching merge cells change; play approval is preserved', () => {
  const updated = updateMergedColumn(body, new Set([15]));
  assert.ok(updated.includes('| F03 | #15 | [x] | [ ] |'));
  assert.ok(updated.includes('| [x] | [x] | #15 |'));
  assert.equal(updateMergedColumn(body, new Set([99])), body);
  assert.equal(updateMergedColumn(updated, new Set([15])), updated);
  assert.equal(playVerified(updated, 15), false);
  assert.equal(playVerified(updated, 16), true);
  assert.throws(() => updateMergedColumn('old list', new Set([15])), /2列表/);
});

function issue(number, gate = 'gate:play') {
  return {
    number,
    title: `feature ${number}`,
    labels: [
      { name: gate },
      { name: 'custom:preserve' },
      { name: 'kind:feature' },
    ],
    milestone: { number: 1, title: 'CP1' },
  };
}

test('a merge transitions only linked issues and invalidates play verification', () => {
  const plan = planSync([issue(15), issue(16, 'gate:auto')], [15], { body });
  assert.deepEqual(plan.mutations[0], {
    issue: 15,
    body: {
      labels: [
        'gate:play',
        'custom:preserve',
        'kind:feature',
        'flow:merged',
        'status:unverified',
      ],
    },
  });
  assert.equal(plan.issues[1].labels[1].name, 'custom:preserve');
  assert.equal(
    planSync(plan.issues, [15], { body: plan.mutations[1].body.body }).mutations
      .length,
    0,
  );
  const auto = planSync([issue(15, 'gate:auto')], [15], { body });
  assert.equal(
    auto.issues[0].labels.some((label) => label.name === 'status:unverified'),
    false,
  );
});

test('bad classification or CP warns and skips only affected issues', () => {
  const noGate = issue(15);
  noGate.labels = [];
  const missingGate = planSync([noGate, issue(16)], [15, 16], { body });
  assert.match(missingGate.warnings[0], /gate/);
  assert.ok(missingGate.mutations.some((mutation) => mutation.issue === 16));
  assert.ok(!missingGate.mutations.some((mutation) => mutation.issue === 15));
  assert.ok(
    missingGate.mutations
      .at(-1)
      .body.body.includes('| F03 | #15 | [ ] | [ ] |'),
  );
  const noCP = issue(15);
  noCP.milestone = null;
  assert.match(planSync([noCP], [15], { body }).warnings[0], /Milestone/);
});

test('new play merge clears previous approval, dispatch preserves it', () => {
  const merged = planSync([issue(16)], [16], { body });
  assert.ok(merged.mutations.at(-1).body.body.includes('| [x] | [ ] |'));
  const dispatch = planSync([issue(16)], [16], { body }, { newMerge: false });
  assert.equal(
    dispatch.mutations.some((mutation) => mutation.issue === 12),
    false,
  );
  assert.equal(
    dispatch.issues[0].labels.some(
      (label) => label.name === 'status:unverified',
    ),
    false,
  );
  const decision = issue(15);
  decision.labels.push({ name: 'kind:decision' });
  decision.state = 'closed';
  const decisionPlan = planSync([decision], [15], { body });
  const reopened = decisionPlan.mutations.find(
    (mutation) => mutation.body.state === 'open',
  );
  assert.ok(!reopened.body.labels.some((label) => label.startsWith('flow:')));
  assert.ok(!reopened.body.labels.some((label) => label.startsWith('gate:')));
  assert.match(decisionPlan.warnings[0], /ユーザー判断/);
  assert.equal(
    decisionPlan.mutations.some((mutation) => mutation.issue === 12),
    false,
  );
  assert.throws(() => planSync([issue(15)], [15], { body: null }), /2列表/);
});

test('decision issues receive no flow label from the template', () => {
  const template = readFileSync('.github/ISSUE_TEMPLATE/decision.yml', 'utf8');
  assert.match(template, /^labels: \['kind:decision'\]$/m);
  assert.doesNotMatch(template.match(/^labels:.*$/m)?.[0] ?? '', /flow:/);
});

test('non-implementation issues lose gates without changing other labels or progress', () => {
  const decision = issue(49, 'gate:auto');
  decision.labels = [
    { name: 'kind:decision' },
    { name: 'gate:auto' },
    { name: 'flow:ready' },
    { name: 'custom:keep' },
  ];
  const checkpoint = issue(51);
  checkpoint.labels = [
    { name: 'kind:checkpoint' },
    { name: 'gate:play' },
    { name: 'flow:ready' },
  ];
  const plan = planSync(
    [decision, checkpoint],
    [49, 51],
    { body },
    {
      newMerge: false,
    },
  );
  assert.deepEqual(plan.warnings, []);
  assert.deepEqual(plan.mutations, [
    {
      issue: 49,
      body: { labels: ['kind:decision', 'custom:keep'] },
    },
    { issue: 51, body: { labels: ['kind:checkpoint'] } },
  ]);
  assert.deepEqual(
    planSync(plan.issues, [], { body }, { newMerge: false }).mutations,
    [],
  );
  for (const candidate of [decision, checkpoint]) {
    candidate.labels.push({ name: 'flow:merged' });
    candidate.labels.push({ name: 'status:unverified' });
  }
  assert.deepEqual(dispatchMergedNumbers([decision, checkpoint]), []);
});

test('dispatch includes only auto or explicitly unverified merged issues', () => {
  const historicalPlay = issue(15);
  const explicitPlay = issue(16);
  const automatic = issue(30, 'gate:auto');
  for (const candidate of [historicalPlay, explicitPlay, automatic]) {
    candidate.labels[1].name = 'flow:merged';
  }
  explicitPlay.labels.push({ name: 'status:unverified' });
  const unmerged = issue(99);
  unmerged.labels.push({ name: 'status:unverified' });
  assert.deepEqual(
    dispatchMergedNumbers([historicalPlay, explicitPlay, automatic, unmerged]),
    [16, 30],
  );
});

test('closed play issues carry to the lowest numbered open CP', () => {
  const closedCp = { number: 1, title: 'CP0', state: 'closed' };
  const openCp1 = { number: 2, title: 'CP1', state: 'open' };
  const openCp3 = { number: 3, title: 'CP3', state: 'open' };
  const carried = issue(19);
  carried.milestone = closedCp;
  carried.labels.push({ name: 'status:unverified' });
  const stillOpen = issue(20);
  stillOpen.milestone = openCp1;
  stillOpen.labels.push({ name: 'status:unverified' });
  const decision = issue(21);
  decision.milestone = closedCp;
  decision.labels.push(
    { name: 'status:unverified' },
    { name: 'kind:decision' },
  );
  const checkpoint = issue(22);
  checkpoint.milestone = closedCp;
  checkpoint.labels.push(
    { name: 'status:unverified' },
    { name: 'kind:checkpoint' },
  );
  const earlierIssue = issue(18);
  earlierIssue.milestone = closedCp;
  earlierIssue.labels.push({ name: 'status:unverified' });
  const result = carriedIssues(
    [carried, stillOpen, decision, checkpoint, earlierIssue],
    [openCp3, closedCp, openCp1],
  );
  assert.equal(result.target, openCp1);
  assert.deepEqual(
    result.carried.map((candidate) => candidate.number),
    [18, 19],
  );
});

test('checkpoint has one match, exactly three checks and pending features', () => {
  const template = readFileSync(
    'docs/project/inspection/CP_TEMPLATE.md',
    'utf8',
  );
  const url = 'https://example.github.io/repo/';
  const sheet = checkpointBody('CP0', [issue(15)], template, url);
  assert.ok(sheet.startsWith('<!-- checkpoint:CP0 -->'));
  assert.equal((sheet.match(/^\d\. /gm) ?? []).length, 3);
  assert.ok(sheet.includes('- #15: feature 15'));
  assert.ok(
    sheet.includes('[公開ゲーム画面](https://example.github.io/repo/)'),
  );
  assert.ok(sheet.includes('https://example.github.io/repo/build-info.json'));
  assert.ok(sheet.indexOf('- #15:') > sheet.indexOf('## 既知の未検証'));
  assert.ok(checkpointBody('CP0', [], template, url).includes('- なし'));
  assert.equal(
    checkpointBody('CP0', [issue(15)], template, url, []),
    checkpointBody('CP0', [issue(15)], template, url),
  );
  const carriedSheet = checkpointBody('CP1', [issue(15)], template, url, [
    issue(19),
  ]);
  assert.ok(
    carriedSheet.includes(
      '- #15: feature 15\n\n持ち越し（前のCPで未検証のまま閉じた機能）:\n- #19: feature 19',
    ),
  );
  assert.throws(
    () => checkpointBody('CP0', [], '# CP0\n\n## 既知の未検証', url),
    /3見出し/,
  );
  assert.throws(
    () => checkpointBody('CP0', [], template.replace('3. ', '4. '), url),
    /確認3点/,
  );
  assert.ok(
    checkpointBody(
      'CP0',
      [issue(15)],
      template.trim() + '\n端末未検証',
      url,
    ).includes('端末未検証\n\n- #15: feature 15'),
  );
});

test('only labeled maintainer or bot CP records are eligible; oldest wins', () => {
  const record = (number, author, login = 'human') => ({
    number,
    body: '<!-- checkpoint:CP0 -->\n# CP0',
    labels: [{ name: 'kind:checkpoint' }],
    author_association: author,
    user: { login },
  });
  const unlabelled = record(1, 'OWNER');
  unlabelled.labels = [];
  const missingBody = record(2, 'OWNER');
  missingBody.body = null;
  const spoof = record(3, 'NONE');
  const member = record(5, 'MEMBER');
  const bot = record(6, 'NONE', 'github-actions[bot]');
  assert.equal(
    findCheckpoint([bot, member, spoof, unlabelled, missingBody], 'CP0').number,
    5,
  );
  assert.equal(
    findCheckpoint([spoof, unlabelled, missingBody], 'CP0'),
    undefined,
  );
});

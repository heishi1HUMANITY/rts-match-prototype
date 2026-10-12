import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// #12 is the progress source. Never infer a user's play approval from a merge.
export function updateMergedColumn(body, numbers, invalidatePlay = new Set()) {
  let mergedIndex = -1;
  let playIndex = -1;
  let issueIndex = -1;
  let foundTable = false;
  const result = body.split('\n').map((line) => {
    if (!line.trim().startsWith('|')) {
      mergedIndex = -1;
      playIndex = -1;
      issueIndex = -1;
      return line;
    }
    const cells = line.split('|');
    if (cells.some((cell) => cell.trim() === 'マージ済み')) {
      mergedIndex = cells.findIndex((cell) => cell.trim() === 'マージ済み');
      playIndex = cells.findIndex((cell) => cell.trim() === 'プレイ検証済み');
      issueIndex = cells.findIndex((cell) =>
        /^(Issue|Issue番号)$/i.test(cell.trim()),
      );
      foundTable = mergedIndex >= 0 && playIndex >= 0 && issueIndex >= 0;
      return line;
    }
    if (mergedIndex < 0 || playIndex < 0 || issueIndex < 0) return line;
    const number = issueNumber(cells[issueIndex]);
    if (numbers.has(number)) {
      if (!/\[[ xX]\]/.test(cells[mergedIndex] ?? '')) {
        throw new Error('#12 マージ済み列にチェックボックスがありません');
      }
      cells[mergedIndex] = cells[mergedIndex].replace(/\[[ xX]\]/, '[x]');
      if (invalidatePlay.has(number)) {
        cells[playIndex] = cells[playIndex].replace(/\[[ xX]\]/, '[ ]');
      }
      return cells.join('|');
    }
    return line;
  });
  if (!foundTable) {
    throw new Error(
      '#12 をIssue / マージ済み / プレイ検証済みの2列表にしてください',
    );
  }
  return result.join('\n');
}

function issueNumber(cell = '') {
  const values = new Set(
    [...cell.matchAll(/(?:#|\/issues\/)(\d+)\b/g)].map((match) =>
      Number(match[1]),
    ),
  );
  return values.size === 1 ? [...values][0] : null;
}

export function checkpointBody(cp, issues, template, pagesUrl) {
  const pending = issues.length
    ? issues
        .map(
          (issue) =>
            `- #${issue.number}: ${issue.title
              .replace(/[\r\n]/g, ' ')
              .replace(/@/g, '&#64;')
              .replace(/[\\`*_{}\[\]()<>#|]/g, '\\$&')}`,
        )
        .join('\n')
    : '- なし（#12のプレイ検証済み列と検査コメントを参照）。';
  const text = (template ?? '').replace(/\r\n/g, '\n');
  const headings = [...text.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
  if (
    headings.join('|') !== '通常設定で1試合|確認3点|既知の未検証' ||
    [
      ...text
        .split('## 確認3点\n')[1]
        .split('## 既知の未検証')[0]
        .matchAll(/^(\d+)\. /gm),
    ]
      .map((match) => match[1])
      .join() !== '1,2,3'
  ) {
    throw new Error(`${cp}: 検査票には3見出しと確認3点が必要です`);
  }
  const url = new URL(pagesUrl);
  if (url.protocol !== 'https:') throw new Error('Pages URL must use HTTPS');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  const links = `[公開ゲーム画面](${url.href}) / [ビルド情報](${new URL('build-info.json', url).href})`;
  return `<!-- checkpoint:${cp} -->\n${text
    .trim()
    .replace(/^# .+$/m, `# ${cp}: プレイ検査票`)
    .replace(
      '## 通常設定で1試合',
      `## 通常設定で1試合\n\n${links}`,
    )}\n\n${pending}\n`;
}

export function findCheckpoint(issues, cp) {
  return issues
    .filter(
      (issue) =>
        issue.body?.startsWith(`<!-- checkpoint:${cp} -->`) &&
        issue.labels.some((label) => label.name === 'kind:checkpoint') &&
        (['OWNER', 'MEMBER', 'COLLABORATOR'].includes(
          issue.author_association,
        ) ||
          issue.user?.login === 'github-actions[bot]'),
    )
    .sort((left, right) => left.number - right.number)[0];
}

function api(path, data) {
  const args = ['api', path];
  if (data) args.push('--method', data.method ?? 'POST', '--input', '-');
  const output = execFileSync('gh', args, {
    encoding: 'utf8',
    ...(data ? { input: JSON.stringify(data.body) } : {}),
  });
  return output.trim() ? JSON.parse(output) : null;
}

function list(path) {
  const values = [];
  for (let page = 1; ; page += 1) {
    const batch = api(
      `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`,
    );
    values.push(...batch);
    if (batch.length < 100) return values;
  }
}

function closingIssues(owner, name, number) {
  const issues = [];
  let cursor = null;
  do {
    const result = api('graphql', {
      body: {
        query: `query($owner:String!,$name:String!,$number:Int!,$cursor:String) {
          repository(owner:$owner,name:$name) {
            pullRequest(number:$number) {
              merged baseRefName
              closingIssuesReferences(first:100,after:$cursor) {
                nodes { number repository { nameWithOwner } }
                pageInfo { hasNextPage endCursor }
              }
            }
          }
        }`,
        variables: { owner, name, number, cursor },
      },
    });
    if (result.errors) throw new Error(JSON.stringify(result.errors));
    const pr = result.data.repository.pullRequest;
    if (!pr.merged || pr.baseRefName !== 'main') return [];
    issues.push(...pr.closingIssuesReferences.nodes);
    cursor = pr.closingIssuesReferences.pageInfo.hasNextPage
      ? pr.closingIssuesReferences.pageInfo.endCursor
      : null;
  } while (cursor);
  return issues
    .filter((issue) => issue.repository.nameWithOwner === `${owner}/${name}`)
    .map((issue) => issue.number);
}

export function planSync(
  issues,
  mergedNumbers,
  tracker,
  { newMerge = true } = {},
) {
  const mutations = [];
  const warnings = [];
  const merged = new Set();
  const requested = new Set(mergedNumbers);
  const invalidatePlay = new Set();
  const classified = issues.map((issue) => {
    const labels = issue.labels.map((label) => label.name);
    if (
      !labels.some((label) =>
        ['kind:decision', 'kind:checkpoint'].includes(label),
      )
    )
      return issue;
    const desired = labels.filter((label) => !label.startsWith('gate:'));
    if (desired.length !== labels.length)
      mutations.push({ issue: issue.number, body: { labels: desired } });
    return { ...issue, labels: desired.map((name) => ({ name })) };
  });
  const updated = classified.map((issue) => {
    if (!requested.has(issue.number)) return issue;
    const labels = issue.labels.map((label) => label.name);
    if (labels.includes('kind:decision')) {
      if (newMerge) {
        warnings.push(
          `#${issue.number}: decision採否はマージから推測できません。再開しユーザー判断を待ちます`,
        );
        const desired = labels.filter((label) => !label.startsWith('flow:'));
        desired.push('flow:ready');
        mutations.push({
          issue: issue.number,
          body: { state: 'open', labels: desired },
        });
        return {
          ...issue,
          state: 'open',
          labels: desired.map((name) => ({ name })),
        };
      }
      return issue;
    }
    if (labels.includes('kind:checkpoint')) return issue;
    if (
      labels.filter((label) => label.startsWith('gate:')).length !== 1 ||
      !labels.some((label) => label === 'gate:auto' || label === 'gate:play')
    ) {
      warnings.push(
        `#${issue.number}: gate:auto / gate:play を1つ指定してください`,
      );
      return issue;
    }
    if (
      labels.includes('gate:play') &&
      !/^CP\d+$/.test(issue.milestone?.title ?? '')
    ) {
      warnings.push(`#${issue.number}: CP Milestoneがありません`);
      return issue;
    }
    merged.add(issue.number);
    if (newMerge && labels.includes('gate:play'))
      invalidatePlay.add(issue.number);
    const desired = labels.filter((label) => !label.startsWith('flow:'));
    desired.push('flow:merged');
    if (
      newMerge &&
      labels.includes('gate:play') &&
      !labels.includes('status:unverified')
    ) {
      desired.push('status:unverified');
    }
    if ([...labels].sort().join() !== [...desired].sort().join()) {
      mutations.push({ issue: issue.number, body: { labels: desired } });
    }
    return { ...issue, labels: desired.map((name) => ({ name })) };
  });
  const body = updateMergedColumn(tracker.body ?? '', merged, invalidatePlay);
  if (body !== tracker.body) mutations.push({ issue: 12, body: { body } });
  return { mutations, issues: updated, warnings };
}

export function dispatchMergedNumbers(issues) {
  return issues
    .filter((issue) => {
      const labels = issue.labels.map((label) => label.name);
      return (
        !labels.includes('kind:decision') &&
        !labels.includes('kind:checkpoint') &&
        labels.includes('flow:merged') &&
        (labels.includes('gate:auto') || labels.includes('status:unverified'))
      );
    })
    .map((issue) => issue.number);
}

function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) {
    throw new Error('GITHUB_REPOSITORY=owner/repository が必要です');
  }
  const [owner, name] = repository.split('/');
  const base = `repos/${repository}`;
  const event = process.env.GITHUB_EVENT_PATH
    ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
    : {};
  const apply = process.argv.includes('--apply');
  const replayNumber = event.inputs?.pr_number || process.env.REPLAY_PR;
  if (replayNumber && !/^[1-9]\d*$/.test(replayNumber))
    throw new Error('pr_number must be a positive integer');
  const prNumber =
    event.pull_request?.number || (replayNumber ? Number(replayNumber) : null);
  const issues = list(`${base}/issues?state=all`).filter(
    (issue) => !issue.pull_request,
  );
  const tracker = issues.find((issue) => issue.number === 12);
  if (!tracker) throw new Error('進捗Issue #12 がありません');
  const mergedNumbers = prNumber
    ? closingIssues(owner, name, prNumber)
    : // Historical play verification is never inferred from an unchecked cell.
      dispatchMergedNumbers(issues);
  const plan = planSync(issues, mergedNumbers, tracker, {
    newMerge: Boolean(prNumber),
  });
  const operations = plan.mutations.map((mutation) => ({
    path: `${base}/issues/${mutation.issue}`,
    method: 'PATCH',
    body: mutation.body,
  }));
  const milestones = list(`${base}/milestones?state=all`).filter((item) =>
    /^CP\d+$/.test(item.title),
  );
  for (const cp of milestones) {
    const pending = plan.issues.filter(
      (issue) =>
        issue.milestone?.number === cp.number &&
        issue.labels.some((label) => label.name === 'flow:merged') &&
        issue.labels.some((label) => label.name === 'gate:play') &&
        issue.labels.some((label) => label.name === 'status:unverified'),
    );
    const existing = findCheckpoint(issues, cp.title);
    if (!existing && !pending.length) continue;
    const templatePath = `docs/project/inspection/${cp.title}.md`;
    let body;
    try {
      body = checkpointBody(
        cp.title,
        pending,
        readFileSync(
          existsSync(templatePath)
            ? templatePath
            : 'docs/project/inspection/CP_TEMPLATE.md',
          'utf8',
        ),
        process.env.PAGES_URL || `https://${owner}.github.io/${name}/`,
      );
    } catch (error) {
      plan.warnings.push(error.message);
      continue;
    }
    if (existing?.body === body) continue;
    operations.push({
      path: existing ? `${base}/issues/${existing.number}` : `${base}/issues`,
      method: existing ? 'PATCH' : 'POST',
      body: {
        body,
        title: `${cp.title}: プレイ検査記録`,
        milestone: cp.number,
        ...(!existing ? { labels: ['kind:checkpoint', 'flow:ready'] } : {}),
      },
    });
  }
  // JSON via stdin: Issue / PR content is never evaluated by a shell.
  for (const operation of operations) {
    console.log(JSON.stringify({ apply, ...operation }));
    if (apply) {
      try {
        api(operation.path, operation);
      } catch (error) {
        plan.warnings.push(`${operation.path}: ${error.message}`);
      }
    }
  }
  for (const warning of plan.warnings)
    console.error(JSON.stringify({ warning }));
  if (plan.warnings.length) process.exitCode = 1;
}

export function playVerified(body, number) {
  let playIndex = -1;
  let issueIndex = -1;
  for (const line of body.split('\n')) {
    const cells = line.split('|');
    if (!line.trim().startsWith('|')) {
      playIndex = -1;
      issueIndex = -1;
      continue;
    }
    if (cells.some((cell) => cell.trim() === 'プレイ検証済み')) {
      playIndex = cells.findIndex((cell) => cell.trim() === 'プレイ検証済み');
      issueIndex = cells.findIndex((cell) =>
        /^(Issue|Issue番号)$/i.test(cell.trim()),
      );
      continue;
    }
    if (
      issueIndex >= 0 &&
      issueNumber(cells[issueIndex]) === number &&
      playIndex >= 0
    ) {
      return /\[[xX]\]/.test(cells[playIndex] ?? '');
    }
  }
  return false;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();

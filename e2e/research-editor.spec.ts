import { readFile } from 'node:fs/promises';
import { test, expect, saveDiagnostic } from './fixtures';

test('F21-01 / F21-04: arbitrary research survives reload, completes and keeps the active snapshot', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.goto('./');
  await page.getByRole('button', { name: 'マスタ', exact: true }).click();
  await page.locator('[data-research-new-id]').fill('constructor');
  await page.locator('[data-research-add]').click();
  const node = page.locator('[data-research-node="constructor"]');
  await node.locator('summary').click();
  await page
    .locator(
      '[data-research-path="research.definitions.constructor.costCenti"]',
    )
    .fill('100');
  await page
    .locator(
      '[data-research-path="research.definitions.constructor.effects.0.value"]',
    )
    .fill('7');
  await page.getByRole('button', { name: '保存する', exact: true }).click();
  await expect(page.locator('.master-error')).toContainText('保存しました');
  await page.screenshot({ path: info.outputPath('research-editor.png') });
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await page.getByRole('button', { name: '研究', exact: true }).click();
  const research = page.locator('[data-research="constructor"]');
  await expect(
    page.locator('[data-research-details="constructor"]'),
  ).toContainText('必要1ポイント');
  await research.click();
  await expect(research).toContainText('完了', { timeout: 15_000 });
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  const beforePath = info.outputPath('research-before.json');
  await saveDiagnostic(page, beforePath);
  const before = JSON.parse(await readFile(beforePath, 'utf8'));
  expect(
    before.state.factions.find((f: { id: string }) => f.id === 'A')
      .completedResearchIds,
  ).toContain('constructor');
  expect(before.state.rules.research.definitions['constructor']).toMatchObject({
    costCenti: 100,
    effects: [{ id: 'damage-bonus', value: 7 }],
  });
  await page.getByRole('button', { name: 'マスタ', exact: true }).click();
  const reopened = page.locator('[data-research-node="constructor"]');
  if ((await reopened.getAttribute('open')) === null)
    await reopened.locator('summary').click();
  await page
    .locator(
      '[data-research-path="research.definitions.constructor.effects.0.value"]',
    )
    .fill('9');
  await page.getByRole('button', { name: '保存する', exact: true }).click();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  const afterPath = info.outputPath('research-after.json');
  await saveDiagnostic(page, afterPath);
  const after = JSON.parse(await readFile(afterPath, 'utf8'));
  expect(after.state).toEqual(before.state);
  await page.screenshot({ path: info.outputPath('research-complete.png') });
});

test('F21-02: invalid graph, effects and duplicate JSON keys preserve saved master', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto('./');
  await page.getByRole('button', { name: 'マスタ', exact: true }).click();
  await page.getByRole('button', { name: '保存する', exact: true }).click();
  const stored = () =>
    page.evaluate(() => localStorage.getItem('rts-match-prototype.master.v1'));
  const original = (await stored())!;
  const invalidCases = [
    (value: any) => {
      value.rules.research.definitions['firepower-1'].prerequisites = [
        'missing-node',
      ];
    },
    (value: any) => {
      value.rules.research.definitions['firepower-1'].prerequisites = [
        'firepower-2',
      ];
    },
    (value: any) => {
      value.rules.research.definitions['firepower-1'].exclusiveWith = [
        'survey-1',
      ];
    },
    (value: any) => {
      value.rules.research.definitions['firepower-1'].costCenti = -1;
    },
    (value: any) => {
      value.rules.research.definitions['firepower-1'].effects = [
        { id: 'unregistered', value: 1 },
      ];
    },
  ];
  const jsons = invalidCases.map((change) => {
    const value = JSON.parse(original);
    change(value);
    return JSON.stringify(value);
  });
  jsons.push(
    original.replace('"firepower-1":', '"firepower-1":{},"firepower-1":'),
  );
  for (const json of jsons) {
    await page.locator('#master-json-input').fill(json);
    await page
      .getByRole('button', { name: 'JSONを検証して読込', exact: true })
      .click();
    await expect(page.locator('.master-error')).not.toBeEmpty();
    expect(await stored()).toBe(original);
  }
});

test('F21-03: deleting a referenced node shows its ID and preserves storage', async ({
  page,
}, info) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'マスタ', exact: true }).click();
  await page.getByRole('button', { name: '保存する', exact: true }).click();
  const stored = () =>
    page.evaluate(() => localStorage.getItem('rts-match-prototype.master.v1'));
  const original = await stored();
  await page.locator('[data-research-node="firepower-1"] summary').click();
  await page.locator('[data-research-delete="firepower-1"]').click();
  await page.getByRole('button', { name: '保存する', exact: true }).click();
  await expect(page.locator('.master-error')).toContainText('firepower-1');
  expect(await stored()).toBe(original);
  await page.screenshot({ path: info.outputPath('deleted-reference.png') });
});

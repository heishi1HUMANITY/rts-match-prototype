import { readFile } from 'node:fs/promises';
import { expect, saveDiagnostic, test } from './fixtures';

test('F13-01 / F13-02 / F13-03: stance, rally command, and automatic retreat are visible and recorded', async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.goto('./');
  await page.getByText('検査設定', { exact: true }).click();
  await page
    .getByRole('combobox', { name: '検査シナリオ' })
    .selectOption('f13-behavior');
  await page
    .getByRole('button', { name: '適用してリセット', exact: true })
    .click();
  await page.getByText('検査設定', { exact: true }).click();
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await page.locator('[data-unit="A-01"]').click();
  await expect(page.locator('[data-unit="A-01"] small')).toContainText(
    '退避中',
    { timeout: 10_000 },
  );
  await page.locator('[data-action="stance-hold"]').click();
  await expect(page.locator('[data-unit="A-01"] small')).toContainText('保持');
  await expect(page.locator('[data-unit="A-01"] small')).not.toContainText(
    '退避中',
  );
  await page.getByRole('button', { name: '拠点', exact: true }).click();
  await page
    .locator('.strategy-panel')
    .evaluate((panel) => (panel.scrollTop = panel.scrollHeight));
  await page.locator('[data-rally-x]').fill('7');
  await page.locator('[data-rally-y]').fill('20');
  await page.locator('[data-action="set-rally"]').click();
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  const path = info.outputPath('f13-behavior.json');
  await saveDiagnostic(page, path);
  const diagnostic = JSON.parse(await readFile(path, 'utf8'));
  expect(
    diagnostic.state.units.find((unit: { id: string }) => unit.id === 'A-01'),
  ).toMatchObject({
    stance: 'hold',
    retreating: false,
    experienceCenti: 0,
    rank: 0,
  });
  expect(
    diagnostic.state.factions.find(
      (faction: { id: string }) => faction.id === 'A',
    ).rallyPoint,
  ).toEqual({ x: 7, y: 20 });
  expect(diagnostic.history).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        command: { type: 'set-stance', unitId: 'A-01', stance: 'hold' },
        ok: true,
      }),
      expect.objectContaining({
        command: { type: 'set-rally', target: { x: 7, y: 20 } },
        ok: true,
      }),
    ]),
  );
  await page.screenshot({ path: info.outputPath('f13-behavior.png') });
});

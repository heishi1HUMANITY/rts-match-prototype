import { readFile } from 'node:fs/promises';
import { expect, saveDiagnostic, test } from './fixtures';

test('F18-01: garrison a selected unit from the base panel and verify arrival state', async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.goto('./');
  await page.getByText('検査設定', { exact: true }).click();
  await page
    .getByRole('combobox', { name: '検査シナリオ' })
    .selectOption('f18-garrison');
  await page
    .getByRole('button', { name: '適用してリセット', exact: true })
    .click();
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await page.locator('[data-unit="A-01"]').click();
  await page.getByRole('button', { name: '拠点', exact: true }).click();
  await expect(page.locator('[data-action="garrison"]')).toBeEnabled();
  await page.locator('[data-action="garrison"]').click();
  await expect(page.locator('.tick-readout')).toHaveText(
    /TICK [2-9]\d* · RUNNING/,
    { timeout: 15_000 },
  );
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  await expect(page.locator('.base-detail')).toContainText('駐留 1/2');

  const path = info.outputPath('garrison-arrival.json');
  await saveDiagnostic(page, path);
  const diagnostic = JSON.parse(await readFile(path, 'utf8'));
  expect(
    diagnostic.state.units.find((unit: { id: string }) => unit.id === 'A-01'),
  ).toMatchObject({
    cell: { x: 6, y: 34 },
    garrisonedAtBaseId: 'HQ-A',
    path: [],
  });
  expect(diagnostic.history).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        command: { type: 'garrison', unitId: 'A-01', baseId: 'HQ-A' },
        ok: true,
      }),
    ]),
  );
  await page.screenshot({ path: info.outputPath('garrison-arrival.png') });
});

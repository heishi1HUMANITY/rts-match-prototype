import { test, expect } from './fixtures';

test('F12-01 / F12-02 / F12-03: crossing loss cuts supply and rebuilding restores it', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('./');
  await page.getByText('検査設定', { exact: true }).click();
  await page
    .getByRole('combobox', { name: '検査シナリオ' })
    .selectOption('f12-supply-lines');
  await page
    .getByRole('button', { name: '適用してリセット', exact: true })
    .click();
  await page.getByText('検査設定', { exact: true }).click();
  await page.getByRole('button', { name: '拠点', exact: true }).click();
  await page.locator('[data-base-select]').selectOption('OUT-03');
  await expect(page.locator('.base-detail')).toContainText('首都と接続');
  await page.locator('[data-unit="A-01"]').click();
  await page.getByRole('button', { name: '渡河', exact: true }).click();
  const crossing = page.locator('[data-crossing="CROSS-BORDER-120-B2"]');
  await expect(crossing.locator('.crossing-status')).toContainText(
    '補給線接続',
  );
  // Open the crossing panel and select its builder before starting the clock.
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await crossing.locator('[data-crossing-dismantle]').click({ timeout: 5_000 });
  await expect(crossing.locator('.crossing-status')).toContainText('未建設', {
    timeout: 15_000,
  });
  await page.getByRole('button', { name: '拠点', exact: true }).click();
  await page.locator('[data-base-select]').selectOption('OUT-03');
  await expect(page.locator('.base-detail')).toContainText('切断');
  await expect(page.locator('.base-detail')).toContainText(
    'CROSS-BORDER-120-B2',
  );

  await page.getByRole('button', { name: '渡河', exact: true }).click();
  await crossing.locator('[data-crossing-build]').click();
  await expect(crossing.locator('.crossing-status')).toContainText('A所有', {
    timeout: 35_000,
  });
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  await expect(crossing.locator('.crossing-status')).toContainText(
    '補給線接続',
  );
  await page.getByRole('button', { name: '拠点', exact: true }).click();
  await page.locator('[data-base-select]').selectOption('OUT-03');
  await expect(page.locator('.base-detail')).toContainText('首都と接続');
});

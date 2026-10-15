import { test, expect } from './fixtures';

test('F15: all shared tactical abilities are visible and can be activated', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByText('検査設定', { exact: true }).click();
  await page
    .getByRole('combobox', { name: '検査シナリオ' })
    .selectOption('f15-tactical-abilities');
  await page.getByRole('button', { name: '適用してリセット' }).click();
  await page.getByText('検査設定', { exact: true }).click();
  await page.getByRole('button', { name: '作戦', exact: true }).click();

  const abilities = page.locator('.tactical-ability-card');
  await expect(abilities).toHaveCount(6);
  await expect(page.locator('[data-ability="bulwark"]')).toBeDisabled();
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await expect(page.locator('[data-ability="bulwark"]')).toBeEnabled();
  await page.locator('[data-ability="bulwark"]').click();
  await expect(page.locator('[data-ability-active]')).toContainText(
    /鉄壁 残り/,
  );
  await expect(page.locator('[data-ability-status="bulwark"]')).toContainText(
    '待機中',
  );
});

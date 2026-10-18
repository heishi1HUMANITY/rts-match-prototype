import { test, expect } from './fixtures';

test('CP87-01: specialization masters and frontline production share the match rules', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.goto('./');
  await page.getByText('検査設定', { exact: true }).click();
  await page
    .getByRole('combobox', { name: '検査シナリオ' })
    .selectOption('f87-specializations');
  await page
    .getByRole('button', { name: '適用してリセット', exact: true })
    .evaluate((button) => (button as HTMLButtonElement).click());
  await expect(page.locator('.scenario-badge')).toContainText('CP13専攻');
  await page.getByRole('button', { name: 'マスタ', exact: true }).click();
  await expect(
    page.locator('[data-master-path="cp87.mineSlowPercent"]'),
  ).toBeVisible();
  await expect(
    page.locator('.master-group').filter({ hasText: 'CP13 非火力専攻' }),
  ).toBeVisible();
  await page.locator('[data-master-close]').click();
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await page.getByRole('button', { name: '研究', exact: true }).click();
  for (const id of [
    'specialization-wartime-economy',
    'specialization-logistics',
    'specialization-information',
    'specialization-engineering',
    'specialization-information-warfare',
  ])
    await expect(page.locator(`[data-research="${id}"]`)).toBeVisible();
  await page.getByRole('button', { name: '生産', exact: true }).click();
  const site = page.getByRole('combobox', { name: '部隊の生産場所' });
  await expect(site.locator('option')).toContainText(['前線 OUT-03']);
  await site.selectOption('OUT-03');
  await page.locator('[data-produce="assault"]').click();
  await expect(page.locator('.production-queue [data-job]')).toHaveCount(1);
  await expect(page.locator('.production-queue')).toContainText('生産中');
  await page.screenshot({ path: info.outputPath('cp87-frontline-queue.png') });
  expect(errors).toEqual([]);
});

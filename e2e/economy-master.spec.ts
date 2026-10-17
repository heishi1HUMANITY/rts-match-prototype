import { test, expect } from './fixtures';

test('CP12: flat economy master exposes fixed rates and hides territory income controls', async ({
  page,
}, info) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'マスタ', exact: true }).click();

  const research = page.locator(
    '[data-master-path="research.baseIncomeCentiPerTick"]',
  );
  const supply = page.locator(
    '[data-master-path="economy.flatSupplyIncomeCentiPerTick"]',
  );
  await expect(research).toHaveValue('12');
  await expect(supply).toHaveValue('120');
  await expect(
    page.locator('[data-master-path="bases.hq.supplyIncomeCentiPerTick"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-master-path$="supplyIncomePercent"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('[data-master-path$="researchIncomePercent"]'),
  ).toHaveCount(0);

  await research.scrollIntoViewIfNeeded();
  await expect(research).toBeVisible();
  await supply.scrollIntoViewIfNeeded();
  await expect(supply).toBeVisible();
  await page.screenshot({ path: info.outputPath('flat-economy-master.png') });
});

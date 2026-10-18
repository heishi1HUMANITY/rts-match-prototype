import { expect, test } from './fixtures';

test('visible combat status and opponent link remain readable without selection', async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  await page.goto('./');
  await page.getByText('検査設定', { exact: true }).click();
  await page
    .getByRole('combobox', { name: '検査シナリオ' })
    .selectOption('f121-combat-visibility');
  await page.getByRole('button', { name: '適用してリセット' }).click();
  await page.getByRole('button', { name: '開始', exact: true }).click();

  const source = page.locator('.rts-unit-label[data-unit-id="A-01"]');
  const target = page.locator('.rts-unit-label[data-unit-id="B-01"]');
  const links = page.locator('.rts-combat-links line');
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();
  await expect(source).toHaveAttribute('data-selected', 'false');
  await expect(target).toHaveAttribute('data-selected', 'false');
  await expect(source).toHaveAttribute('data-combat', /windup|cooldown/);
  await expect(target).toHaveAttribute('data-targeted', 'true');
  await expect(links).not.toHaveCount(0);
  await expect(target).toHaveAttribute('title', /攻撃準備|攻撃後の周期待ち/);
  await page.screenshot({
    path: info.outputPath('combat-state-unselected-desktop.png'),
  });

  await page.setViewportSize({ width: 900, height: 420 });
  await expect(links).not.toHaveCount(0);
  await page.screenshot({
    path: info.outputPath('combat-state-unselected-900x420.png'),
  });

  await expect(page.locator('.rts-combat-shot')).toHaveCount(2, {
    timeout: 15_000,
  });
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  await page.getByRole('button', { name: 'リセット', exact: true }).click();
  await expect(page.locator('.rts-combat-shot')).toHaveCount(0);
});

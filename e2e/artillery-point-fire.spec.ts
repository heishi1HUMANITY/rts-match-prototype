import { test, expect } from './fixtures';

test('F86-01: selected specialized artillery exposes the point-fire command', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.goto('./');
  await page.getByText('検査設定', { exact: true }).click();
  await page
    .getByRole('combobox', { name: '検査シナリオ' })
    .selectOption('f86-point-fire');
  await page
    .getByRole('button', { name: '適用してリセット', exact: true })
    .evaluate((button) => (button as HTMLButtonElement).click());
  await expect(page.locator('.test-settings')).not.toHaveAttribute('open');
  await expect(page.locator('.scenario-badge')).toContainText('地点砲撃');
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await expect(page.locator('.tick-readout')).toHaveText(
    /TICK [1-9]\d* · RUNNING/,
  );
  await page.locator('[data-unit="A-01"]').click();

  const pointFire = page.locator('[data-action="point-fire"]');
  await expect(pointFire).toBeVisible();
  await expect(pointFire).toBeEnabled();
  await pointFire.click();
  await expect(page.locator('.status[role="status"]')).toContainText(
    '射程内の地面をタップ',
  );
  const board = page.locator('.board-host canvas');
  const bounds = await board.boundingBox();
  expect(bounds).not.toBeNull();
  const artilleryLabel = await page
    .locator('[data-unit-id="A-01"]')
    .boundingBox();
  expect(artilleryLabel).not.toBeNull();
  await board.click({
    position: {
      x: artilleryLabel!.x - bounds!.x + artilleryLabel!.width / 2,
      y: artilleryLabel!.y - bounds!.y + artilleryLabel!.height / 2,
    },
  });
  await expect(page.locator('.status[role="status"]')).not.toContainText(
    '射程内の地面をタップ',
  );
  await expect(page.locator('.status[role="status"]')).not.toContainText(
    '追跡先を指定できません',
  );
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  await expect(page.locator('.tick-readout')).toContainText('PAUSED');
  const pausedAt = Number(
    (await page.locator('.tick-readout').textContent())?.match(/TICK (\d+)/)?.[1],
  );
  expect(Number.isFinite(pausedAt)).toBe(true);
  await page.getByRole('button', { name: '再開', exact: true }).click();
  await page.waitForFunction(
    (minimumTick) => {
      const text = document.querySelector('.tick-readout')?.textContent ?? '';
      const tick = Number(text.match(/TICK (\d+)/)?.[1]);
      return Number.isFinite(tick) && tick >= minimumTick;
    },
    pausedAt + 10,
  );
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  await expect(page.locator('.tick-readout')).toContainText('PAUSED');
  await page.getByRole('button', { name: '作戦', exact: true }).click();
  await expect(page.locator('[data-ability-active]')).toContainText(
    '砲撃着弾まで',
    { timeout: 5_000 },
  );
  await page.screenshot({ path: info.outputPath('point-fire-command.png') });
});

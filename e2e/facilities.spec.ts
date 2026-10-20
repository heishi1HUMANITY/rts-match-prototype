import { readFile } from 'node:fs/promises';
import { test, expect, saveDiagnostic } from './fixtures';

test('F11-01: standard match explains research and phase restrictions', async ({
  page,
}, info) => {
  await page.goto('./');
  await page.getByRole('button', { name: '施設', exact: true }).click();
  await expect(page.locator('[data-facility-build="turret"]')).toBeDisabled();
  await expect(page.locator('[data-facility-reason="turret"]')).toContainText(
    '開始',
  );
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await expect(page.locator('[data-facility-reason="turret"]')).toContainText(
    '解放研究',
  );
  await expect(page.locator('[data-facility-build="turret"]')).toBeDisabled();
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  const path = info.outputPath('locked-facilities.json');
  await saveDiagnostic(page, path);
  expect(JSON.parse(await readFile(path, 'utf8')).state.facilities).toEqual([]);
  await page.screenshot({ path: info.outputPath('facility-restrictions.png') });
});

test('F11-01 / F11-02 / F11-03: build all five facilities, observe completion and replay', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.goto('./');
  // Keep the real build ticks while bounding wall time at the legacy 100ms tick.
  await page.getByRole('button', { name: 'マスタ', exact: true }).click();
  const tickLength = page.locator('[data-master-path="match.tickDurationMs"]');
  await expect(tickLength).toHaveValue('200');
  await tickLength.fill('100');
  await page.locator('[data-master-start]').click();
  await page.getByText('検査設定', { exact: true }).click();
  await page
    .getByRole('combobox', { name: '検査シナリオ' })
    .selectOption('f11-facilities');
  await page
    .getByRole('button', { name: '適用してリセット', exact: true })
    .click();
  await expect(page.locator('.test-settings')).not.toHaveAttribute('open');
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await page.getByRole('button', { name: '施設', exact: true }).click();
  await page.locator('[data-facility-anchor]').selectOption('base:HQ-A');
  for (const kind of ['turret', 'antiAir', 'mine', 'watchtower', 'jammer']) {
    await page
      .locator('[data-facility-anchor]')
      .selectOption(
        kind === 'jammer'
          ? 'base:MID-02'
          : kind === 'mine' || kind === 'watchtower'
            ? 'base:OUT-03'
            : 'base:HQ-A',
      );
    const build = page.locator(`[data-facility-build="${kind}"]`);
    await expect(build).toBeEnabled();
    await build.click();
    await expect(build).toBeDisabled();
    await expect(
      page.locator(`[data-facility-reason="${kind}"]`),
    ).toContainText('同じ種類');
  }
  await expect(page.locator('[data-facility-status]')).not.toContainText(
    '建築中',
    { timeout: 45_000 },
  );
  await expect(page.locator('[data-facility-status]')).toContainText('妨害塔');
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  const path = info.outputPath('completed-facilities.json');
  await saveDiagnostic(page, path);
  const diagnostic = JSON.parse(await readFile(path, 'utf8'));
  expect(diagnostic.state.facilities).toHaveLength(5);
  for (const facility of diagnostic.state.facilities) {
    expect(facility).toMatchObject({
      owner: 'A',
      remainingBuildTicks: 0,
      anchor: { kind: 'base' },
    });
    expect(facility.hp).toBe(
      diagnostic.state.rules.facilities.definitions[facility.kind].maxHp,
    );
  }
  const builds = diagnostic.history.filter(
    (entry: any) => entry.command?.type === 'build-facility',
  );
  expect(builds).toHaveLength(5);
  expect(builds.every((entry: any) => entry.ok)).toBe(true);
  await page.screenshot({ path: info.outputPath('facilities-complete.png') });
  await page.getByRole('button', { name: 'リセット', exact: true }).click();
  await expect(page.locator('[data-facility-status]')).toContainText(
    '施設がありません',
  );
});

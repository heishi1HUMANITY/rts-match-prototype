import { readFile } from 'node:fs/promises';
import { test, expect, saveDiagnostic, openMenu } from './fixtures';

// IDs map to docs/project/inspection/G1_SCENARIOS.md.
// This foundation covers the stated subsets, not every historical scenario.
test('G1-07 / G1-09 / G1-12 / G1-13: start, pause, reset and diagnostic smoke', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  const tick = page.locator('.tick-readout');
  const board = page.locator('.board-host canvas');
  await expect(tick).toHaveText('TICK 0 · READY');
  await expect(board).toBeVisible();
  const bounds = await board.boundingBox();
  expect(bounds!.width).toBeGreaterThan(200);
  expect(bounds!.height).toBeGreaterThan(100);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await expect(tick).toHaveText(/TICK [1-9]\d* · RUNNING/);
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  await expect(tick).toContainText('PAUSED');
  const pausedTick = await tick.textContent();
  await page.waitForTimeout(350);
  await expect(tick).toHaveText(pausedTick!);

  const diagnosticPath = testInfo.outputPath('smoke-diagnostic.json');
  await saveDiagnostic(page, diagnosticPath);
  const diagnostic = JSON.parse(await readFile(diagnosticPath, 'utf8'));
  expect(diagnostic.seed).toBe(42);
  expect(diagnostic.scenarioId).toBe('standard');
  expect(diagnostic.phase).toBe('paused');
  expect(diagnostic.mapId).toBe('ring-three-fronts-100');
  expect(diagnostic.rules.width).toBe(100);
  expect(diagnostic.timing.measuredTickCount).toBeGreaterThan(0);
  expect(diagnostic.history).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ command: { type: 'start' }, ok: true }),
      expect.objectContaining({ command: { type: 'pause' }, ok: true }),
    ]),
  );
  await testInfo.attach('diagnostic-export-smoke', {
    path: diagnosticPath,
    contentType: 'application/json',
  });
  await page.getByRole('button', { name: '再開', exact: true }).click();
  await expect(tick).toContainText('RUNNING');
  await openMenu(page);
  await page.getByRole('button', { name: 'リセット', exact: true }).click();
  await expect(tick).toHaveText('TICK 0 · READY');
  await page.screenshot({ path: testInfo.outputPath('ready.png') });
  expect(errors).toEqual([]);
});

test('G1-10 / G1-11: seed changes only after valid apply', async ({ page }) => {
  await page.goto('./');
  await openMenu(page);
  await page.getByText('検査設定', { exact: true }).click();
  const seed = page.getByRole('spinbutton', {
    name: '試合seed',
    includeHidden: true,
  });
  await seed.fill('-1');
  await page.getByRole('button', { name: '適用してリセット' }).click();
  await expect(seed).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.status[role="status"]')).toContainText('seedは');
  await seed.fill('43');
  await page.getByRole('button', { name: '適用してリセット' }).click();
  await expect(page.locator('.status[role="status"]')).toContainText('seed 43');
  await expect(seed).not.toHaveAttribute('aria-invalid');
  await expect(page.locator('.test-settings')).not.toHaveAttribute('open');
});

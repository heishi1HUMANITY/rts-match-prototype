import { readFile } from 'node:fs/promises';
import { cellPoint, expect, focusCell, saveDiagnostic, test } from './fixtures';

test('100-cell map supports two objective fronts after a legal bridge build', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.goto('./');
  const board = page.locator('.board-host canvas');
  await expect(board).toBeVisible();
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await page.getByRole('button', { name: '拠点', exact: true }).click();
  await page.locator('[data-action="crossings"]').click();
  await page.locator('[data-unit="A-01"]').click();
  const unseenEndpoint = page.locator(
    '[data-map-crossing-endpoint="CROSS-RING-N:A"]',
  );
  await expect(unseenEndpoint).toHaveText(/\d+A/);
  await expect(unseenEndpoint).not.toContainText('所有');
  await expect(
    page.locator('[data-map-crossing-endpoint="CROSS-RING-SW:B"]'),
  ).toBeAttached();
  await page.locator('[data-crossing-endpoint="CROSS-RING-SW:A"]').click();
  const bridgeBuild = page.locator('[data-crossing-build="CROSS-RING-SW"]');
  await expect(bridgeBuild).toBeEnabled({ timeout: 30_000 });
  await bridgeBuild.click();
  await expect(
    page.locator('[data-crossing="CROSS-RING-SW"] .crossing-status'),
  ).toContainText('A所有', { timeout: 60_000 });
  await page.locator('[data-crossing-endpoint="CROSS-RING-SW:B"]').click();
  const bridgeDismantle = page.locator(
    '[data-crossing-dismantle="CROSS-RING-SW"]',
  );
  await expect(bridgeDismantle).toBeEnabled({ timeout: 30_000 });
  await bridgeDismantle.click();
  await expect(
    page.locator('[data-crossing="CROSS-RING-SW"] .crossing-status'),
  ).toContainText('未建設', { timeout: 60_000 });
  await expect(bridgeBuild).toBeEnabled({ timeout: 30_000 });
  await bridgeBuild.click();
  await expect(
    page.locator('[data-crossing="CROSS-RING-SW"] .crossing-status'),
  ).toContainText('A所有', { timeout: 60_000 });
  await page.locator('[data-action="camera"]').click();
  await page
    .locator('.base-sheet')
    .getByRole('button', { name: 'パネルを閉じる' })
    .click();
  // The camera shows at most 1/9 of the map, so far objectives are ordered from
  // the base pop's "ここへ移動" after centring the view on the base.
  const marchTo = async (unitId: string, base: { x: number; y: number }) => {
    await page.locator(`[data-unit="${unitId}"]`).click();
    await focusCell(page, base.x, base.y);
    const point = await cellPoint(page, base.x, base.y);
    expect(point).not.toBeNull();
    await page.mouse.click(point!.x, point!.y);
    const march = page.getByRole('button', { name: 'ここへ移動', exact: true });
    await expect(march).toBeEnabled();
    await march.click();
  };
  await marchTo('A-01', { x: 47, y: 40 }); // A-01 → OUT-01
  await marchTo('A-02', { x: 30, y: 73 }); // A-02 → MID-02
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  const path = info.outputPath('two-objective-fronts.json');
  await saveDiagnostic(page, path);
  const diagnostic = JSON.parse(await readFile(path, 'utf8'));
  expect(
    diagnostic.state.factions.map(
      (faction: { id: string; controller: string }) => ({
        id: faction.id,
        controller: faction.controller,
      }),
    ),
  ).toEqual([
    { id: 'A', controller: 'human' },
    { id: 'B', controller: 'bot' },
    { id: 'C', controller: 'bot' },
  ]);
  const bridge = diagnostic.history.find(
    (entry: { command?: { siteId?: string }; ok: boolean }) =>
      entry.command?.siteId === 'CROSS-RING-SW' && entry.ok,
  );
  expect(bridge).toBeDefined();
  expect(
    diagnostic.state.crossings.find(
      (crossing: { siteId: string }) => crossing.siteId === 'CROSS-RING-SW',
    ),
  ).toMatchObject({ owner: 'A', job: null });
  const marches = diagnostic.history.filter(
    (entry: { command?: { type?: string }; ok: boolean }) =>
      entry.command?.type === 'march' && entry.ok,
  );
  expect(marches).toHaveLength(2);
  expect(
    marches.map(
      (entry: { command: { target: { id: string } } }) =>
        entry.command.target.id,
    ),
  ).toEqual(['OUT-01', 'MID-02']);
  const scout = diagnostic.state.units.find(
    (unit: { id: string }) => unit.id === 'A-02',
  );
  expect(scout.marchOrder.target.id).toBe('MID-02');
  expect(scout.path).toContainEqual({ x: 30, y: 73 });
  expect(diagnostic.timing.measuredTickCount).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('two-objective-fronts.png') });
});

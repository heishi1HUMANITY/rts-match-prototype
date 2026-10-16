import { readFile } from 'node:fs/promises';
import { expect, saveDiagnostic, test } from './fixtures';

test('100-cell map supports two objective fronts after a legal bridge build', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.goto('./');
  const board = page.locator('.board-host canvas');
  await expect(board).toBeVisible();
  await page.getByRole('button', { name: '開始', exact: true }).click();
  const rect = await board.boundingBox();
  expect(rect).not.toBeNull();
  const elevationSin = 32 / Math.hypot(32, 28);
  const aspect = rect!.width / rect!.height;
  const visibleHeight = Math.max(100 * elevationSin, 100 / aspect) * 1.25;
  const targetPoint = (x: number, y: number) => ({
    x:
      rect!.x +
      rect!.width / 2 +
      ((x + 0.5 - 50) / (visibleHeight * aspect)) * rect!.width,
    y:
      rect!.y +
      rect!.height / 2 +
      ((elevationSin * (y + 0.5 - 50)) / visibleHeight) * rect!.height,
  });
  await page.locator('[data-action="crossings"]').click();
  await page.locator('[data-unit="A-01"]').click();
  const bridgeBank = targetPoint(28, 50);
  await page.mouse.click(bridgeBank.x, bridgeBank.y);
  const bridgeBuild = page.locator('[data-crossing-build="CROSS-RING-SW"]');
  await expect(bridgeBuild).toBeEnabled({ timeout: 30_000 });
  await bridgeBuild.click();
  await expect(
    page.locator('[data-crossing="CROSS-RING-SW"] .crossing-status'),
  ).toContainText('A所有', { timeout: 60_000 });
  await page.locator('[data-action="crossings"]').click();
  const dragTo = async (
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => {
    const source = targetPoint(from.x, from.y);
    const target = targetPoint(to.x, to.y);
    await page.mouse.move(source.x, source.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 10 });
    await page.mouse.up();
  };
  await dragTo({ x: 28, y: 50 }, { x: 45, y: 43 }); // A-01 → OUT-01
  await dragTo({ x: 15, y: 53 }, { x: 50, y: 50 }); // A-02 → OUT-02
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
  ).toEqual(['OUT-01', 'OUT-02']);
  const scout = diagnostic.state.units.find(
    (unit: { id: string }) => unit.id === 'A-02',
  );
  expect(scout.marchOrder.target.id).toBe('OUT-02');
  expect(scout.path).toContainEqual({ x: 33, y: 50 });
  expect(diagnostic.timing.measuredTickCount).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('two-objective-fronts.png') });
});

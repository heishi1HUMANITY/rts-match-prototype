import { readFile } from 'node:fs/promises';
import { expect, saveDiagnostic, test } from './fixtures';

test('100-cell map accepts two independent movement orders', async ({
  page,
}, info) => {
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
  for (const [unit, target] of [
    ['A-01', targetPoint(20, 65)],
    ['A-02', targetPoint(25, 60)],
  ] as const) {
    await page.locator(`[data-unit="${unit}"]`).click();
    await page.mouse.click(target.x, target.y);
  }
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  const path = info.outputPath('two-fronts.json');
  await saveDiagnostic(page, path);
  const diagnostic = JSON.parse(await readFile(path, 'utf8'));
  const moves = diagnostic.history.filter(
    (entry: { command?: { type?: string }; ok: boolean }) =>
      entry.command?.type === 'move' && entry.ok,
  );
  expect(moves).toHaveLength(2);
  expect(
    moves.map(
      (entry: { command: { target: { y: number } } }) => entry.command.target.y,
    ),
  ).toEqual([65, 60]);
  expect(diagnostic.timing.measuredTickCount).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('two-fronts.png') });
});

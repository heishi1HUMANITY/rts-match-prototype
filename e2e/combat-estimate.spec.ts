import { readFile } from 'node:fs/promises';
import { expect, saveDiagnostic, test } from './fixtures';

test('F88: drag preview shows bounded visible-force estimate and cancel adds no command', async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  await page.goto('./');
  await page.getByRole('button', { name: 'マスタ', exact: true }).click();
  const horizon = page.locator('[data-master-path="combatEstimate.maxTicks"]');
  await expect(horizon).toHaveValue('1200');
  await page.locator('[data-master-close]').click();
  await page.getByText('検査設定', { exact: true }).click();
  await page
    .getByRole('combobox', { name: '検査シナリオ' })
    .selectOption('f88-combat-estimate');
  await page.getByRole('button', { name: '適用してリセット' }).click();
  await page.getByRole('button', { name: '開始', exact: true }).click();

  const beforePath = info.outputPath('combat-estimate-before.json');
  await saveDiagnostic(page, beforePath);
  const before = JSON.parse(await readFile(beforePath, 'utf8'));

  const board = page.locator('.board-host canvas');
  const own = page.locator('.rts-unit-label[data-unit-id="A-01"]');
  const enemy = page.locator('.rts-unit-label[data-unit-id="B-01"]');
  await expect(own).toBeVisible();
  await expect(enemy).toBeVisible();
  const from = await own.boundingBox();
  const to = await enemy.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();

  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, {
    steps: 8,
  });
  const estimate = page.getByTestId('combat-estimate');
  await expect(estimate).toBeVisible();
  await expect(estimate).toContainText(/有利|拮抗|不利|未決着|予測不可/);
  await expect(estimate).toContainText('結果保証ではありません');
  await page.screenshot({
    path: info.outputPath('combat-estimate-desktop.png'),
  });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.getByRole('button', { name: '一時停止', exact: true }).click();

  const diagnosticPath = info.outputPath('combat-estimate-cancel.json');
  await saveDiagnostic(page, diagnosticPath);
  const diagnostic = JSON.parse(await readFile(diagnosticPath, 'utf8'));
  expect(diagnostic.history.slice(0, before.history.length)).toEqual(
    before.history,
  );
  expect(diagnostic.history.at(-1)?.command?.type).toBe('pause');
  expect(
    diagnostic.state.factions.map((faction: unknown) => ({
      id: (faction as { id: string }).id,
      productionJobs: (faction as { productionJobs: unknown }).productionJobs,
      activeResearch: (faction as { activeResearch: unknown }).activeResearch,
    })),
  ).toEqual(
    before.state.factions.map((faction: unknown) => ({
      id: (faction as { id: string }).id,
      productionJobs: (faction as { productionJobs: unknown }).productionJobs,
      activeResearch: (faction as { activeResearch: unknown }).activeResearch,
    })),
  );
  for (const resource of ['supplyCenti', 'researchCenti', 'ticketsCenti']) {
    expect(diagnostic.state.factions[0][resource]).toBeGreaterThanOrEqual(
      before.state.factions[0][resource],
    );
  }
  expect(diagnostic.state.units).toEqual(before.state.units);
  expect(diagnostic.state.bases).toEqual(before.state.bases);
  expect(diagnostic.state.facilities).toEqual(before.state.facilities);
  expect(diagnostic.state.scheduledStrikes).toEqual(
    before.state.scheduledStrikes,
  );

  await page.setViewportSize({ width: 900, height: 420 });
  await page.getByRole('button', { name: '再開', exact: true }).click();
  const resizedFrom = await own.boundingBox();
  const resizedTo = await enemy.boundingBox();
  expect(resizedFrom).not.toBeNull();
  expect(resizedTo).not.toBeNull();
  await page.mouse.move(
    resizedFrom!.x + resizedFrom!.width / 2,
    resizedFrom!.y + resizedFrom!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    resizedTo!.x + resizedTo!.width / 2,
    resizedTo!.y + resizedTo!.height / 2,
    { steps: 8 },
  );
  await expect(estimate).toBeVisible();
  await page.screenshot({
    path: info.outputPath('combat-estimate-900x420.png'),
  });
  const bounds = await board.boundingBox();
  expect(bounds).not.toBeNull();
  const panelBounds = await estimate.boundingBox();
  expect(panelBounds).not.toBeNull();
  expect(panelBounds!.x).toBeGreaterThanOrEqual(bounds!.x);
  expect(panelBounds!.x + panelBounds!.width).toBeLessThanOrEqual(
    bounds!.x + bounds!.width + 1,
  );
  await page.keyboard.press('Escape');
  await page.mouse.up();
});

import { readFile } from 'node:fs/promises';
import { test, expect, saveDiagnostic } from './fixtures';

test('NPC-R01-01 / 03 / 04: standard pacing, live orders, diagnostic and reset', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'マスタ', exact: true }).click();
  await page.getByRole('button', { name: '標準値へ戻す', exact: true }).click();
  await expect(
    page.locator('[data-master-path="npc.decisionIntervalTicks"]'),
  ).toHaveValue('30');
  await expect(
    page.locator('[data-master-path="npc.maxCommandsPerDecision"]'),
  ).toHaveValue('2');
  await page
    .getByRole('button', { name: '保存値で新しく開始', exact: true })
    .click();
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await expect(page.locator('.tick-readout')).toHaveText(
    /TICK (?:[6-9]\d|[1-9]\d{2,}) · RUNNING/,
    { timeout: 15_000 },
  );
  await page.getByRole('button', { name: '一時停止', exact: true }).click();
  const paused = await page.locator('.tick-readout').textContent();
  const path = testInfo.outputPath('npc-pacing-diagnostic.json');
  await saveDiagnostic(page, path);
  const diagnostic = JSON.parse(await readFile(path, 'utf8'));
  expect(diagnostic.scenarioId).toBe('standard');
  const build = await (await page.request.get('./build-info.json')).json();
  expect(diagnostic.rules.rulesVersion).toBe(build.rulesVersion);
  expect(diagnostic.rules.rules.npc).toMatchObject({
    decisionIntervalTicks: 30,
    maxCommandsPerDecision: 2,
  });
  for (const id of ['B', 'C']) {
    const faction = diagnostic.state.factions.find(
      (entry: { id: string }) => entry.id === id,
    );
    expect(faction.productionJobs.length).toBeGreaterThan(0);
    expect(faction.activeResearch?.researchId).toBe('firepower-1');
    expect(
      diagnostic.state.units.filter(
        (unit: { factionId: string; marchOrder: unknown }) =>
          unit.factionId === id && unit.marchOrder,
      ).length,
    ).toBeGreaterThan(0);
  }
  await testInfo.attach('npc-pacing-diagnostic', {
    path,
    contentType: 'application/json',
  });
  await expect(page.locator('.tick-readout')).toHaveText(paused!);
  await page.screenshot({ path: testInfo.outputPath('npc-pacing-paused.png') });
  await page.getByRole('button', { name: '再開', exact: true }).click();
  await expect(page.locator('.tick-readout')).toContainText('RUNNING');
  await page.getByRole('button', { name: 'リセット', exact: true }).click();
  await expect(page.locator('.tick-readout')).toHaveText('TICK 0 · READY');
});

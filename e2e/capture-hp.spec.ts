import { readFile } from 'node:fs/promises';
import { test, expect, saveDiagnostic, openMenu } from './fixtures';

// Two real diagnostic downloads plus a page reload exercise storage/replay.
// Software WebGL on CI can take longer than the default 30-second test budget.
test.setTimeout(90_000);

for (const percent of [30, 50]) {
  test(`F19-01 / F19-02 / F19-04: ${percent}% captures all base sizes with saved snapshot`, async ({
    page,
  }, testInfo) => {
    await page.goto('./');
    await openMenu(page);
    await page.getByText('検査設定', { exact: true }).click();
    await page
      .getByRole('combobox', { name: '検査シナリオ' })
      .selectOption('f19-capture');
    await page
      .getByRole('button', { name: '適用してリセット', exact: true })
      .click();
    await openMenu(page);
    await page.getByRole('button', { name: 'マスタ', exact: true }).click();
    const ratio = page.locator(
      '[data-master-path="capture.restoredHpPercent"]',
    );
    await expect(ratio).toHaveValue('30');
    await ratio.fill(String(percent));
    await page.locator('[data-master-path="capture.requiredTicks"]').fill('30');
    await page
      .locator('[data-master-path="baseUpgrades.recoveryDelayTicks"]')
      .fill('10000');
    await page.getByRole('button', { name: '保存する', exact: true }).click();
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await page.reload();
    await openMenu(page);
    await page.getByText('検査設定', { exact: true }).click();
    await page
      .getByRole('combobox', { name: '検査シナリオ' })
      .selectOption('f19-capture');
    await page
      .getByRole('button', { name: '適用してリセット', exact: true })
      .click();
    await page.getByRole('button', { name: '開始', exact: true }).click();
    await expect(page.locator('.tick-readout')).toHaveText(
      /TICK (?:[3-9]\d|[1-9]\d{2,}) · RUNNING/,
      { timeout: 15_000 },
    );
    await page.getByRole('button', { name: '一時停止', exact: true }).click();
    const path = testInfo.outputPath(`capture-${percent}.json`);
    await saveDiagnostic(page, path);
    const diagnostic = JSON.parse(await readFile(path, 'utf8'));
    expect(diagnostic.rules.rules.capture.restoredHpPercent).toBe(percent);
    for (const [id, kind] of [
      ['OUT-03', 'outpost'],
      ['MID-02', 'medium'],
      ['OUT-02', 'large'],
    ]) {
      const base = diagnostic.state.bases.find(
        (entry: { id: string }) => entry.id === id,
      );
      expect(base).toMatchObject({
        owner: 'A',
        kind,
        level: 1,
        defender: null,
      });
      expect(base.hp).toBe(
        Math.max(1, Math.floor((base.maxHp * percent) / 100)),
      );
    }
    // Saving another draft must not rewrite the paused active snapshot.
    await openMenu(page);
    await page.getByRole('button', { name: 'マスタ', exact: true }).click();
    await ratio.fill('75');
    await page.getByRole('button', { name: '保存する', exact: true }).click();
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    const afterPath = testInfo.outputPath(`active-after-save-${percent}.json`);
    await saveDiagnostic(page, afterPath);
    const after = JSON.parse(await readFile(afterPath, 'utf8'));
    expect(after.state).toEqual(diagnostic.state);
    await page.screenshot({
      path: testInfo.outputPath(`captured-${percent}.png`),
    });
  });
}

test('F19-03: invalid save/import keeps stored master and active snapshot', async ({
  page,
}, testInfo) => {
  await page.goto('./');
  const stored = () =>
    page.evaluate(() => localStorage.getItem('rts-match-prototype.master.v1'));
  await openMenu(page);
  await page.getByRole('button', { name: 'マスタ', exact: true }).click();
  await page.getByRole('button', { name: '保存する', exact: true }).click();
  const original = await stored();
  const ratio = page.locator('[data-master-path="capture.restoredHpPercent"]');
  for (const value of ['0', '101', '1.5']) {
    await ratio.fill(value);
    await page.getByRole('button', { name: '保存する', exact: true }).click();
    await expect(page.locator('.master-error')).not.toBeEmpty();
    expect(await stored()).toBe(original);
  }
  const invalid = JSON.parse(original!);
  invalid.rules.capture.restoredHpPercent = 1e300;
  const json = JSON.stringify(invalid).replace('1e+300', '1e400');
  await page.locator('#master-json-input').fill(json);
  await page
    .getByRole('button', { name: 'JSONを検証して読込', exact: true })
    .click();
  await expect(page.locator('.master-error')).not.toBeEmpty();
  expect(await stored()).toBe(original);
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  const path = testInfo.outputPath('invalid-master-active.json');
  await saveDiagnostic(page, path);
  const diagnostic = JSON.parse(await readFile(path, 'utf8'));
  expect(diagnostic.state.elapsedTicks).toBe(0);
  expect(diagnostic.state.rules.capture.restoredHpPercent).toBe(30);
});

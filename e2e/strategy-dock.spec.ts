import { expect, test } from './fixtures';

test('operation tabs stay beside the content and remain available after closing', async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  await page.goto('./');
  const dock = page.locator('.strategy-dock');
  const tabs = dock.locator('.strategy-tabs');
  const panel = dock.locator('.strategy-panel');
  await expect(dock).toBeVisible();
  await expect(panel).toBeVisible();
  const board = (await page.locator('.board-host canvas').boundingBox())!;
  const dockRect = (await dock.boundingBox())!;
  expect(board.x + board.width).toBeLessThanOrEqual(dockRect.x);
  const viewport = page.viewportSize()!;
  expect(dockRect.x + dockRect.width).toBeLessThanOrEqual(viewport.width);
  expect(dockRect.y + dockRect.height).toBeLessThanOrEqual(viewport.height);
  for (const [label, heading] of [
    ['研究', '戦力研究'],
    ['拠点', '拠点情報'],
    ['渡河', '橋・索道'],
    ['施設', '防御施設'],
    ['作戦', '作戦指令'],
    ['生産', '部隊生産'],
  ] as const) {
    const button = tabs.getByRole('button', { name: label, exact: true });
    await button.click();
    await expect(panel.locator('[data-panel-title]')).toHaveText(heading);
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    if (label === '研究') {
      const cards = panel.locator('[data-research-details]');
      await expect(cards).toHaveCount(29);
      const first = panel.locator('[data-research-details="firepower-1"]');
      await expect(first).toContainText('必要96ポイント');
      await first.scrollIntoViewIfNeeded();
      await expect(first).toBeInViewport();
      const specialization = panel.locator(
        '[data-research-details="specialization-power"]',
      );
      await expect(specialization).toContainText('排他');
      await specialization.scrollIntoViewIfNeeded();
      await expect(specialization).toBeInViewport();
      for (const id of [
        'specialization-wartime-economy',
        'specialization-logistics',
        'specialization-information',
        'specialization-engineering',
        'specialization-information-warfare',
      ])
        await expect(
          panel.locator(`[data-research-details="${id}"]`),
        ).toBeAttached();
    }
    await button.click();
    await expect(panel).toBeVisible();
  }
  await dock.getByRole('button', { name: '閉じる ×', exact: true }).click();
  await expect(panel).toBeHidden();
  await expect(tabs).toBeVisible();
  await tabs.getByRole('button', { name: '研究', exact: true }).click();
  await expect(panel).toBeVisible();
  await expect(page.locator('.tick-readout')).toContainText('TICK 0');
  await panel
    .locator('[data-research-details="specialization-power"]')
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('strategy-dock.png') });
});

import { expect, test } from './fixtures';

test('mock HUD blocks stay inside the viewport without overlapping', async ({
  page,
}, info) => {
  await page.goto('./');
  await expect(page.locator('.board-host canvas')).toBeVisible();
  const viewport = page.viewportSize()!;
  const blocks = [
    '.hud-system',
    '.hud-top .tickets',
    '.hud-map',
    '.left-bottom',
    '.hud-squads',
    '.addon-dock',
  ];
  const boxes = [];
  for (const selector of blocks) {
    const box = (await page.locator(selector).boundingBox())!;
    expect(box, selector).not.toBeNull();
    expect(box.x, selector).toBeGreaterThanOrEqual(0);
    expect(box.y, selector).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, selector).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height, selector).toBeLessThanOrEqual(viewport.height);
    boxes.push({ selector, ...box });
  }
  for (const [index, a] of boxes.entries())
    for (const b of boxes.slice(index + 1)) {
      const overlap =
        a.x < b.x + b.width &&
        b.x < a.x + a.width &&
        a.y < b.y + b.height &&
        b.y < a.y + a.height;
      expect(overlap, `${a.selector} overlaps ${b.selector}`).toBe(false);
    }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath('hud-ready.png') });
});

test('BASE sheet tabs, base pop, research tiers and orders open and close', async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  await page.goto('./');
  const viewport = page.viewportSize()!;
  const sheet = page.locator('.base-sheet');
  await expect(sheet).toBeHidden();
  const baseButton = page.getByRole('button', { name: '拠点', exact: true });
  await baseButton.click();
  await expect(sheet).toBeVisible();
  await expect(baseButton).toHaveAttribute('aria-expanded', 'true');
  const sheetBox = (await sheet.boundingBox())!;
  expect(sheetBox.x + sheetBox.width).toBeLessThanOrEqual(viewport.width);
  expect(sheetBox.y + sheetBox.height).toBeLessThanOrEqual(viewport.height);
  for (const [label, heading] of [
    ['防御施設', '防御施設'],
    ['渡河', '橋・索道'],
    ['生産', '部隊生産'],
  ] as const) {
    const tab = sheet.getByRole('button', { name: label, exact: true });
    await tab.click();
    await expect(sheet.locator('[data-panel-title]')).toHaveText(heading);
    await expect(tab).toHaveAttribute('aria-expanded', 'true');
  }
  await expect(page.locator('[data-produce="assault"]')).toBeInViewport();
  await sheet.getByRole('button', { name: '拠点情報', exact: true }).click();
  await expect(sheet).toBeHidden();
  const pop = page.locator('.base-pop');
  await expect(pop).toBeVisible();
  await expect(pop.locator('.base-detail')).toContainText('HQ-A');
  await pop.getByRole('button', { name: 'パネルを閉じる' }).click();
  await expect(pop).toBeHidden();

  await page.getByRole('button', { name: '研究', exact: true }).click();
  const research = page.locator('.research-sheet');
  await expect(research).toBeVisible();
  await expect(research.locator('[data-research-details]')).toHaveCount(29);
  const first = research.locator('[data-research-details="firepower-1"]');
  await expect(first).toContainText('必要96ポイント');
  await first.scrollIntoViewIfNeeded();
  await expect(first).toBeInViewport();
  const specialization = research.locator(
    '[data-research-details="specialization-power"]',
  );
  await expect(specialization).toContainText('排他');
  await specialization.scrollIntoViewIfNeeded();
  await expect(specialization).toBeInViewport();
  await research.locator('[data-research-domain="engineering"]').click();
  await expect(
    research.locator('[data-research-details="specialization-engineering"]'),
  ).toBeVisible();
  await expect(specialization).toBeHidden();
  await page.screenshot({ path: info.outputPath('research-sheet.png') });
  await research.getByRole('button', { name: '戻る', exact: true }).click();
  await expect(research).toBeHidden();

  const orders = page.getByRole('button', { name: '作戦', exact: true });
  await orders.click();
  await expect(page.locator('.addon-dock')).toHaveClass(/expanded/);
  await expect(page.locator('[data-ability-details="bulwark"]')).toBeVisible();
  await orders.click();
  await expect(page.locator('.addon-dock')).not.toHaveClass(/expanded/);
  await expect(page.locator('.tick-readout')).toContainText('TICK 0');
});

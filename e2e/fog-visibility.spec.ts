import { expect, saveDiagnostic, test } from './fixtures';

test('fog remains on the board through camera changes, resize and restart', async ({
  page,
}, info) => {
  await page.goto('./');
  const canvas = page.locator('.board-host canvas');
  await expect(canvas).toBeVisible();
  await page.screenshot({ path: info.outputPath('fog-initial.png') });

  await page.getByRole('button', { name: '開始', exact: true }).click();
  await page.screenshot({ path: info.outputPath('fog-started.png') });
  await saveDiagnostic(page, info.outputPath('fog-started.json'));
  const rect = await canvas.boundingBox();
  expect(rect).not.toBeNull();
  const center = {
    x: rect!.x + rect!.width / 2,
    y: rect!.y + rect!.height / 2,
  };
  await page.mouse.move(center.x, center.y);
  await page.mouse.wheel(0, -240);
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 24, center.y + 18, { steps: 4 });
  await page.mouse.up();

  const originalViewport = page.viewportSize();
  await page.setViewportSize({ width: 900, height: 420 });
  await expect(canvas).toBeVisible();
  await page.screenshot({
    path: info.outputPath('fog-landscape-after-camera.png'),
  });
  await page.getByRole('button', { name: 'カメラ', exact: true }).click();
  await page.getByRole('button', { name: 'リセット', exact: true }).click();
  await expect(page.getByText(/開始待ち/)).toBeVisible();
  await expect(canvas).toBeVisible();
  await page.screenshot({ path: info.outputPath('fog-after-restart.png') });
  if (originalViewport) await page.setViewportSize(originalViewport);
});

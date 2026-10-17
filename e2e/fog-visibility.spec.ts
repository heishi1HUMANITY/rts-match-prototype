import { expect, saveDiagnostic, test } from './fixtures';

test('fog covers all map corners and reveals the own-unit cells', async ({
  page,
}, info) => {
  await page.goto('./');
  const canvas = page.locator('.board-host canvas');
  await expect(canvas).toBeVisible();
  const rect = (await canvas.boundingBox())!;
  const elevationSin = 32 / Math.hypot(32, 28);
  const aspect = rect.width / rect.height;
  const visibleHeight = Math.max(100 * elevationSin, 100 / aspect) * 1.25;
  const points = (
    [
      [7, 5],
      [93, 5],
      [93, 92],
      [7, 92],
      [15, 44],
    ] as const
  ).map(([x, y]) => ({
    x: Math.round(
      rect.x +
        rect.width / 2 +
        ((x + 0.5 - 50) / (visibleHeight * aspect)) * rect.width,
    ),
    y: Math.round(
      rect.y +
        rect.height / 2 +
        ((elevationSin * (y + 0.5 - 50)) / visibleHeight) * rect.height,
    ),
  }));
  const screenshot = await page.screenshot({
    path: info.outputPath('fog-coverage.png'),
  });
  // Check the actual rendered pixels: DOM visibility and camera projection alone
  // do not catch a GPU texture that is still allocated at the canvas's 300x150 default.
  const luminances = await page.evaluate(
    async ({ png, samples }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const pixels = document.createElement('canvas');
      pixels.width = image.width;
      pixels.height = image.height;
      const context = pixels.getContext('2d')!;
      context.drawImage(image, 0, 0);
      return samples.map(({ x, y }) => {
        const rgba = context.getImageData(x - 1, y - 1, 3, 3).data;
        let sum = 0;
        for (let p = 0; p < rgba.length; p += 4) {
          sum +=
            rgba[p]! * 0.2126 + rgba[p + 1]! * 0.7152 + rgba[p + 2]! * 0.0722;
        }
        return sum / 9;
      });
    },
    { png: screenshot.toString('base64'), samples: points },
  );
  for (const luminance of luminances.slice(0, 4))
    expect(luminance).toBeLessThan(175);
  expect(luminances[4]).toBeGreaterThan(
    Math.max(...luminances.slice(0, 4)) + 30,
  );
});

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

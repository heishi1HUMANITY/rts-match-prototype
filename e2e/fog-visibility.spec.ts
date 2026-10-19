import { readFile } from 'node:fs/promises';
import { cellPoint, expect, saveDiagnostic, test, openMenu } from './fixtures';

test('haze hides unexplored ground and leaves the own units visible', async ({
  page,
}, info) => {
  await page.goto('./');
  const canvas = page.locator('.board-host canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('.tick-readout')).toHaveText('TICK 0 · READY');
  const diagnosticPath = info.outputPath('haze-ready.json');
  await saveDiagnostic(page, diagnosticPath);
  const diagnostic = JSON.parse(await readFile(diagnosticPath, 'utf8'));
  const width = diagnostic.state.map.width as number;
  const explored = diagnostic.state.knowledge.find(
    (entry: { factionId: string }) => entry.factionId === 'A',
  ).explored as boolean[];
  const unit = diagnostic.state.units.find(
    (entry: { id: string }) => entry.id === 'A-01',
  ) as { cell: { x: number; y: number } };
  // Unexplored cells on screen: scan around the unit for cells the camera shows.
  const hidden: { x: number; y: number }[] = [];
  for (let dy = -12; dy <= 12 && hidden.length < 4; dy += 3)
    for (let dx = -20; dx <= 20 && hidden.length < 4; dx += 4) {
      const x = unit.cell.x + dx;
      const y = unit.cell.y + dy;
      if (x < 0 || y < 0 || x >= width || y >= width) continue;
      let clear = true;
      for (let ny = -2; ny <= 2; ny += 1)
        for (let nx = -2; nx <= 2; nx += 1)
          if (explored[(y + ny) * width + x + nx]) clear = false;
      if (!clear) continue;
      const point = await cellPoint(page, x, y);
      if (point) hidden.push(point);
    }
  expect(hidden.length).toBeGreaterThan(0);
  const own = await cellPoint(page, unit.cell.x, unit.cell.y);
  expect(own).not.toBeNull();
  const screenshot = await page.screenshot({
    path: info.outputPath('haze-coverage.png'),
  });
  // Check rendered pixels: the haze pass must cover unexplored ground with the
  // pale mist colour while the own unit's model stays visible (dark hull).
  const samples = await page.evaluate(
    async ({ png, points }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const pixels = document.createElement('canvas');
      pixels.width = image.width;
      pixels.height = image.height;
      const context = pixels.getContext('2d')!;
      context.drawImage(image, 0, 0);
      return points.map(({ x, y }) => {
        const rgba = context.getImageData(
          Math.round(x) - 1,
          Math.round(y) - 1,
          3,
          3,
        ).data;
        let r = 0;
        let g = 0;
        let b = 0;
        for (let p = 0; p < rgba.length; p += 4) {
          r += rgba[p]!;
          g += rgba[p + 1]!;
          b += rgba[p + 2]!;
        }
        return { r: r / 9, g: g / 9, b: b / 9 };
      });
    },
    { png: screenshot.toString('base64'), points: [own!, ...hidden] },
  );
  const luminance = ({ r, g, b }: { r: number; g: number; b: number }) =>
    r * 0.2126 + g * 0.7152 + b * 0.0722;
  for (const sample of samples.slice(1)) {
    // Haze colour #e6eaee, with a little drift noise.
    expect(luminance(sample)).toBeGreaterThan(205);
    expect(
      Math.max(sample.r, sample.g, sample.b) -
        Math.min(sample.r, sample.g, sample.b),
    ).toBeLessThan(24);
  }
  expect(luminance(samples[0]!)).toBeLessThan(
    Math.min(...samples.slice(1).map(luminance)) - 40,
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
  await openMenu(page);
  await page.getByRole('button', { name: 'リセット', exact: true }).click();
  await expect(page.getByText(/開始待ち/)).toBeVisible();
  await expect(canvas).toBeVisible();
  await page.screenshot({ path: info.outputPath('fog-after-restart.png') });
  if (originalViewport) await page.setViewportSize(originalViewport);
});

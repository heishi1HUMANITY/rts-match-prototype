import { test as base, expect, type Page } from '@playwright/test';

/** Uses the application's real diagnostic exporter, including replay validation. */
export async function saveDiagnostic(page: Page, path: string): Promise<void> {
  // This development action also works behind the result dialog or an open panel.
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5_000 }),
    page
      .locator('[data-action="download"]')
      .first()
      .evaluate((button) => {
        (button as HTMLButtonElement).click();
      }),
  ]);
  await download.saveAs(path);
}

/** Opens the match menu (reset, master editor, test settings) if it is closed. */
export async function openMenu(page: Page): Promise<void> {
  const menu = page.locator('.hud-menu');
  if ((await menu.getAttribute('open')) === null)
    await menu.locator('summary').first().click();
  await expect(menu).toHaveAttribute('open', '');
}

/** Viewport position of a cell centre, or null when it is outside the view. */
export async function cellPoint(
  page: Page,
  x: number,
  y: number,
): Promise<{ x: number; y: number } | null> {
  return page.evaluate(
    ([cx, cy]) =>
      (
        window as unknown as {
          __rtsBoard: {
            projectCell(x: number, y: number): { x: number; y: number } | null;
          };
        }
      ).__rtsBoard.projectCell(cx!, cy!),
    [x, y],
  );
}

/** Centres the board camera on a cell. */
export async function focusCell(
  page: Page,
  x: number,
  y: number,
): Promise<void> {
  await page.evaluate(
    ([cx, cy]) =>
      (
        window as unknown as {
          __rtsBoard: { focusCell(x: number, y: number): void };
        }
      ).__rtsBoard.focusCell(cx!, cy!),
    [x, y],
  );
}

export const test = base.extend<{ failureDiagnostics: void }>({
  failureDiagnostics: [
    async ({ page }, use, testInfo) => {
      await use();
      if (testInfo.status === testInfo.expectedStatus) return;
      try {
        const path = testInfo.outputPath('diagnostic.json');
        await saveDiagnostic(page, path);
        await testInfo.attach('diagnostic', {
          path,
          contentType: 'application/json',
        });
      } catch (error) {
        await testInfo.attach('diagnostic-export-error', {
          body: String(error),
          contentType: 'text/plain',
        });
      }
    },
    { auto: true },
  ],
});

export { expect };

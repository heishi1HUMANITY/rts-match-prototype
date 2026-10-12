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

import { expect, test } from './fixtures';

interface AgentHook {
  step(ticks?: number): { advanced: number; events: string[] };
  dispatch(command: unknown): { ok: boolean; message: string };
  view(): { tick: number; activeResearch: string | null };
  map(scale?: number): string;
}

test('agent mode advances only through explicit steps and accepts shared commands', async ({
  page,
}) => {
  await page.goto('./?agent=1');
  await page.getByRole('button', { name: '開始', exact: true }).click();
  await page.waitForTimeout(1_000);
  const idle = await page.evaluate(
    () => (window as unknown as { __rts: AgentHook }).__rts.view().tick,
  );
  expect(idle).toBe(0);

  const stepped = await page.evaluate(() =>
    (window as unknown as { __rts: AgentHook }).__rts.step(10),
  );
  expect(stepped.advanced).toBe(10);
  await expect(page.locator('.tick-readout')).toContainText('TICK 10');

  const order = await page.evaluate(() =>
    (window as unknown as { __rts: AgentHook }).__rts.dispatch({
      type: 'start-research',
      researchId: 'air-defense-1',
    }),
  );
  expect(order.ok).toBe(true);
  const view = await page.evaluate(() =>
    (window as unknown as { __rts: AgentHook }).__rts.view(),
  );
  expect(view).toMatchObject({ tick: 10, activeResearch: 'air-defense-1' });
  const map = await page.evaluate(() =>
    (window as unknown as { __rts: AgentHook }).__rts.map(4),
  );
  expect(map.split('\n').length).toBeGreaterThan(5);
});

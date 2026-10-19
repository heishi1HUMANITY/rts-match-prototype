import { beforeEach, describe, expect, it } from 'vitest';
import {
  detectSuddenLossTickets,
  getActiveSuddenLoss,
  resetTicketsHud,
  updateTicketsHud,
} from './tickets';
import type { PlayerSnapshot } from '../runtime/controller';
import type { FactionView } from '../simulation/types';
import type { HudElements } from './hud';
import { createMatch } from '../simulation/match';
import { getFactionView } from '../simulation/view';

class FakeElement {
  tagName: string;
  className = '';
  hidden = false;
  textContent = '';
  style: Record<string, string> & { cssText: string } = { cssText: '' };
  private attributes = new Map<string, string>();
  children: FakeElement[] = [];

  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
  }

  setAttribute(k: string, v: string) {
    this.attributes.set(k, v);
  }

  getAttribute(k: string) {
    return this.attributes.get(k) ?? null;
  }

  appendChild<T extends FakeElement>(child: T): T {
    this.children.push(child);
    return child;
  }

  querySelector<T extends HTMLElement = HTMLElement>(
    selector: string,
  ): T | null {
    const parts = selector.split(',').map((s) => s.trim());
    for (const part of parts) {
      const found = this.matchSingle(part);
      if (found) return found as unknown as T;
    }
    return null;
  }

  private matchSingle(sel: string): FakeElement | null {
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      if (this.className.split(/\s+/).includes(cls)) return this;
    }
    if (sel.startsWith('[data-testid="')) {
      const id = sel.match(/data-testid="([^"]+)"/)?.[1];
      if (this.getAttribute('data-testid') === id) return this;
    }
    for (const child of this.children) {
      const found = child.matchSingle(sel);
      if (found) return found;
    }
    return null;
  }
}

// Setup minimal document mock for testing
if (typeof document === 'undefined') {
  (globalThis as unknown as { document: unknown }).document = {
    createElement: (tag: string) => new FakeElement(tag),
  };
}

function createMockSnapshot(
  overrides: Partial<FactionView> = {},
): PlayerSnapshot {
  const state = createMatch(42);
  const view = getFactionView(
    {
      ...state,
      phase: 'running',
      elapsedTicks: overrides.tick ?? 6000,
    },
    'A',
  );

  return {
    view: {
      ...view,
      ...overrides,
    },
    message: '',
    selectedUnitId: null,
    selectedUnitIds: [],
    droppedTimeMs: 0,
    contextLost: false,
  };
}

function createMockHudElements(): { elements: HudElements; root: FakeElement } {
  const root = new FakeElement('div');

  // Legend items for A, B, C
  for (const id of ['a', 'b', 'c']) {
    const legend = new FakeElement('div');
    legend.className = `legend-${id}`;
    root.appendChild(legend);
  }

  const elements: HudElements = {
    root: root as unknown as HTMLElement,
    board: new FakeElement('div') as unknown as HTMLElement,
    seed: new FakeElement('input') as unknown as HTMLInputElement,
    scenario: new FakeElement('select') as unknown as HTMLSelectElement,
    start: new FakeElement('button') as unknown as HTMLButtonElement,
    pause: new FakeElement('button') as unknown as HTMLButtonElement,
    resume: new FakeElement('button') as unknown as HTMLButtonElement,
    reset: new FakeElement('button') as unknown as HTMLButtonElement,
    applySeed: new FakeElement('button') as unknown as HTMLButtonElement,
    stop: new FakeElement('button') as unknown as HTMLButtonElement,
    clear: new FakeElement('button') as unknown as HTMLButtonElement,
    camera: new FakeElement('button') as unknown as HTMLButtonElement,
    units: new FakeElement('div') as unknown as HTMLElement,
    status: new FakeElement('div') as unknown as HTMLElement,
    download: new FakeElement('button') as unknown as HTMLButtonElement,
    outdatedDialog: new FakeElement('dialog') as unknown as HTMLDialogElement,
    panel: null,
    selectedBaseId: '',
    multiSelect: false,
    researchDomain: 'power',
  };

  return { elements, root };
}

describe('tickets HUD sudden loss and periodic decay exclusion', () => {
  beforeEach(() => {
    resetTicketsHud();
  });

  describe('detectSuddenLossTickets', () => {
    it.each([5, 20])(
      'excludes periodic decay and preserves unit losses with a %i-tick interval',
      (intervalTicks) => {
        const periodicLoss = (150 * intervalTicks) / 10;
        expect(
          detectSuddenLossTickets(
            25_000 - periodicLoss,
            25_000,
            5999,
            6000,
            150,
            intervalTicks,
          ),
        ).toBeNull();
        expect(
          detectSuddenLossTickets(
            25_000 - periodicLoss - 800,
            25_000,
            5999,
            6000,
            150,
            intervalTicks,
          ),
        ).toBe(8);
      },
    );

    it('returns null for periodic decay only (e.g. 150 centi at 10-tick interval)', () => {
      // 10 minutes in: rate is 150 centi/sec (1.5/s).
      // Over 10 ticks, exactly 150 centi dropped due to periodic decay.
      const sudden = detectSuddenLossTickets(
        24_850, // current
        25_000, // previous (-150)
        599, // prevTick
        600, // currentTick (crosses 1 interval: 60 - 59 = 1)
        150, // rateCentiPerSec
        10, // updateIntervalTicks
      );
      expect(sudden).toBeNull();
    });

    it('detects unit loss (e.g. 200 centi for assault) on a non-periodic tick', () => {
      const sudden = detectSuddenLossTickets(
        24_800, // current
        25_000, // previous (-200)
        604, // prevTick
        605, // currentTick (no periodic interval: 60 - 60 = 0)
        150, // rateCentiPerSec
        10,
      );
      expect(sudden).toBe(2);
    });

    it('detects unit loss occurring simultaneously with periodic decay', () => {
      // 150 periodic + 200 assault unit loss = 350 centi drop
      const sudden = detectSuddenLossTickets(
        24_650, // current
        25_000, // previous (-350)
        599, // prevTick
        600, // currentTick (1 interval: expected periodic = 150)
        150, // rateCentiPerSec
        10,
      );
      // Sudden part is 350 - 150 = 200 centi -> 2 tickets
      expect(sudden).toBe(2);
    });

    it('returns null when no drop or ticket increase', () => {
      expect(
        detectSuddenLossTickets(25_000, 25_000, 100, 101, 150, 10),
      ).toBeNull();
      expect(
        detectSuddenLossTickets(25_100, 25_000, 100, 101, 150, 10),
      ).toBeNull();
    });

    it('returns null when tick does not advance or rewinds', () => {
      expect(
        detectSuddenLossTickets(24_800, 25_000, 100, 100, 150, 10),
      ).toBeNull();
      expect(
        detectSuddenLossTickets(24_800, 25_000, 100, 99, 150, 10),
      ).toBeNull();
    });
  });

  describe('getActiveSuddenLoss & resetTicketsHud', () => {
    it('expires after 20 ticks and clears immediately on reset', () => {
      // Setup state through updateTicketsHud
      const { elements, root } = createMockHudElements();

      // Tick 5000: initial snapshot
      updateTicketsHud(
        elements,
        createMockSnapshot({
          tick: 5000,
          ticketsCenti: { A: 25_000, B: 25_000, C: 25_000 },
          ticketRatesCentiPerSec: { A: 150, B: 150, C: 150 },
        }),
      );

      // Tick 5005: unit loss (-200 centi)
      updateTicketsHud(
        elements,
        createMockSnapshot({
          tick: 5005,
          ticketsCenti: { A: 24_800, B: 25_000, C: 25_000 },
          ticketRatesCentiPerSec: { A: 150, B: 150, C: 150 },
        }),
      );

      // Should be active at tick 5005 (expires at 5005 + 20 = 5025)
      expect(getActiveSuddenLoss('A', 5005, 'running')).toBe(2);
      const dropSpanA = root.querySelector(
        '[data-testid="ticket-drop-A"]',
      ) as unknown as FakeElement;
      expect(dropSpanA.hidden).toBe(false);
      expect(dropSpanA.textContent).toBe('-2');

      // Tick 5024: still active
      expect(getActiveSuddenLoss('A', 5024, 'running')).toBe(2);

      // Tick 5025: expired
      expect(getActiveSuddenLoss('A', 5025, 'running')).toBeNull();

      // If reset occurs during active display, history is cleared
      resetTicketsHud();
      expect(getActiveSuddenLoss('A', 5005, 'running')).toBeNull();
    });

    it('clears sudden loss when match is reset to tick 0 and does not leak into new match', () => {
      const { elements, root } = createMockHudElements();

      // Game 1: reaches tick 5000 and suffers unit loss
      updateTicketsHud(
        elements,
        createMockSnapshot({
          tick: 5000,
          ticketsCenti: { A: 20_000, B: 20_000, C: 20_000 },
        }),
      );
      updateTicketsHud(
        elements,
        createMockSnapshot({
          tick: 5005,
          ticketsCenti: { A: 19_800, B: 20_000, C: 20_000 },
        }),
      );

      const dropSpanA = root.querySelector(
        '[data-testid="ticket-drop-A"]',
      ) as unknown as FakeElement;
      expect(dropSpanA.hidden).toBe(false);
      expect(dropSpanA.textContent).toBe('-2');

      // User resets match: new match starts at tick 0 (ready phase)
      updateTicketsHud(
        elements,
        createMockSnapshot({
          tick: 0,
          phase: 'ready',
          ticketsCenti: { A: 30_000, B: 30_000, C: 30_000 },
        }),
      );

      // The drop display must NOT remain
      expect(dropSpanA.hidden).toBe(true);
      expect(dropSpanA.textContent).toBe('');
      expect(getActiveSuddenLoss('A', 0, 'ready')).toBeNull();

      // New game starts running: still no leftover display
      updateTicketsHud(
        elements,
        createMockSnapshot({
          tick: 1,
          phase: 'running',
          ticketsCenti: { A: 30_000, B: 30_000, C: 30_000 },
        }),
      );
      expect(dropSpanA.hidden).toBe(true);
      expect(dropSpanA.textContent).toBe('');
      expect(getActiveSuddenLoss('A', 1, 'running')).toBeNull();
    });
  });

  describe('updateTicketsHud UI indicators', () => {
    it('shows rate (-1.5/s), leader (★), and estimated time without showing false sudden drops during periodic decay', () => {
      const { elements, root } = createMockHudElements();

      // Tick 5990: baseline
      updateTicketsHud(
        elements,
        createMockSnapshot({
          tick: 5990,
          ticketsCenti: { A: 25_000, B: 24_000, C: 23_000 },
          ticketRatesCentiPerSec: { A: 150, B: 150, C: 150 },
        }),
      );

      // Tick 6000: 10 ticks passed, periodic decay applied (150 centi = 1.5/s)
      updateTicketsHud(
        elements,
        createMockSnapshot({
          tick: 6000,
          ticketsCenti: { A: 24_850, B: 23_850, C: 22_850 },
          ticketRatesCentiPerSec: { A: 150, B: 150, C: 150 },
        }),
      );

      const dropSpanA = root.querySelector(
        '[data-testid="ticket-drop-A"]',
      ) as unknown as FakeElement;
      const rateSpanA = root.querySelector(
        '[data-testid="ticket-rate-A"]',
      ) as unknown as FakeElement;
      const leaderSpanA = root.querySelector(
        '[data-testid="ticket-leader-A"]',
      ) as unknown as FakeElement;
      const estimateSpanA = root.querySelector(
        '[data-testid="ticket-estimate-A"]',
      ) as unknown as FakeElement;

      // Rate display
      expect(rateSpanA.hidden).toBe(false);
      expect(rateSpanA.textContent).toBe('(-1.5/s)');

      // Leader display (A has highest tickets)
      expect(leaderSpanA.hidden).toBe(false);
      expect(leaderSpanA.textContent).toBe('★');

      // Estimated time for A (24850 / 150 = ~165 seconds = 2m45s)
      expect(estimateSpanA.hidden).toBe(false);
      expect(estimateSpanA.textContent).toContain('残り約2分45秒');

      // Crucial: Drop display must be hidden! (Periodic decay excluded)
      expect(dropSpanA.hidden).toBe(true);
      expect(dropSpanA.textContent).toBe('');
    });
  });
});

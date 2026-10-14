import type { PlayerSnapshot } from '../runtime/controller';
import type { FactionId, OwnedBaseView } from '../simulation/types';
import type { HudElements } from './hud';

let lastHqHp: number | null = null;
let lastAttackedTick: number | null = null;

// Track previous ticket values and sudden loss expiry per faction
const lastTicketsCenti: Record<FactionId, number | null> = {
  A: null,
  B: null,
  C: null,
};
const suddenLossInfo: Record<
  FactionId,
  { amount: number; expireTick: number } | null
> = {
  A: null,
  B: null,
  C: null,
};

function ensureTicketElements(root: HTMLElement): {
  protection: HTMLElement;
  hqWarning: HTMLElement;
} {
  let protection = root.querySelector<HTMLElement>(
    '[data-testid="hq-protection-banner"]',
  );
  if (!protection) {
    protection = document.createElement('span');
    protection.setAttribute('data-testid', 'hq-protection-banner');
    protection.className = 'hq-protection-banner';
    protection.hidden = true;
    const target =
      root.querySelector('.ticket-strip, .faction-legend, .topbar') ?? root;
    target.appendChild(protection);
  }

  let hqWarning = root.querySelector<HTMLElement>(
    '[data-testid="hq-warning-banner"]',
  );
  if (!hqWarning) {
    hqWarning = document.createElement('span');
    hqWarning.setAttribute('data-testid', 'hq-warning-banner');
    hqWarning.className = 'hq-warning-banner';
    hqWarning.hidden = true;
    const target =
      root.querySelector('.ticket-strip, .faction-legend, .topbar') ?? root;
    target.appendChild(hqWarning);
  }

  return { protection, hqWarning };
}

function ensureFactionSpans(
  root: HTMLElement,
  id: FactionId,
): {
  leader: HTMLElement;
  rate: HTMLElement;
  drop: HTMLElement;
  estimate: HTMLElement | null;
} {
  const legend = root.querySelector<HTMLElement>(`.legend-${id.toLowerCase()}`);
  if (!legend) {
    return {
      leader: document.createElement('span'),
      rate: document.createElement('span'),
      drop: document.createElement('span'),
      estimate: id === 'A' ? document.createElement('span') : null,
    };
  }

  let leader = legend.querySelector<HTMLElement>(
    `[data-testid="ticket-leader-${id}"]`,
  );
  if (!leader) {
    leader = document.createElement('span');
    leader.setAttribute('data-testid', `ticket-leader-${id}`);
    leader.style.cssText = 'color: #f59e0b; margin-left: 2px; font-size: 10px;';
    legend.appendChild(leader);
  }

  let rate = legend.querySelector<HTMLElement>(
    `[data-testid="ticket-rate-${id}"]`,
  );
  if (!rate) {
    rate = document.createElement('span');
    rate.setAttribute('data-testid', `ticket-rate-${id}`);
    rate.style.cssText = 'color: #71717a; margin-left: 3px; font-size: 9px;';
    legend.appendChild(rate);
  }

  let drop = legend.querySelector<HTMLElement>(
    `[data-testid="ticket-drop-${id}"]`,
  );
  if (!drop) {
    drop = document.createElement('span');
    drop.setAttribute('data-testid', `ticket-drop-${id}`);
    drop.style.cssText =
      'color: #ef4444; font-weight: bold; margin-left: 3px; font-size: 10px;';
    drop.hidden = true;
    legend.appendChild(drop);
  }

  let estimate: HTMLElement | null = null;
  if (id === 'A') {
    estimate = legend.querySelector<HTMLElement>(
      '[data-testid="ticket-estimate-A"]',
    );
    if (!estimate) {
      estimate = document.createElement('span');
      estimate.setAttribute('data-testid', 'ticket-estimate-A');
      estimate.style.cssText =
        'color: #0284c7; margin-left: 4px; font-size: 9px;';
      estimate.hidden = true;
      legend.appendChild(estimate);
    }
  }

  return { leader, rate, drop, estimate };
}

/**
 * Updates tickets HUD elements:
 * - HQ protection countdown & HQ attack warnings
 * - Per-faction ticket decay rate (/s)
 * - Sudden loss indicator (-X for 2s)
 * - Leader indicator
 * - Faction A estimated remaining time
 */
export function updateTicketsHud(
  elements: HudElements,
  snapshot: PlayerSnapshot,
): void {
  const { root } = elements;
  const { view } = snapshot;
  const { protection, hqWarning } = ensureTicketElements(root);

  // 1. HQ Protection Countdown
  const protectionTicks = view.rules.match.hqProtectionTicks ?? 1200;
  const remainingTicks = protectionTicks - view.tick;
  if (view.phase === 'running' && remainingTicks > 0) {
    const remainingSeconds = Math.ceil(remainingTicks / 10);
    protection.hidden = false;
    protection.textContent = `首都保護: 残り${remainingSeconds}秒`;
  } else {
    protection.hidden = true;
  }

  // 2. HQ Under Attack Warning for Faction A
  const ownHq = view.bases.find(
    (b): b is OwnedBaseView => b.kind === 'hq' && b.visibility === 'owned',
  );
  if (ownHq !== undefined) {
    if (lastHqHp !== null && ownHq.hp < lastHqHp) {
      lastAttackedTick = view.tick;
    }
    lastHqHp = ownHq.hp;
  } else {
    lastHqHp = null;
    lastAttackedTick = null;
  }

  const isAttacked =
    ownHq !== undefined &&
    ownHq.hp < ownHq.maxHp &&
    lastAttackedTick !== null &&
    view.tick - lastAttackedTick <= 30;

  if (view.phase === 'running' && isAttacked) {
    hqWarning.hidden = false;
    hqWarning.textContent = '⚠️ 首都が攻撃を受けています！';
  } else {
    hqWarning.hidden = true;
  }

  // 3. Leader Faction (Highest tickets among surviving factions)
  const surviving = (['A', 'B', 'C'] as const).filter(
    (id) => view.publicEliminations[id]?.eliminatedAtTick === null,
  );
  const maxTickets = Math.max(
    ...surviving.map((id) => view.ticketsCenti[id] ?? 0),
  );

  for (const id of ['A', 'B', 'C'] as const) {
    const spans = ensureFactionSpans(root, id);
    const isEliminated = view.publicEliminations[id]?.eliminatedAtTick !== null;
    const currentTickets = view.ticketsCenti[id] ?? 0;
    const previousTickets = lastTicketsCenti[id];
    lastTicketsCenti[id] = currentTickets;

    // Leader indicator
    if (
      !isEliminated &&
      surviving.length > 1 &&
      currentTickets === maxTickets &&
      maxTickets > 0
    ) {
      spans.leader.textContent = '★';
      spans.leader.hidden = false;
    } else {
      spans.leader.textContent = '';
      spans.leader.hidden = true;
    }

    // Rate display
    const rateCenti = view.ticketRatesCentiPerSec?.[id] ?? 0;
    if (!isEliminated && rateCenti > 0 && view.phase === 'running') {
      spans.rate.textContent = `(-${(rateCenti / 100).toFixed(1)}/s)`;
      spans.rate.hidden = false;
    } else {
      spans.rate.textContent = '';
      spans.rate.hidden = true;
    }

    // Sudden loss display (e.g. unit killed: drop >= 100 centi in 1 tick)
    if (previousTickets !== null && view.phase === 'running') {
      const dropAmount = previousTickets - currentTickets;
      if (dropAmount >= 100) {
        const suddenDropTickets = Math.round(dropAmount / 100);
        suddenLossInfo[id] = {
          amount: suddenDropTickets,
          expireTick: view.tick + 20, // 2 seconds
        };
      }
    }

    const currentDrop = suddenLossInfo[id];
    if (
      currentDrop &&
      view.tick < currentDrop.expireTick &&
      view.phase === 'running'
    ) {
      spans.drop.textContent = `-${currentDrop.amount}`;
      spans.drop.hidden = false;
    } else {
      spans.drop.textContent = '';
      spans.drop.hidden = true;
    }

    // Estimated remaining time for Faction A
    if (id === 'A' && spans.estimate) {
      if (!isEliminated && rateCenti > 0 && view.phase === 'running') {
        const secondsLeft = Math.floor(currentTickets / rateCenti);
        const m = Math.floor(secondsLeft / 60);
        const s = secondsLeft % 60;
        spans.estimate.textContent = `残り約${m}分${s.toString().padStart(2, '0')}秒`;
        spans.estimate.hidden = false;
      } else {
        spans.estimate.textContent = '';
        spans.estimate.hidden = true;
      }
    }
  }
}

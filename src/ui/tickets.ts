import type { PlayerSnapshot } from '../runtime/controller';
import type { OwnedBaseView } from '../simulation/types';
import type { HudElements } from './hud';

let lastHqHp: number | null = null;
let lastAttackedTick: number | null = null;

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

/**
 * Updates tickets HUD elements including HQ protection countdown and HQ attack warnings.
 * Designed to be invoked with a single call from updateHud.
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
    view.tick - lastAttackedTick <= 30; // within last 3 seconds

  if (view.phase === 'running' && isAttacked) {
    hqWarning.hidden = false;
    hqWarning.textContent = '⚠️ 首都が攻撃を受けています！';
  } else {
    hqWarning.hidden = true;
  }
}

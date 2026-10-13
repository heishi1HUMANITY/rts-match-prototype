import type { PlayerSnapshot } from '../runtime/controller';
import type { OwnedBaseView } from '../simulation/types';
import type { HudElements } from './hud';

let protectionBanner: HTMLElement | null = null;
let hqWarningBanner: HTMLElement | null = null;
let lastHqHp: number | null = null;
let lastAttackedTick: number | null = null;

function ensureTicketElements(root: HTMLElement): {
  protection: HTMLElement;
  hqWarning: HTMLElement;
} {
  if (!protectionBanner || !root.contains(protectionBanner)) {
    protectionBanner = root.querySelector<HTMLElement>(
      '[data-testid="hq-protection-banner"]',
    );
    if (!protectionBanner) {
      protectionBanner = document.createElement('div');
      protectionBanner.setAttribute('data-testid', 'hq-protection-banner');
      protectionBanner.className = 'hq-protection-banner';
      protectionBanner.style.cssText =
        'font-size: 13px; font-weight: bold; color: #38bdf8; padding: 2px 8px; border-radius: 4px; background: rgba(14, 116, 144, 0.2); border: 1px solid rgba(56, 189, 248, 0.4); display: inline-block; margin-right: 8px;';
      const statusArea =
        root.querySelector('.status-bar, .top-bar, .phase-status') ?? root;
      statusArea.prepend(protectionBanner);
    }
  }

  if (!hqWarningBanner || !root.contains(hqWarningBanner)) {
    hqWarningBanner = root.querySelector<HTMLElement>(
      '[data-testid="hq-warning-banner"]',
    );
    if (!hqWarningBanner) {
      hqWarningBanner = document.createElement('div');
      hqWarningBanner.setAttribute('data-testid', 'hq-warning-banner');
      hqWarningBanner.className = 'hq-warning-banner';
      hqWarningBanner.style.cssText =
        'font-size: 13px; font-weight: bold; color: #f87171; padding: 2px 8px; border-radius: 4px; background: rgba(185, 28, 28, 0.25); border: 1px solid rgba(248, 113, 113, 0.6); display: inline-block; margin-right: 8px; animation: pulse 1s infinite;';
      const statusArea =
        root.querySelector('.status-bar, .top-bar, .phase-status') ?? root;
      statusArea.prepend(hqWarningBanner);
    }
  }

  return { protection: protectionBanner, hqWarning: hqWarningBanner };
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

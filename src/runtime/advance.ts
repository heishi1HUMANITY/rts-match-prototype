import { applyCommand } from '../simulation/commands';
import { resolveMatchOutcome } from '../simulation/outcome';
import { getFactionView } from '../simulation/view';
import { stepMatch } from '../simulation/step';
import { updateFactionKnowledge } from '../simulation/visibility';
import { decideBotCommands } from '../ai/strategy';
import { advanceLocalFactionOrders } from '../ai/local-faction';
import type { FactionId, MatchState } from '../simulation/types';

const BOT_FACTIONS: readonly FactionId[] = ['B', 'C'];

function enablesBots(state: MatchState): boolean {
  if (
    state.scenarioId === 'f02-pursuit' ||
    state.scenarioId === 'f04-crossing' ||
    state.scenarioId === 'f05-neutral-defense' ||
    state.scenarioId === 'f06-local-faction' ||
    state.scenarioId === 'f08-unit-domains' ||
    state.scenarioId === 'f10-base-upgrades'
  )
    return false;
  return state.scenarioId === 'standard' || state.scenarioId.startsWith('g3-');
}

/**
 * Applies deterministic bot orders at one-second boundaries, then advances one
 * fixed simulation tick. Bot decisions are reconstructed from the state, so
 * this function adds no replay history or persistent AI state.
 */
export function advanceMatch(state: MatchState): MatchState {
  if (state.phase !== 'running') return state;

  const resolved = resolveMatchOutcome(state);
  if (resolved.phase !== 'running') {
    return resolved === state
      ? resolved
      : { ...resolved, knowledge: updateFactionKnowledge(resolved) };
  }
  let prepared =
    resolved === state
      ? state
      : { ...resolved, knowledge: updateFactionKnowledge(resolved) };
  if (prepared.elapsedTicks % prepared.rules.npc.decisionIntervalTicks === 0) {
    // Both views must describe the same pre-command world. In particular, B's
    // command must not affect information available to C at this boundary.
    const decisions = (enablesBots(prepared) ? BOT_FACTIONS : []).map(
      (factionId) => {
        const faction = prepared.factions.find(
          (entry) => entry.id === factionId,
        );
        if (
          !faction ||
          faction.controller !== 'bot' ||
          faction.eliminatedAtTick !== null ||
          faction.ticketsCenti <= 0
        ) {
          return { factionId, commands: [] as const };
        }
        return {
          factionId,
          commands: decideBotCommands(getFactionView(prepared, factionId)),
        };
      },
    );

    for (const { factionId, commands } of decisions) {
      for (const command of commands) {
        const result = applyCommand(prepared, factionId, command);
        if (result.ok) prepared = result.state;
      }
    }
    prepared = advanceLocalFactionOrders(prepared);
  }
  return stepMatch(prepared);
}

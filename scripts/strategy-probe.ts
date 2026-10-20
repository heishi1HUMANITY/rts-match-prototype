import { planBotDecision } from '../src/ai/strategy';
import { advanceMatch } from '../src/runtime/advance';
import { applyCommand } from '../src/simulation/commands';
import { createMatch } from '../src/simulation/match';
import { getFactionView } from '../src/simulation/view';
import type {
  Command,
  FactionView,
  MatchState,
  NpcPolicyMemory,
} from '../src/simulation/types';
import { rulesFromArgs } from './rules-override';

/**
 * Plays faction A with a fixed strategy against the standard NPCs and reports
 * how it fares, so a dominant plan shows up without an LLM playtest.
 *
 *   npx tsx scripts/strategy-probe.ts --strategy=heli-raid [--seeds=0,1,2]
 *     [--rules=patch.json]
 *
 * Strategies: npc (A plays the standard NPC policy, the baseline) and
 * heli-raid (the NPC policy plus a beeline to helicopters that raid enemy
 * bases in groups). Every order goes through the shared command validation.
 */
const args = process.argv.slice(2);
const option = (name: string): string | undefined =>
  args
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const strategy = option('strategy') ?? 'npc';
if (strategy !== 'npc' && strategy !== 'heli-raid')
  throw new Error('--strategy must be npc or heli-raid');
const SEEDS = (option('seeds') ?? '0,1,2,3,4,5').split(',').map(Number);
const RULES = rulesFromArgs(args);
const TICK_LIMIT = 30_000;
const RAID_GROUP = Number(option('group') ?? 5);

interface RaidStats {
  helicoptersBuilt: number;
  helicoptersLost: number;
  basesNeutralizedNearHelicopters: number;
}

function heliRaidCommands(
  view: FactionView,
  npcCommands: readonly Command[],
): Command[] {
  const own = view.ownFaction;
  const unlocked = own.completedResearchIds.includes('aircraft-1');
  const helicopters = view.ownUnits.filter(
    (unit) => unit.kind === 'helicopter',
  );
  const commands: Command[] = [];
  for (const command of npcCommands) {
    // Helicopters take only the raid orders below.
    if (
      'unitId' in command &&
      helicopters.some(({ id }) => id === command.unitId)
    )
      continue;
    if (command.type === 'start-research' && !unlocked) continue;
    if (command.type === 'enqueue-production' && unlocked) {
      commands.push({ ...command, unitKind: 'helicopter' });
      continue;
    }
    commands.push(command);
  }
  if (!unlocked) {
    const next = own.completedResearchIds.includes('survey-1')
      ? 'aircraft-1'
      : 'survey-1';
    if (own.activeResearch?.researchId !== next)
      commands.unshift({ type: 'start-research', researchId: next });
  }
  const ready = helicopters.filter(
    (unit) =>
      !unit.resupplyReturn &&
      !unit.marchOrder &&
      unit.path.length === 0 &&
      unit.hp >= unit.maxHp * 0.6 &&
      (unit.ammo ?? 0) >= view.rules.units.helicopter.ammo,
  );
  if (ready.length >= RAID_GROUP) {
    const center = {
      x: ready.reduce((sum, unit) => sum + unit.cell.x, 0) / ready.length,
      y: ready.reduce((sum, unit) => sum + unit.cell.y, 0) / ready.length,
    };
    const target = view.bases
      .filter(
        (base) =>
          (base.visibility === 'visible' || base.visibility === 'remembered') &&
          base.owner !== null &&
          base.owner !== 'A' &&
          base.owner !== 'local' &&
          base.kind !== 'hq',
      )
      .sort(
        (a, b) =>
          Math.hypot(a.cell.x - center.x, a.cell.y - center.y) -
            Math.hypot(b.cell.x - center.x, b.cell.y - center.y) ||
          a.id.localeCompare(b.id),
      )[0];
    if (target)
      for (const unit of ready)
        commands.push({
          type: 'march',
          unitId: unit.id,
          target: { kind: 'base', id: target.id },
        });
  }
  return commands;
}

function run(seed: number): object {
  let state: MatchState = createMatch(seed, {
    mapId: 'ring-three-fronts-100',
    ...(RULES ? { rules: RULES } : {}),
  });
  state = applyCommand(state, 'A', { type: 'start' }).state;
  let memory: NpcPolicyMemory | undefined;
  const stats: RaidStats = {
    helicoptersBuilt: 0,
    helicoptersLost: 0,
    basesNeutralizedNearHelicopters: 0,
  };
  const seenHelicopters = new Set<string>();
  while (state.phase === 'running' && state.elapsedTicks < TICK_LIMIT) {
    if (state.elapsedTicks % state.rules.npc.decisionIntervalTicks === 0) {
      const view = getFactionView(state, 'A');
      const decision = planBotDecision(view, memory);
      memory = decision.memory;
      const commands =
        strategy === 'heli-raid'
          ? heliRaidCommands(view, decision.commands)
          : decision.commands;
      for (const command of commands) {
        const result = applyCommand(state, 'A', command);
        if (result.ok) state = result.state;
      }
    }
    const before = state;
    state = advanceMatch(state);
    for (const unit of state.units)
      if (
        unit.factionId === 'A' &&
        unit.kind === 'helicopter' &&
        !seenHelicopters.has(unit.id)
      ) {
        seenHelicopters.add(unit.id);
        stats.helicoptersBuilt += 1;
      }
    for (const unit of before.units)
      if (
        unit.factionId === 'A' &&
        unit.kind === 'helicopter' &&
        !state.units.some(({ id }) => id === unit.id)
      )
        stats.helicoptersLost += 1;
    for (const base of state.bases) {
      const previous = before.bases.find(({ id }) => id === base.id)!;
      if (
        previous.owner !== null &&
        previous.owner !== 'A' &&
        base.owner === null &&
        state.units.some(
          (unit) =>
            unit.factionId === 'A' &&
            unit.kind === 'helicopter' &&
            Math.hypot(unit.cell.x - base.cell.x, unit.cell.y - base.cell.y) <=
              5,
        )
      )
        stats.basesNeutralizedNearHelicopters += 1;
    }
  }
  const rank =
    state.result?.standings.find(({ factionId }) => factionId === 'A')?.rank ??
    null;
  return {
    seed,
    minutes: Number(
      (
        (state.elapsedTicks * state.rules.match.tickDurationMs) /
        60_000
      ).toFixed(1),
    ),
    rankOfA: rank,
    ticketsOfA: Math.floor(
      (state.factions.find(({ id }) => id === 'A')?.ticketsCenti ?? 0) / 100,
    ),
    ...(strategy === 'heli-raid' ? stats : {}),
  };
}

const results = SEEDS.map((seed) => {
  const result = run(seed) as { rankOfA: number | null };
  console.log(JSON.stringify(result));
  return result;
});
const wins = results.filter(({ rankOfA }) => rankOfA === 1).length;
console.log(
  `${strategy}: A won ${wins}/${results.length} (${Math.round((wins / results.length) * 100)}%)`,
);

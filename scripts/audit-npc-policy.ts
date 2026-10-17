import { decideBotCommands, selectNpcResearchRoute } from '../src/ai/strategy';
import { advanceMatch } from '../src/runtime/advance';
import { applyCommand } from '../src/simulation/commands';
import { createMatch } from '../src/simulation/match';
import { getFactionView } from '../src/simulation/view';

const SEED = 23;
const TICKS = 1_200;
const difficulties = ['weak', 'standard', 'strong'] as const;

for (const difficulty of difficulties) {
  let state = createMatch(SEED, { mapId: 'ring-three-fronts-100' });
  state = {
    ...state,
    phase: 'running',
    rules: {
      ...state.rules,
      npc: { ...state.rules.npc, selectedDifficulty: difficulty },
    },
  };
  const counts: Record<string, number> = {};
  const validation: Record<string, number> = { accepted: 0, rejected: 0 };
  const marches: Record<string, number> = {};
  const routes: Record<string, string> = {};
  while (state.elapsedTicks < TICKS && state.phase === 'running') {
    const profile = state.rules.npc.difficultyProfiles[difficulty];
    const interval =
      difficulty === 'standard'
        ? state.rules.npc.decisionIntervalTicks
        : profile.decisionIntervalTicks;
    if (state.elapsedTicks % interval === 0) {
      let probe = state;
      const botFactions = state.factions.filter(
        (entry) => entry.controller === 'bot',
      );
      const decisions = botFactions.map((faction) => {
        const view = getFactionView(state, faction.id);
        routes[faction.id] ??= selectNpcResearchRoute(view);
        return { factionId: faction.id, commands: decideBotCommands(view) };
      });
      for (const { factionId, commands } of decisions) {
        for (const command of commands) {
          counts[command.type] = (counts[command.type] ?? 0) + 1;
          const result = applyCommand(probe, factionId, command);
          if (result.ok) {
            validation.accepted += 1;
            probe = result.state;
          } else {
            validation.rejected += 1;
            validation[result.reason] = (validation[result.reason] ?? 0) + 1;
          }
          if (command.type === 'march') {
            const key = `${factionId}:${command.target.kind}:${command.target.id}`;
            marches[key] = (marches[key] ?? 0) + 1;
          }
          if (
            command.type === 'activate-ability' &&
            command.abilityId === 'survey'
          )
            counts.survey = (counts.survey ?? 0) + 1;
        }
      }
    }
    state = advanceMatch(state);
  }
  console.log(
    JSON.stringify({
      seed: SEED,
      difficulty,
      ticks: state.elapsedTicks,
      resultReason: state.result?.reason ?? null,
      routes,
      counts,
      validation,
      marches,
    }),
  );
}

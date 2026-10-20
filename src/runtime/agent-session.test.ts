import { describe, expect, it } from 'vitest';
import {
  agentReplayInput,
  createAgentSession,
  issueAgentCommand,
  renderAgentMap,
  stepAgentSession,
  summarizeAgentView,
} from './agent-session';
import { replay } from './diagnostics';
import { getFactionView } from '../simulation/view';

describe('agent play session', () => {
  it('starts a running 100-cell match and only moves time on an explicit step', () => {
    const session = createAgentSession({ seed: 7 });
    expect(session.state.phase).toBe('running');
    expect(session.state.elapsedTicks).toBe(0);
    expect(session.history).toHaveLength(1);
    const stepped = stepAgentSession(session, 25).session;
    expect(stepped.state.elapsedTicks).toBe(25);
    expect(session.state.elapsedTicks).toBe(0);
  });

  it('applies A orders through the shared validation and reports rejections', () => {
    const session = createAgentSession({ seed: 7, mapId: 'legacy-40' });
    const accepted = issueAgentCommand(session, {
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'assault',
    });
    expect(accepted.ok).toBe(true);
    const foreign = issueAgentCommand(accepted.session, {
      type: 'stop',
      unitId: 'B-01',
    });
    expect(foreign).toMatchObject({ ok: false });
    expect(foreign.session.history.at(-1)).toMatchObject({ ok: false });
  });

  it('limits accepted orders per window without recording the harness rejection', () => {
    let session = createAgentSession({
      seed: 7,
      commandBudget: { windowTicks: 150, maxCommands: 1 },
    });
    const first = issueAgentCommand(session, {
      type: 'start-research',
      researchId: 'air-defense-1',
    });
    expect(first.ok).toBe(true);
    session = first.session;
    const second = issueAgentCommand(session, {
      type: 'start-research',
      researchId: 'firepower-1',
    });
    expect(second).toMatchObject({ ok: false, reason: 'COMMAND_BUDGET' });
    expect(second.session.history).toHaveLength(session.history.length);
    session = stepAgentSession(session, 150).session;
    expect(
      issueAgentCommand(session, {
        type: 'start-research',
        researchId: 'firepower-1',
      }).ok,
    ).toBe(true);
  });

  it('reports what A could notice and replays to the identical state', () => {
    let session = createAgentSession({ seed: 7, mapId: 'legacy-40' });
    const order = issueAgentCommand(session, {
      type: 'enqueue-production',
      baseId: 'HQ-A',
      unitKind: 'scout',
    });
    session = order.session;
    const result = stepAgentSession(
      session,
      session.state.rules.units.scout.buildTicks + 5,
    );
    expect(result.events.some((event) => event.includes('配備された'))).toBe(
      true,
    );
    const input = agentReplayInput(result.session);
    expect(JSON.stringify(replay(input).state)).toBe(
      JSON.stringify(result.session.state),
    );
  });

  it('summarizes only A-visible information and draws the public map', () => {
    const session = createAgentSession({ seed: 7 });
    const view = getFactionView(session.state, 'A');
    const summary = summarizeAgentView(view) as {
      units: { id: string }[];
      visibleEnemies: unknown[];
      availableResearch: { id: string }[];
    };
    expect(summary.units.every(({ id }) => id.startsWith('A-'))).toBe(true);
    expect(summary.visibleEnemies).toEqual([]);
    expect(summary.availableResearch.map(({ id }) => id)).toContain(
      'air-defense-1',
    );
    expect(summary.availableResearch.map(({ id }) => id)).not.toContain(
      'aircraft-1',
    );
    const map = renderAgentMap(view, 2).split('\n');
    expect(map).toHaveLength(2 + 50);
    const grid = map.slice(2).join('\n');
    expect(grid).toContain('*');
    expect(grid).not.toContain('!');
  });
});

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  agentReplayInput,
  commandsInWindow,
  createAgentSession,
  groupAgentCommands,
  issueAgentAction,
  renderAgentMap,
  stepAgentSession,
  summarizeAgentRules,
  summarizeAgentView,
  type AgentSession,
} from '../src/runtime/agent-session';
import { rejectMessage } from '../src/runtime/controller';
import { replay } from '../src/runtime/diagnostics';
import { getFactionView } from '../src/simulation/view';
import { rulesFromArgs } from './rules-override';
import type { Command } from '../src/simulation/types';

const USAGE = `Agent play driver: play faction A one explicit step at a time.

  npm run agent -- new [--seed=42] [--map=100|40] [--budget=30:3] [--rules=patch.json]
  npm run agent -- view
  npm run agent -- map [--scale=2]
  npm run agent -- rules
  npm run agent -- cmd '<command JSON or JSON array>'
  npm run agent -- step <ticks | 30s>
  npm run agent -- replay [--out=path]
  npm run agent -- help

Every call reads and writes --session=path (default .agent-play/session.json).
--budget=S:N allows N accepted actions per S game seconds. The same unit
order to the same target for several units in one cmd call is one action
(a group order, like dragging a selection in the browser).
--rules=patch.json applies a partial master (only changed fields) to the new match.
Output is JSON. Observations are A's own view only.

Command JSON (same validation as the browser; actor is always A):
  {"type":"move","unitId":"A-01","target":{"x":10,"y":20}}
  {"type":"move","unitId":"A-05","target":{"x":10,"y":20},"waypoints":[{"x":5,"y":5}]}  (helicopter only)
  {"type":"march","unitId":"A-01","target":{"kind":"base","id":"OUT-03"}}
  {"type":"march","unitId":"A-01","target":{"kind":"unit","id":"B-02"}}
  {"type":"stop","unitId":"A-01"}
  {"type":"garrison","unitId":"A-01","baseId":"HQ-A"}
  {"type":"set-auto-resupply","unitId":"A-01","enabled":false}
  {"type":"point-fire","unitId":"A-03","cell":{"x":40,"y":40}}
  {"type":"enqueue-production","baseId":"HQ-A","unitKind":"assault"}
  {"type":"cancel-production","jobId":"A-J1"}
  {"type":"start-research","researchId":"air-defense-1"}   (null banks points)
  {"type":"upgrade-base","baseId":"HQ-A"}
  {"type":"build-crossing","siteId":"CROSS-RING-SW","unitId":"A-01"}
  {"type":"build-facility","kind":"antiAir","anchor":{"kind":"base","id":"HQ-A"}}
  {"type":"activate-ability","abilityId":"surge"}
Unit kinds: assault scout artillery antiAir helicopter patrolBoat.
A unit marching on a target keeps firing at that target even when other enemies
shoot it; change its target or stop it to make it answer them.
`;

const args = process.argv.slice(2);
const option = (name: string): string | undefined =>
  args
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const positional = args.filter((argument) => !argument.startsWith('--'));
const sessionPath = option('session') ?? '.agent-play/session.json';

function load(): AgentSession {
  try {
    return JSON.parse(readFileSync(sessionPath, 'utf8')) as AgentSession;
  } catch {
    throw new Error(`no session at ${sessionPath}; run "new" first`);
  }
}

function save(session: AgentSession): void {
  mkdirSync(dirname(sessionPath), { recursive: true });
  writeFileSync(sessionPath, JSON.stringify(session));
}

/** One line per top-level field keeps the output readable and short. */
function print(value: Record<string, unknown>): void {
  const lines = Object.entries(value).flatMap(([key, item]) =>
    key === 'view' && item && typeof item === 'object'
      ? Object.entries(item).map(
          ([field, entry]) => `view.${field}: ${JSON.stringify(entry)}`,
        )
      : [`${key}: ${JSON.stringify(item)}`],
  );
  process.stdout.write(`${lines.join('\n')}\n`);
}

function budgetText(session: AgentSession): string | null {
  const budget = session.commandBudget;
  if (!budget) return null;
  const seconds =
    (budget.windowTicks * session.state.rules.match.tickDurationMs) / 1000;
  const used = commandsInWindow(session);
  return `${Math.max(0, budget.maxCommands - used)} of ${budget.maxCommands} actions left (${used} used in the last ${seconds}s)`;
}

const [action, ...rest] = positional;
if (!action || action === 'help') {
  process.stdout.write(USAGE);
} else if (action === 'new') {
  const budget = option('budget');
  const rules = rulesFromArgs(args);
  let session = createAgentSession({
    seed: Number(option('seed') ?? 42),
    mapId: option('map') === '40' ? 'legacy-40' : 'ring-three-fronts-100',
    ...(rules ? { rules } : {}),
  });
  if (budget) {
    const [seconds, max] = budget.split(':').map(Number);
    if (!seconds || !max) throw new Error('--budget must be seconds:max');
    session = {
      ...session,
      commandBudget: {
        windowTicks: Math.round(
          (seconds * 1000) / session.state.rules.match.tickDurationMs,
        ),
        maxCommands: max,
      },
    };
  }
  save(session);
  print({
    session: sessionPath,
    budget: budgetText(session),
    view: summarizeAgentView(getFactionView(session.state, 'A')),
  });
} else if (action === 'view') {
  const session = load();
  print({
    budget: budgetText(session),
    view: summarizeAgentView(getFactionView(session.state, 'A')),
  });
} else if (action === 'rules') {
  print({ rules: summarizeAgentRules(load().state.rules) });
} else if (action === 'map') {
  const session = load();
  process.stdout.write(
    `${renderAgentMap(getFactionView(session.state, 'A'), Number(option('scale') ?? 2))}\n`,
  );
} else if (action === 'cmd') {
  let session = load();
  const parsed = JSON.parse(rest.join(' ')) as Command | Command[];
  const results = [];
  // The same order to the same target for several units is one action, as a
  // group drag in the browser is.
  for (const group of groupAgentCommands(
    Array.isArray(parsed) ? parsed : [parsed],
  )) {
    const action = issueAgentAction(session, group);
    session = action.session;
    group.forEach((command, index) => {
      const result = action.results[index]!;
      results.push(
        result.ok
          ? { command, ok: true }
          : {
              command,
              ok: false,
              reason: result.reason,
              message:
                result.reason === 'COMMAND_BUDGET'
                  ? '操作上限に達しています。時間を進めてください'
                  : rejectMessage(result.reason, session.state, 'A'),
            },
      );
    });
  }
  save(session);
  print({ results, budget: budgetText(session) });
} else if (action === 'step') {
  const session = load();
  const amount = rest[0] ?? '1';
  const ticks = amount.endsWith('s')
    ? Math.round(
        (Number(amount.slice(0, -1)) * 1000) /
          session.state.rules.match.tickDurationMs,
      )
    : Number(amount);
  const result = stepAgentSession(session, ticks);
  save(result.session);
  print({
    events: result.events,
    budget: budgetText(result.session),
    view: summarizeAgentView(getFactionView(result.session.state, 'A')),
  });
} else if (action === 'replay') {
  const session = load();
  const input = agentReplayInput(session);
  const replayed = replay(input);
  const matches =
    JSON.stringify(replayed.state) === JSON.stringify(session.state);
  const out = option('out');
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(input));
  }
  print({ matches, finalTick: input.finalTick, ...(out ? { out } : {}) });
} else {
  process.stderr.write(`unknown action: ${action}\n\n${USAGE}`);
  process.exit(1);
}

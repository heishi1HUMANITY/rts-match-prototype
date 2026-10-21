import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type AgentSession, advance, hydrate, dehydrate, newSession } from '../src/agent/session';
import { asciiMap, buildView, rulesText } from '../src/agent/view';
import { useLayout } from '../src/map/level';
import type { Side } from '../src/sim/types';

const USAGE = `ROB YOU agent driver — two agents (crew and bank) play one match in lockstep.
Every turn each side submits a JSON array of commands; when both have submitted, the game advances
--every seconds (set at "new") and each side gets its own fog-of-war view.

  npm run agent -- new --session=DIR [--seed=1] [--every=15] [--ai=bank|crew] [--layout=N]
        --layout: branch layout number (0 = the standard layout; default = same as the seed)
  npm run agent -- rules --side=crew|bank [--session=DIR]   rules and command reference for that side
  npm run agent -- map [--session=DIR]                      ASCII map with coordinates (of that session's layout)
  npm run agent -- view --session=DIR --side=crew|bank
  npm run agent -- submit --session=DIR --side=crew|bank '<JSON array>' [--timeout=300]
        waits until the opponent has also submitted (or the timeout passes) and prints your next view
  npm run agent -- status --session=DIR
`;

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const pos = args.filter((a) => !a.startsWith('--'));
const dir = opt('session') ?? '.agent-play/default';
const file = join(dir, 'session.json');
const lockDir = join(dir, 'lock');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function lock() {
  for (let i = 0; i < 600; i++) {
    try {
      mkdirSync(lockDir);
      return;
    } catch {
      try {
        if (Date.now() - statSync(lockDir).mtimeMs > 60_000) rmSync(lockDir, { recursive: true, force: true });
      } catch {
        // 他のプロセスが外した
      }
      await sleep(50);
    }
  }
  throw new Error('could not lock the session');
}
function unlock() {
  rmSync(lockDir, { recursive: true, force: true });
}
function load(): AgentSession {
  return JSON.parse(readFileSync(file, 'utf8')) as AgentSession;
}
function save(s: AgentSession) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(s));
  renameSync(tmp, file);
  if (s.result) writeFileSync(join(dir, 'result.json'), JSON.stringify(s.result, null, 2));
}

function sideArg(): Side {
  const s = opt('side');
  if (s !== 'crew' && s !== 'bank') throw new Error('--side=crew|bank is required');
  return s;
}

async function printView(side: Side) {
  await lock();
  try {
    const s = load();
    const g = hydrate(s);
    const text = buildView(s, g, side);
    dehydrate(s, g);
    save(s);
    process.stdout.write(text + '\n');
  } finally {
    unlock();
  }
}

async function main() {
  const [action] = pos;
  if (!action || action === 'help') {
    process.stdout.write(USAGE);
    return;
  }
  if (action === 'rules' || action === 'map') {
    // セッションがあればその試合のレイアウトで答える
    if (opt('session') && existsSync(file)) useLayout(load().layout ?? 0);
    process.stdout.write((action === 'rules' ? rulesText(sideArg()) : asciiMap()) + '\n');
    return;
  }
  if (action === 'new') {
    mkdirSync(dir, { recursive: true });
    const ai = opt('ai');
    const seed = Number(opt('seed') ?? 1);
    const s = newSession({ seed, every: Number(opt('every') ?? 15), layout: Number(opt('layout') ?? seed), ai: { bank: ai === 'bank', crew: ai === 'crew' } });
    save(s);
    unlock();
    process.stdout.write(`new match at ${dir} (seed ${s.seed}, layout ${s.layout}, every ${s.every}s)\n`);
    return;
  }
  if (!existsSync(file)) throw new Error(`no session at ${dir}; run "new" first`);
  if (action === 'view') return printView(sideArg());
  if (action === 'status') {
    const s = load();
    process.stdout.write(JSON.stringify({ turn: s.turn, time: Math.round(s.game.time), phase: s.game.phase, pending: Object.keys(s.pending), result: s.result }) + '\n');
    return;
  }
  if (action === 'submit') {
    const side = sideArg();
    const other: Side = side === 'crew' ? 'bank' : 'crew';
    let cmds: unknown[];
    try {
      const parsed = JSON.parse(pos[1] ?? '[]') as unknown;
      cmds = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      process.stdout.write(`JSON parse error: ${(e as Error).message}. Nothing was submitted; fix the JSON and submit again.\n`);
      process.exitCode = 1;
      return;
    }
    const timeout = Number(opt('timeout') ?? 300) * 1000;
    let myTurn: number;
    await lock();
    try {
      const s = load();
      if (s.result) {
        unlock();
        return printView(side);
      }
      s.pending[side] = cmds;
      myTurn = s.turn;
      if (!s.waitingSince) s.waitingSince = Date.now();
      if (s.ai[other] || s.pending[other]) {
        advance(s);
        s.waitingSince = 0;
      }
      save(s);
    } finally {
      unlock();
    }
    const started = Date.now();
    for (;;) {
      const s = load();
      if (s.turn > myTurn || s.result) break;
      if (Date.now() - started > timeout) {
        await lock();
        try {
          const t = load();
          if (t.turn === myTurn && !t.result) {
            t.pending[other] = [];
            advance(t);
            t.results[other].unshift('(timeout: you did not submit in time, no commands were applied)');
            t.waitingSince = 0;
            save(t);
          }
        } finally {
          unlock();
        }
        break;
      }
      await sleep(1000);
    }
    return printView(side);
  }
  process.stdout.write(USAGE);
}

main().catch((e) => {
  process.stderr.write(`${(e as Error).message}\n`);
  process.exitCode = 1;
});

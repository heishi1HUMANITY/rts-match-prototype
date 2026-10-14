import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createMatch } from './simulation/match';
import { applyCommand } from './simulation/commands';
import { advanceMatch } from './runtime/advance';
import type { FactionId, MatchState } from './simulation/types';

const isSelfplay = process.env.SELFPLAY === '1';

interface SingleMatchReport {
  seed: number;
  ticks: number;
  phase: string;
  reason: string;
  eliminationBreakdown: Record<FactionId, string>;
  winner: string;
  finalTickets: Record<FactionId, number>;
  baseHistory: Record<number, Record<string, number>>;
}

function formatTicks(ticks: number): string {
  const totalSeconds = Math.floor(ticks / 10);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s (${ticks}t)`;
}

function runSingleMatch(seed: number): SingleMatchReport {
  let state = createMatch(seed, {
    controllers: { A: 'bot', B: 'bot', C: 'bot' },
  });
  const startResult = applyCommand(state, 'A', { type: 'start' });
  state = startResult.state;

  const minuteInterval = 600;
  const baseHistory: Record<number, Record<string, number>> = {};

  const recordBases = (ticks: number, current: MatchState) => {
    const counts = {
      A: 0,
      B: 0,
      C: 0,
      neutral: 0,
      local: 0,
    };
    for (const b of current.bases) {
      if (b.owner === 'A') counts.A++;
      else if (b.owner === 'B') counts.B++;
      else if (b.owner === 'C') counts.C++;
      else if (b.owner === 'local') counts.local++;
      else counts.neutral++;
    }
    const minute = Math.floor(ticks / minuteInterval);
    baseHistory[minute] = counts;
  };

  recordBases(0, state);

  while (state.phase === 'running' && state.elapsedTicks < 12000) {
    state = advanceMatch(state);
    if (state.elapsedTicks % minuteInterval === 0) {
      recordBases(state.elapsedTicks, state);
    }
  }
  recordBases(state.elapsedTicks, state);

  const finalTickets: Record<FactionId, number> = {
    A: Math.round(
      (state.factions.find((f) => f.id === 'A')?.ticketsCenti ?? 0) / 100,
    ),
    B: Math.round(
      (state.factions.find((f) => f.id === 'B')?.ticketsCenti ?? 0) / 100,
    ),
    C: Math.round(
      (state.factions.find((f) => f.id === 'C')?.ticketsCenti ?? 0) / 100,
    ),
  };

  const standings = state.result?.standings ?? [];
  const rank1List = standings.filter((s) => s.rank === 1);
  const winner =
    rank1List.length === 1 && rank1List[0]
      ? rank1List[0].factionId
      : 'draw/tie';

  const eliminationBreakdown: Record<FactionId, string> = {
    A: state.factions.find((f) => f.id === 'A')?.eliminationReason ?? 'alive',
    B: state.factions.find((f) => f.id === 'B')?.eliminationReason ?? 'alive',
    C: state.factions.find((f) => f.id === 'C')?.eliminationReason ?? 'alive',
  };

  return {
    seed,
    ticks: state.elapsedTicks,
    phase: state.phase,
    reason:
      state.result?.reason ??
      (state.elapsedTicks >= 12000 ? 'timeout' : 'running'),
    eliminationBreakdown,
    winner,
    finalTickets,
    baseHistory,
  };
}

describe.runIf(isSelfplay)('selfplay 100 seeds report', () => {
  it('runs 100 seeds and generates selfplay-report.md within 20min per match', () => {
    const startTime = Date.now();
    const results: SingleMatchReport[] = [];

    for (let seed = 1; seed <= 100; seed++) {
      const report = runSingleMatch(seed);
      results.push(report);
    }

    const totalTimeMs = Date.now() - startTime;
    const ticksList = results.map((r) => r.ticks);
    const minTicks = Math.min(...ticksList);
    const maxTicks = Math.max(...ticksList);
    const avgTicks = Math.round(
      ticksList.reduce((a, b) => a + b, 0) / ticksList.length,
    );

    const shortest = results.find((r) => r.ticks === minTicks)!;
    const longest = results.find((r) => r.ticks === maxTicks)!;

    const within10Min = results.filter((r) => r.ticks <= 6000).length;
    const within20Min = results.filter((r) => r.ticks <= 12000).length;

    const winnersCount = {
      A: 0,
      B: 0,
      C: 0,
      'draw/tie': 0,
    };
    for (const r of results) {
      if (r.winner === 'A') winnersCount.A++;
      else if (r.winner === 'B') winnersCount.B++;
      else if (r.winner === 'C') winnersCount.C++;
      else winnersCount['draw/tie']++;
    }

    const reasonsCount: Record<string, number> = {};
    for (const r of results) {
      reasonsCount[r.reason] = (reasonsCount[r.reason] ?? 0) + 1;
    }

    // Base ownership averages across 100 matches by minute (up to max minute)
    const maxMinute = Math.min(20, Math.floor(maxTicks / 600) + 1);
    const baseAverages: {
      minute: number;
      A: number;
      B: number;
      C: number;
      neutral: number;
      samples: number;
    }[] = [];

    for (let m = 0; m <= maxMinute; m++) {
      let countA = 0;
      let countB = 0;
      let countC = 0;
      let countNeutral = 0;
      let samples = 0;
      for (const r of results) {
        const hist = r.baseHistory[m];
        if (hist) {
          countA += hist.A ?? 0;
          countB += hist.B ?? 0;
          countC += hist.C ?? 0;
          countNeutral += hist.neutral ?? 0;
          samples++;
        }
      }
      if (samples > 0) {
        baseAverages.push({
          minute: m,
          A: Number((countA / samples).toFixed(2)),
          B: Number((countB / samples).toFixed(2)),
          C: Number((countC / samples).toFixed(2)),
          neutral: Number((countNeutral / samples).toFixed(2)),
          samples,
        });
      }
    }

    // Format markdown report
    const lines: string[] = [
      '# CP3 F16 100-Seed Selfplay Balance Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Execution time: ${(totalTimeMs / 1000).toFixed(1)}s`,
      '',
      '## Summary',
      '',
      `- Total Matches: ${results.length}`,
      `- Average Match Duration: ${formatTicks(avgTicks)}`,
      `- Shortest Match: Seed ${shortest.seed} - ${formatTicks(minTicks)} (${shortest.reason})`,
      `- Longest Match: Seed ${longest.seed} - ${formatTicks(maxTicks)} (${longest.reason})`,
      `- Finished within 10 min (6000 ticks): ${within10Min} / ${results.length} (${((within10Min / results.length) * 100).toFixed(1)}%)`,
      `- Finished within 20 min (12000 ticks): ${within20Min} / ${results.length} (${((within20Min / results.length) * 100).toFixed(1)}%)`,
      '',
      '## Winner Distribution',
      '',
      '| Faction | Wins | Rate |',
      '|:---|:---|:---|',
      `| A | ${winnersCount.A} | ${((winnersCount.A / results.length) * 100).toFixed(1)}% |`,
      `| B | ${winnersCount.B} | ${((winnersCount.B / results.length) * 100).toFixed(1)}% |`,
      `| C | ${winnersCount.C} | ${((winnersCount.C / results.length) * 100).toFixed(1)}% |`,
      `| Draw / Tie | ${winnersCount['draw/tie'] ?? 0} | ${(((winnersCount['draw/tie'] ?? 0) / results.length) * 100).toFixed(1)}% |`,
      '',
      '## Termination Reasons',
      '',
      '| Reason | Count | Rate |',
      '|:---|:---|:---|',
      ...Object.entries(reasonsCount).map(
        ([reason, count]) =>
          `| ${reason} | ${count} | ${((count / results.length) * 100).toFixed(1)}% |`,
      ),
      '',
      '## Base Ownership Progression (Average bases owned by minute)',
      '',
      '| Minute | A | B | C | Neutral | Active Matches |',
      '|:---|:---|:---|:---|:---|:---|',
      ...baseAverages.map(
        (b) =>
          `| ${b.minute}m | ${b.A} | ${b.B} | ${b.C} | ${b.neutral} | ${b.samples} |`,
      ),
      '',
      '## Match Results (Sample: first 25 seeds)',
      '',
      '| Seed | Duration | Reason | Winner | Tickets (A/B/C) | Eliminations (A/B/C) |',
      '|:---|:---|:---|:---|:---|:---|',
      ...results
        .slice(0, 25)
        .map(
          (r) =>
            `| ${r.seed} | ${formatTicks(r.ticks)} | ${r.reason} | ${r.winner} | ${r.finalTickets.A}/${r.finalTickets.B}/${r.finalTickets.C} | ${r.eliminationBreakdown.A}/${r.eliminationBreakdown.B}/${r.eliminationBreakdown.C} |`,
        ),
      '',
    ];

    const reportContent = lines.join('\n');
    const reportPath = path.resolve(process.cwd(), 'selfplay-report.md');
    fs.writeFileSync(reportPath, reportContent, 'utf-8');

    // Console summary output
    console.log('\n=== SELFPLAY REPORT SUMMARY ===');
    console.log(`Matches: ${results.length}`);
    console.log(`Average: ${formatTicks(avgTicks)}`);
    console.log(`Shortest: Seed ${shortest.seed} (${formatTicks(minTicks)})`);
    console.log(`Longest: Seed ${longest.seed} (${formatTicks(maxTicks)})`);
    console.log(
      `<= 10min: ${within10Min}/${results.length} (${((within10Min / results.length) * 100).toFixed(1)}%)`,
    );
    console.log(
      `<= 20min: ${within20Min}/${results.length} (${((within20Min / results.length) * 100).toFixed(1)}%)`,
    );
    console.log(
      `Winners: A: ${winnersCount.A}, B: ${winnersCount.B}, C: ${winnersCount.C}, Draw: ${winnersCount['draw/tie'] ?? 0}`,
    );
    console.log('Reasons:', reasonsCount);
    console.log(`Report written to: ${reportPath}\n`);

    expect(results.length).toBe(100);
    expect(within20Min).toBe(100);
    for (const r of results) {
      expect(r.ticks).toBeLessThanOrEqual(12000);
      expect(r.phase).toBe('finished');
    }
  }, 300000);
});

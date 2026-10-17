import fs from 'node:fs';
import assert from 'node:assert/strict';

function analyzeNorthOwnershipEvents(transitions, northFaction) {
  let everOwnedByNorth = false;
  let captures = 0;
  let losses = 0;
  for (const event of [...transitions].sort((a, b) => a.tick - b.tick)) {
    if (event.to === northFaction) {
      captures += 1;
      everOwnedByNorth = true;
    }
    if (event.from === northFaction && event.to === null) losses += 1;
  }
  return {
    captures,
    firstCapture: captures > 0,
    recaptures: Math.max(0, captures - 1),
    losses,
    everOwnedByNorth,
  };
}

const fixture = analyzeNorthOwnershipEvents(
  [
    { tick: 1, from: null, to: 'C' },
    { tick: 2, from: 'C', to: null },
    { tick: 3, from: null, to: 'C' },
  ],
  'C',
);
assert.deepEqual(fixture, {
  captures: 2,
  firstCapture: true,
  recaptures: 1,
  losses: 1,
  everOwnedByNorth: true,
});

const path = new URL(
  './cp12-map-fairness-tuning-v5-audit3.jsonl',
  import.meta.url,
);
const rows = fs
  .readFileSync(path, 'utf8')
  .trim()
  .split(/\r?\n/)
  .map((line) => JSON.parse(line));
assert.equal(rows.length, 18, 'fixed tuning set must contain 18 matches');
const details = rows.map((row) => {
  const northFaction = Object.entries(row.seatByFaction).find(
    ([, seat]) => seat === 'north',
  )?.[0];
  assert.ok(northFaction, `seed ${row.seed}: North faction assignment missing`);
  const transitions = row.baseOwnershipChanges
    .filter(({ baseId }) => baseId === 'OUT-02')
    .sort((a, b) => a.tick - b.tick);
  const northOwnership = analyzeNorthOwnershipEvents(transitions, northFaction);
  const elimination = row.eliminationDetails.find(
    ({ factionId }) => factionId === northFaction,
  );
  assert.ok(elimination, `seed ${row.seed}: North elimination record missing`);
  const northWeightAtElimination = elimination.baseOwnership
    .filter(({ owner }) => owner === northFaction)
    .reduce((sum, base) => sum + base.ticketWeight, 0);
  return {
    seed: row.seed,
    northFaction,
    northRoute: row.routeByFaction[northFaction],
    out02Transitions: transitions,
    ...northOwnership,
    eliminationReason: elimination.reason,
    ticketsCentiAtElimination: elimination.ticketsCenti,
    northWeightAtElimination,
    hqHpAtElimination: elimination.hqHpBeforeOutcome,
    ticketLossCenti: row.ticketLossByFaction[northFaction],
  };
});
const sum = (key) =>
  details.reduce((total, row) => total + row.ticketLossCenti[key], 0);
const summary = {
  matches: rows.length,
  northOut02InitialCaptures: details.filter(({ firstCapture }) => firstCapture)
    .length,
  northOut02Losses: details.reduce((total, row) => total + row.losses, 0),
  northOut02Recaptures: details.reduce(
    (total, row) => total + row.recaptures,
    0,
  ),
  northRouteCounts: Object.fromEntries(
    [...new Set(details.map(({ northRoute }) => northRoute))].map((route) => [
      route,
      details.filter((row) => row.northRoute === route).length,
    ]),
  ),
  northWeightAtElimination: Object.fromEntries(
    [2, 3, 5].map((weight) => [
      weight,
      details.filter((row) => row.northWeightAtElimination === weight).length,
    ]),
  ),
  northEliminatedByTickets: details.filter(
    ({ eliminationReason }) => eliminationReason === 'tickets',
  ).length,
  northHQHpAtElimination: [
    ...new Set(details.map(({ hqHpAtElimination }) => hqHpAtElimination)),
  ],
  ticketLossTotalsCenti: {
    combat: sum('combatCenti'),
    territory: sum('territoryPenaltyCenti'),
    time: sum('timeDecayCenti'),
  },
  perMatch: details,
};
assert.equal(summary.northOut02InitialCaptures, 12);
assert.equal(summary.northOut02Losses, 12);
assert.equal(summary.northOut02Recaptures, 1);
assert.equal(summary.northEliminatedByTickets, 18);
assert.deepEqual(summary.northWeightAtElimination, { 2: 2, 3: 15, 5: 1 });
assert.deepEqual(summary.northHQHpAtElimination, [1200]);
console.log(JSON.stringify(summary, null, 2));

import fs from 'node:fs';
const rows = fs
  .readFileSync(
    new URL('./seeds1-2-event-diagnostics.jsonl', import.meta.url),
    'utf8',
  )
  .trim()
  .split(/\r?\n/)
  .map(JSON.parse);
for (const row of rows) {
  const faction = Object.keys(row.seatByFaction).find(
    (id) => row.seatByFaction[id] === 'north',
  );
  const diagnostic = row.northDiagnostic;
  const events = diagnostic.combatEvents.map((event) => ({
    tick: event.tick,
    lossCenti: event.lossCenti,
    dead: event.lostUnits.map(
      (unit) =>
        `${unit.id}/${unit.kind}@${unit.cell.x},${unit.cell.y} -> ${unit.marchTarget}`,
    ),
    visible: event.visibleEnemies.map(
      (enemy) =>
        `${enemy.factionId}/${enemy.kind}@${enemy.cell.x},${enemy.cell.y}`,
    ),
    out02: `${event.out02OwnerBefore}>${event.out02OwnerAfter}`,
  }));
  const transitions = diagnostic.out02Transitions.map((event) => ({
    tick: event.tick,
    owner: `${event.from}>${event.to}`,
    northNear: event.nearbyNorthUnits.map(
      (unit) =>
        `${unit.id}/${unit.kind}@${unit.cell.x},${unit.cell.y} -> ${unit.marchTarget}`,
    ),
    visible: event.visibleEnemies.map(
      (enemy) =>
        `${enemy.factionId}/${enemy.kind}@${enemy.cell.x},${enemy.cell.y}`,
    ),
  }));
  console.log(
    JSON.stringify(
      {
        seed: row.seed,
        faction,
        route: row.routeByFaction[faction],
        firstNeutral: row.firstNeutralByFaction[faction],
        out02: transitions,
        combatTotalCenti: row.ticketLossByFaction[faction].combatCenti,
        combatEvents: events,
      },
      null,
      2,
    ),
  );
}

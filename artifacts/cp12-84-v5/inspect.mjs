import fs from 'node:fs';
const rows = fs
  .readFileSync(
    new URL('./cp12-map-fairness-tuning-v5-audit3.jsonl', import.meta.url),
    'utf8',
  )
  .trim()
  .split(/\r?\n/)
  .map((line) => JSON.parse(line));
for (const row of rows) {
  const faction = Object.entries(row.seatByFaction).find(
    ([, seat]) => seat === 'north',
  )[0];
  const e = row.eliminationDetails.find(
    ({ factionId }) => factionId === faction,
  );
  const own = e.baseOwnership.filter(({ owner }) => owner === faction);
  const weights = own.map(
    ({ id, kind, ticketWeight }) => `${id}:${kind}:${ticketWeight}`,
  );
  console.log(
    row.seed,
    faction,
    e.reason,
    e.ticketsCenti,
    weights.join('|'),
    own.reduce((total, b) => total + (b.ticketWeight ?? 0), 0),
  );
}

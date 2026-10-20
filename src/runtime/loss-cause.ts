const UNIT_NAMES: Readonly<Record<string, string>> = {
  assault: '強襲',
  scout: '偵察',
  artillery: '自走砲',
  antiAir: '対空',
  helicopter: 'ヘリ',
  patrolBoat: '哨戒艇',
};
const FACILITY_NAMES: Readonly<Record<string, string>> = {
  turret: '砲台',
  antiAir: '対空陣地',
  mine: '地雷',
  watchtower: '観測塔',
  jammer: '妨害塔',
};

/** Japanese label for a unit-loss cause recorded by combat. */
export function lossCauseLabel(cause: string): string {
  const [kind, detail = ''] = cause.split(':');
  if (kind === 'unit') return `敵の${UNIT_NAMES[detail] ?? detail}`;
  if (kind === 'facility') return `敵の${FACILITY_NAMES[detail] ?? detail}`;
  if (kind === 'artillery-strike') return '自走砲の地点砲撃';
  if (kind === 'artillery-ability') return '作戦指令の砲撃';
  if (kind === 'neutral-defender') return '中立拠点の守備';
  if (kind === 'base-anti-air') return '敵拠点の対空射撃';
  if (kind === 'base-turret') return '敵拠点の砲座';
  return '不明';
}

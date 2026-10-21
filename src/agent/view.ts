import { CONFIG } from '../config';
import { H, LEVEL as L, Mat, W, Zone, idx } from '../map/level';
import { hostageCount, instantlyReportable, officeDoor } from '../sim/rules';
import type { Game, Side, Unit } from '../sim/types';
import { type Source, pointSeen, sourceSees, sourcesFor } from '../sim/vision';
import { MASK_NAMES, active, isPrivateAt, roomNameAt, securedBags } from '../sim/world';
import { type AgentSession, aliasOf } from './session';

// 陣営ごとの観測（自陣営から見えている情報だけ）をテキストで返す

const f1 = (n: number) => n.toFixed(1);
const pos = (o: { x: number; y: number }) => `(${f1(o.x)},${f1(o.y)})`;
const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

function dirName(rad: number): string {
  const names = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  const k = Math.round(((rad % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 4)) % 8;
  return names[k]!;
}

function roadblockAt(slot: string): string {
  const r = L.roadblocks.find((x) => x.id === slot)!;
  return `(${r.x + 0.5},${r.y0}-${r.y1 + 1})`;
}

function phaseLine(g: Game): string {
  const left =
    g.phase === 'casing'
      ? `alarm at closing in ${Math.ceil(CONFIG.phase.casingSeconds - g.phaseTime)}s`
      : g.phase === 'response'
        ? `police arrive in ${Math.ceil(CONFIG.phase.responseSeconds - g.phaseTime)}s`
        : g.phase === 'assault'
          ? `siege completes (bank wins) in ${Math.ceil(CONFIG.phase.assaultSeconds - g.phaseTime)}s`
          : 'ended';
  return `phase=${g.phase} (${left})`;
}

function unitState(u: Unit): string {
  if (u.action) return `${u.action.kind} ${Math.round((u.action.t / u.action.dur) * 100)}%`;
  if (u.order?.type === 'move') return `moving→${pos(u.order)}`;
  if (u.order?.type === 'attack') return `attacking`;
  if (u.order?.type === 'act') return `going to ${u.order.kind}`;
  if (u.path.length) return 'moving';
  return 'idle';
}

function events(s: AgentSession, g: Game, side: Side): string[] {
  const from = s.eventCursor[side];
  const evs = g.events.filter((e) => e.id > from && (e.vis === 'all' || e.vis === side));
  if (g.events.length) s.eventCursor[side] = g.events[g.events.length - 1]!.id;
  return evs.slice(-14).map((e) => `  [${Math.round(e.t)}s] ${e.text}`);
}

function doorsLine(g: Game): string[] {
  return g.doors.map((d) => {
    const sl = L.doorSlots[d.slot]!;
    const [x, y] = sl.tiles[0]!;
    const st = d.destroyed ? 'DESTROYED(open)' : d.jammed ? 'JAMMED-OPEN' : d.locked ? 'LOCKED' : 'unlocked';
    return `  door#${d.id} ${sl.id} "${sl.name}" at (${x + 0.5},${y + 0.5})${sl.tiles.length > 1 ? ` x${sl.tiles.length}` : ''} ${st}${d.security ? ' SECURITY' : ''}${sl.kind === 'office' ? ' (card lock)' : ''}`;
  });
}

// 強盗側が把握している監視の目（見つけたカメラと支店長室の窓）
function knownWatchers(g: Game, s: AgentSession): Source[] {
  const known = new Set(s.crewSeenCams);
  return sourcesFor(g, 'bank').filter((src) => {
    if (src.kind === 'office') return true;
    if (src.kind === 'camera') return g.cameras.some((c) => known.has(c.id) && c.x === src.x && c.y === src.y && c.loop <= 0);
    return false;
  });
}

function rememberCrewCameras(s: AgentSession, g: Game): number[] {
  for (const id of g.vis.crew.cameras) if (!s.crewSeenCams.includes(id)) s.crewSeenCams.push(id);
  return s.crewSeenCams;
}

export function buildView(s: AgentSession, g: Game, side: Side): string {
  const out: string[] = [];
  out.push(`=== TURN ${s.turn} | you are ${side === 'crew' ? 'THE CREW (robbers)' : g.phase === 'assault' ? 'THE BANK (now commanding police)' : 'THE BANK MANAGER'} | t=${Math.round(g.time)}s | ${phaseLine(g)} | next decision in ${s.every}s ===`);
  if (s.result) {
    out.push(`GAME OVER: winner=${s.result.winner} — ${s.result.reason}`);
    out.push(side === s.result.winner ? 'YOU WON.' : 'YOU LOST.');
    return out.join('\n');
  }
  const res = s.results[side];
  if (res.length) out.push('LAST COMMAND RESULTS:', ...res.map((r) => '  ' + r));
  const evs = events(s, g, side);
  if (evs.length) out.push('NEWS/EVENTS SINCE LAST TURN:', ...evs);
  if (side === 'crew') crewView(s, g, out);
  else bankView(s, g, out);
  // ターン中に見えていた敵（今は見えていないものも含む）
  const sight = Object.entries(s.sightings[side]).filter(([name]) => !out.some((l) => l.includes(name + ' ')));
  if (sight.length) out.push(`SIGHTED DURING THE LAST ${s.every}s (last known position): ${sight.map(([name, v]) => `${name} ${v.what} ${pos(v)} at ${Math.round(v.t)}s`).join(' | ')}`);
  s.sightings[side] = {};
  // 自陣営の被害（発生源別）
  const hurt: string[] = [];
  for (const u of g.units) {
    const mine = side === 'crew' ? u.kind === 'crew' : u.kind === 'guard' || u.kind === 'swat';
    if (!mine || !Object.keys(u.hurt).length) continue;
    const total = Object.values(u.hurt).reduce((a, b) => a + b, 0);
    hurt.push(`#${u.id} ${u.callsign || u.kind} took ${Math.round(total)} (${Object.entries(u.hurt).map(([k, v]) => `${k} ${Math.round(v)}`).join(', ')})${u.alive ? '' : ' and went down'}`);
    u.hurt = {};
  }
  if (hurt.length) out.push(`DAMAGE TAKEN SINCE LAST TURN: ${hurt.join(' | ')}`);
  // 自陣営が与えた被害
  const dealt = Object.entries(g.dealt[side]).map(([key, v]) => {
    const u = /^\d+$/.test(key) ? g.units.find((x) => x.id === Number(key)) : undefined;
    const name = u ? (side === 'crew' ? aliasOf(s, 'crew', u) : aliasOf(s, 'bank', u)) : key;
    return `${name} ${Math.round(v)}${u && !u.alive ? ' (down)' : ''}`;
  });
  if (dealt.length) out.push(`DAMAGE YOU DEALT SINCE LAST TURN: ${dealt.join(', ')}`);
  g.dealt[side] = {};
  return out.join('\n');
}

function crewView(s: AgentSession, g: Game, out: string[]) {
  const known = rememberCrewCameras(s, g);
  const b = g.breach;
  const watchers = knownWatchers(g, s);
  const guardSrc: Source[] = g.units
    .filter((u) => u.kind === 'guard' && active(u) && g.vis.crew.units.has(u.id) && !u.bribed)
    .map((u) => ({ x: u.x, y: u.y, dir: 0, fov: Math.PI * 2, range: CONFIG.vision.unit, live: true, blindToCrew: false, kind: 'unit' }));
  out.push(`FUNDS ${money(g.funds.crew)} | crew alive ${g.units.filter((u) => u.kind === 'crew' && u.alive && !u.escaped).length}/${CONFIG.crew.max} | stock turret=${g.stock.turret} barricade=${g.stock.barricade} trap=${g.stock.trap} drill=${g.stock.drill} | purchase tickets ${g.tickets} | negotiation cards ${g.negotiation.cards}${g.negotiation.cooldown > 0 ? ` (cooldown ${Math.ceil(g.negotiation.cooldown)}s)` : ''} | hostages ${hostageCount(g)}`);
  const total = CONFIG.breach[b.method].time * (b.reinforced ? CONFIG.breach.reinforceMul : 1);
  const vault = b.open
    ? 'OPEN'
    : b.installed
      ? `${b.method} ${Math.round(b.progress * 100)}% (about ${Math.ceil((1 - b.progress) * total)}s left${b.jammed ? ', JAMMED: needs fix' : ''})`
      : `closed, no device (${g.plan.breach} would take ${Math.round(total)}s${b.reinforced ? ', door reinforced' : ''})`;
  out.push(`PLAN breach=${g.plan.breach} escape=${g.plan.escape} | vault: ${vault}${g.breach.reinforced ? ' (reinforced)' : ''}${g.officeDrill.installed ? ` | office drill ${Math.round(g.officeDrill.progress * 100)}%` : ''}`);
  if (g.plan.escape === 'van') out.push(`VAN at ${pos(g.van!)} state=${g.van!.state} bags ${g.van!.bags}/${CONFIG.gold.quotaBags} hp ${Math.round(g.van!.hp)}`);
  else out.push(`FULTON: secured ${securedBags(g)}/${CONFIG.gold.quotaBags} bags | plane: ${g.plane.eta >= 0 ? `inbound, over the rooftop in ${Math.ceil(g.plane.eta)}s` : g.plane.cooldown > 0 ? `turning around, callable in ${Math.ceil(g.plane.cooldown)}s` : 'standing by (callPlane)'} | balloons: ${g.bags.filter((x) => x.state === 'balloon').map((x) => `bag#${x.id}${pos(x)} ${x.balloon > 0 ? 'inflating' : 'ready'}`).join(', ') || 'none'}`);
  out.push('YOUR CREW:');
  for (const u of g.units.filter((u) => u.kind === 'crew')) {
    if (u.escaped) {
      out.push(`  #${u.id} ${u.callsign} ESCAPED`);
      continue;
    }
    if (!u.alive) {
      out.push(`  #${u.id} ${u.callsign} DEAD`);
      continue;
    }
    const flags = [u.masked ? 'masked' : 'unmasked', u.heavy ? 'HEAVY' : '', u.hasTool ? 'HAS-BREACH-TOOL' : '', u.hasKey ? 'HAS-KEYCARD' : '', u.carrying >= 0 ? `CARRYING-GOLD bag#${u.carrying}` : ''].filter(Boolean);
    let watch = '';
    if (g.phase === 'casing') {
      const seenBy = [...watchers, ...guardSrc].filter((src) => sourceSees(g, src, u.x, u.y)).map((src) => (src.kind === 'office' ? 'manager-window' : src.kind === 'camera' ? `cam` : 'guard'));
      const staffOnly = isPrivateAt(u.x, u.y) && !u.masked && !u.heavy;
      watch = ` | ${seenBy.length ? `WATCHED by ${[...new Set(seenBy)].join('+')}` : 'not watched by known eyes'}${u.masked || u.heavy ? ' | REPORTABLE-ON-SIGHT' : staffOnly ? ` | IN STAFF-ONLY AREA (reported if a watcher keeps you in view for ${CONFIG.observe.privateGrace}s)` : u.suspicious ? ' | acting suspicious' : ''}`;
    }
    out.push(`  #${u.id} ${u.callsign}(${MASK_NAMES[u.maskStyle]}) ${roomNameAt(u.x, u.y)} ${pos(u)} hp${Math.round(u.hp)}/${u.maxHp} armor${Math.round(u.armor)} ${flags.join(' ')} [${unitState(u)}]${u.role === 'invan' ? ' IN VAN' : ''}${g.crewBalloons.some((x) => x.unit === u.id) ? ' WAITING-FOR-HELI' : ''}${watch}`);
  }
  const seen = g.units.filter((u) => u.kind !== 'crew' && u.kind !== 'sniper' && active(u) && g.vis.crew.units.has(u.id));
  const guards = seen.filter((u) => u.kind === 'guard' || u.kind === 'swat');
  out.push(`ENEMIES SEEN: ${guards.length ? '' : 'none'}`);
  for (const u of guards) out.push(`  ${aliasOf(s, 'crew', u)} ${u.kind}${u.bribed ? ' (BRIBED by you)' : ''} ${roomNameAt(u.x, u.y)} ${pos(u)} hp${Math.round(u.hp)} [${u.moving ? 'moving' : 'still'}]`);
  const snipers = g.units.filter((u) => u.kind === 'sniper' && u.alive);
  if (snipers.length) out.push(`SNIPER GLINTS on rooftops: ${snipers.map((u) => `${u.spot}${pos(u)}`).join(', ')}`);
  const civ = seen.filter((u) => u.kind === 'civilian' || u.kind === 'staff' || u.kind === 'manager');
  if (civ.length)
    out.push(
      `CIVILIANS/STAFF SEEN (${civ.length}): ${civ
        .slice(0, 30)
        .map((u) => `${aliasOf(s, 'crew', u)}${pos(u)}${u.brain?.state === 'hostage' ? 'HOSTAGE' : u.brain?.state === 'cower' ? 'cowering' : u.brain?.state === 'flee' ? 'fleeing' : ''}`)
        .join(' ')}`,
    );
  out.push('CAMERAS YOU HAVE SPOTTED:');
  for (const id of known) {
    const c = g.cameras.find((x) => x.id === id);
    if (!c) continue;
    out.push(`  cam#${c.id} ${roomNameAt(c.x, c.y)} ${pos(c)} facing ${dirName(c.dir)}${c.destroyed ? ' DESTROYED' : c.loop > 0 ? ` LOOPED ${Math.ceil(c.loop)}s` : ''}${g.vis.crew.cameras.has(c.id) ? '' : ' (not in view now)'}`);
  }
  const sensors = g.sensors.filter((x) => x.intel || pointSeen(g, sourcesFor(g, 'crew'), x.x, x.y));
  if (sensors.length) out.push(`MOTION SENSORS SEEN: ${sensors.map((x) => pos(x)).join(' ')}`);
  out.push('DOORS:', ...doorsLine(g));
  const bags = g.bags.filter((x) => (x.state === 'ground' || x.state === 'vault') && (x.kind !== 'gold' || x.state === 'ground' || b.open));
  out.push(`LOOSE ITEMS: ${bags.map((x) => `${x.kind}#${x.id}${pos(x)}${x.state === 'vault' ? 'in-vault' : ''}`).join(' ') || 'none'}${!b.open ? ` | vault holds gold bags ${g.bags.filter((x) => x.kind === 'gold' && x.state === 'vault').map((x) => '#' + x.id).join(' ')} (pickup works once it is open; target "nearest" picks the closest)` : ''}`);
  const keycard = g.bags.find((x) => x.kind === 'keycard' && x.state === 'ground');
  if (keycard && !officeDoor(g).destroyed) out.push(`(the manager keycard lies in the locked manager office at ${pos(keycard)})`);
  if (g.turrets.length || g.barricades.length || g.traps.length)
    out.push(`YOUR FORTIFICATIONS: ${[...g.turrets.map((t) => `turret${pos(t)}hp${Math.round(t.hp)}`), ...g.barricades.map((t) => `barricade${pos(t)}hp${Math.round(t.hp)}`), ...g.traps.map((t) => `trap${pos(t)}`)].join(' ')}`);
  if (g.roadblocks.length) out.push(`POLICE ROADBLOCKS (attack with targetKind "roadblock", target = slot name): ${g.roadblocks.map((r) => `${r.slot} at ${roadblockAt(r.slot)} hp${Math.round(r.hp)}`).join(' | ')}`);
  if (g.gases.length) out.push(`TEAR GAS: ${g.gases.map((k) => `${pos(k)} ${Math.ceil(k.t)}s`).join(' ')}`);
}

function bankView(s: AgentSession, g: Game, out: string[]) {
  const assault = g.phase === 'assault';
  out.push(
    assault
      ? `COMMAND POINTS ${Math.floor(g.cp)}/${CONFIG.police.cpMax} | SWAT ${g.units.filter((u) => u.kind === 'swat' && u.alive).length + g.pendingSwat.length}/${CONFIG.swat.maxActive} | snipers ${g.units.filter((u) => u.kind === 'sniper' && u.alive).length}/${CONFIG.sniper.maxActive} | gas cooldown ${Math.ceil(g.gasCooldown)}s${g.negotiation.freeze > 0 ? ` | NEGOTIATION FREEZE ${Math.ceil(g.negotiation.freeze)}s (police cannot act)` : ''}`
      : `${g.phase === 'response' ? `POLICE ARRIVE WITH ${CONFIG.police.cpStart} CP (+${CONFIG.police.cpRegen}/s) | ` : ''}BUDGET ${money(g.funds.bank)} | cameras ${g.cameras.filter((c) => !c.destroyed).length}/${CONFIG.bank.cameraMax} | sensors ${g.sensors.length}/${CONFIG.bank.sensorMax} | vault reinforced: ${g.breach.reinforced}`,
  );
  out.push(`hostages ${hostageCount(g)} | vault door: ${g.phase !== 'casing' && g.breach.open ? 'BREACHED' : pointSeen(g, sourcesFor(g, 'bank'), 40, 14.5) ? (g.breach.installed ? `a device is attached (${g.breach.method})` : 'closed') : 'not in view'}`);
  if (g.phase === 'casing') {
    const o = g.observe;
    const t = o.target >= 0 ? g.units.find((u) => u.id === o.target) : undefined;
    out.push(
      `OBSERVATION: ${o.holding && t ? `watching ${aliasOf(s, 'bank', t)} ${o.progress.toFixed(1)}/${CONFIG.observe.duration}s` : 'idle'}${o.cooldown > 0 ? ` | cooldown ${Math.ceil(o.cooldown)}s after a false alarm` : ''}${o.resultT > 0 && o.result ? ` | last result: ${o.result}` : ''}${s.macros.observeQueue.length ? ` | queue ${s.macros.observeQueue.join(',')}` : ''}`,
    );
  }
  out.push('YOUR UNITS:');
  for (const u of g.units.filter((u) => (u.kind === 'guard' || u.kind === 'swat') && !u.escaped)) {
    if (!u.alive) {
      out.push(`  #${u.id} ${u.kind} DOWN`);
      continue;
    }
    out.push(`  #${u.id} ${u.kind}${u.deserting ? ' (LEAVING HIS POST?!)' : ''} ${roomNameAt(u.x, u.y)} ${pos(u)} hp${Math.round(u.hp)} armor${Math.round(u.armor)} [${unitState(u)}]${s.macros.patrol[u.id] ? ' patrolling' : ''}`);
  }
  const sn = g.units.filter((u) => u.kind === 'sniper' && u.alive);
  if (sn.length) out.push(`  snipers at: ${sn.map((u) => u.spot).join(', ')}`);
  if (g.pendingSwat.length) out.push(`  SWAT arriving: ${g.pendingSwat.map((p) => `${pos(p)} in ${Math.ceil(p.t)}s`).join(', ')}`);
  const mgr = g.units.find((u) => u.kind === 'manager');
  if (mgr) out.push(`  the manager (you) ${mgr.alive ? (mgr.brain?.state === 'hostage' ? 'is a HOSTAGE' : `is in ${roomNameAt(mgr.x, mgr.y)}`) : 'is down'} — the office window view works only while he sits in the office`);
  const ppl = g.units.filter((u) => (u.kind === 'civilian' || u.kind === 'crew') && u.alive && g.vis.bank.units.has(u.id));
  out.push(`PEOPLE IN VIEW (${ppl.length}) — robbers look exactly like customers unless flagged:`);
  for (const u of ppl) {
    const flags: string[] = [];
    if (u.masked) flags.push('MASKED');
    if (u.heavy) flags.push('HEAVY-ARMOR');
    if (isPrivateAt(u.x, u.y)) flags.push('IN-STAFF-ONLY-AREA');
    if (u.action) flags.push('doing-something');
    if (u.carrying >= 0) flags.push('carrying-money-bag');
    if (u.look.bag !== 'none') flags.push('has-bag');
    const st = u.brain?.state;
    if (st === 'hostage') flags.push('HOSTAGE');
    else if (st === 'cower') flags.push('cowering');
    else if (st === 'flee') flags.push('fleeing');
    if (instantlyReportable(u) && g.phase === 'casing') flags.push('=> REPORTABLE NOW');
    out.push(`  ${aliasOf(s, 'bank', u)} ${roomNameAt(u.x, u.y)} ${pos(u)} ${u.moving ? 'walking' : 'standing'}${flags.length ? ' ' + flags.join(' ') : ''}`);
  }
  const staff = g.units.filter((u) => u.kind === 'staff' && u.alive && g.vis.bank.units.has(u.id));
  if (staff.length) out.push(`STAFF IN VIEW: ${staff.map((u) => `${aliasOf(s, 'bank', u)}${pos(u)}${u.brain?.state === 'hostage' ? 'HOSTAGE' : ''}`).join(' ')}`);
  const alerts = g.alerts.map((a) => `  ALERT at ${pos(a)}: ${a.text}`);
  if (alerts.length) out.push('ACTIVE ALERTS:', ...alerts);
  out.push('YOUR CAMERAS:');
  for (const c of g.cameras) out.push(`  cam#${c.id} ${roomNameAt(c.x, c.y)} ${pos(c)} facing ${dirName(c.dir)}${c.destroyed ? ' DESTROYED' : ''}`);
  if (g.sensors.length) out.push(`SENSORS: ${g.sensors.map((x) => pos(x)).join(' ')}`);
  out.push('DOORS:', ...doorsLine(g));
  const vt = g.turrets.filter((t) => g.vis.bank.turrets.has(t.id));
  const vb = g.barricades.filter((t) => g.vis.bank.barricades.has(t.id));
  if (vt.length || vb.length) out.push(`ENEMY FORTIFICATIONS SEEN: ${[...vt.map((t) => `turret#${t.id}${pos(t)}hp${Math.round(t.hp)}`), ...vb.map((t) => `barricade#${t.id}${pos(t)}hp${Math.round(t.hp)}`)].join(' ')}`);
  const bags = g.bags.filter((x) => g.vis.bank.bags.has(x.id) && x.kind === 'gold' && x.state !== 'vault');
  if (bags.length) out.push(`MONEY BAGS SEEN: ${bags.map((x) => `bag#${x.id}${pos(x)}${x.state === 'balloon' ? ' ON A BALLOON' : ''}`).join(' ')}`);
  if (g.vis.bank.van && g.van) out.push(`A white "HARBOR FLOWERS" van is visible at ${pos(g.van)} (${g.van.state})`);
  if (g.roadblocks.length) out.push(`ROADBLOCKS: ${g.roadblocks.map((r) => `${r.slot} at ${roadblockAt(r.slot)} hp${Math.round(r.hp)}`).join(' | ')}`);
  if (g.plan.escape === 'fulton' && (g.plane.pass > 0 || (g.plane.eta >= 0 && g.plane.eta <= CONFIG.escape.fulton.warnAt))) out.push('A small aircraft is flying low over the Grand Hotel rooftop (west of the bank) right now.');
}

// ---- 規則と地図 ----
export function asciiMap(): string {
  const rows: string[] = [];
  let head = '    ';
  for (let x = 0; x < W; x++) head += x % 10 === 0 ? String((x / 10) % 10) : ' ';
  rows.push(head);
  let head2 = '    ';
  for (let x = 0; x < W; x++) head2 += String(x % 10);
  rows.push(head2);
  for (let y = 0; y < H; y++) {
    let r = String(y).padStart(3) + ' ';
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      const z = L.zone[i];
      const m = L.mat[i];
      let ch = '?';
      if (L.vaultAt[i]) ch = 'V';
      else if (L.doorAt[i]! >= 0) ch = 'D';
      else if (m === Mat.Roof) ch = L.solid[i] ? '^' : 'r';
      else if (m === Mat.Grate) ch = 'f';
      else if (m === Mat.Wall) ch = '#';
      else if (m === Mat.Glass) ch = '=';
      else if (L.solid[i]) ch = 'o';
      else if (z === Zone.Out) ch = m === Mat.Asphalt ? ' ' : ',';
      else if (z === Zone.Public) ch = '.';
      else if (z === Zone.Vault) ch = '$';
      else if (z === Zone.Private) ch = ':';
      r += ch;
    }
    rows.push(r);
  }
  return [
    'MAP (x right 0-83, y down 0-47). Legend: # wall, = glass (see-through, not walkable), o furniture (see-through, not walkable),',
    "D door, V vault door, . public area (customers allowed), : STAFF-ONLY area (anyone there is reportable), $ vault, ',' sidewalk, ' ' road, ^ rooftops,",
    'r walkable Grand Hotel rooftop (fulton pickup area), f fire escape from the west alley up to that rooftop.',
    ...rows,
  ].join('\n');
}

// 試合ごとに変わる部分（扉の位置など）。家具の配置は map を見る
function layoutText(): string {
  const at = (id: string) => {
    const s = L.doorSlots.find((d) => d.id === id)!;
    const [x, y] = s.tiles[0]!;
    return `(${x},${y})`;
  };
  return `This match uses branch layout #${L.layout}${L.layout === 0 ? ' (standard)' : ''}: interior doors are back office ${at('office')}, security room ${at('security')}, locker room ${at('locker')}, deposit room ${at('storage')}, break room ${at('break')}. Furniture and the gold pallets inside the vault also vary; check "map".`;
}

export function rulesText(side: Side): string {
  const C = CONFIG;
  const common = `ROB YOU — agent rules (${side === 'crew' ? 'CREW / robbers' : 'BANK manager, later police'})
Goal: crew wins by escaping with >= ${C.gold.quotaBags} gold bags (each $${C.gold.bagValue}); bank wins if every robber is down or the siege timer runs out.
Each turn you send a JSON array of commands; then ${'`every`'} game seconds pass. Units keep executing orders between turns.
If you give the SAME unit several orders in one turn, the first runs now and the rest run one after another when the previous one finishes
(e.g. [pickup, deposit] for one carrier, or [move, act equip]). A queued gold pickup waits until the vault is open. Orders for different units all start at once.
A new order for a unit cancels what it is doing (including an action in progress).
Phases: casing (normal business, ${C.phase.casingSeconds}s; when it runs out the alarm goes off automatically) -> response (police arrive after ${C.phase.responseSeconds}s, guns allowed) -> assault (police assault, ${C.phase.assaultSeconds}s).
Vision: you only see what your own units/cameras see. Positions are in map tiles (x,y). Use "map" output for the layout.
Combat starts only after the alarm. Armed units shoot automatically at enemies in range (~9 tiles) with line of sight; "attack" makes them chase one target.

Key places: lobby (24-59, 23-38), main entrance (39-44, 39), vault door (39.5-40.5, 13), stand-in-front-of-vault (40, 14.6), corridor y=14-15 x=13-59,
 back office (24-52,17-21), manager office (54-59,17-21, card-locked door at (56.5,16.5)), loading dock (61-70, 8-21) with shutter to the back alley at (64-67,7),
 staff entrance (17-18,7) from the back alley, emergency exits (12,35-36) and (71,35-36). Back alley y=2-6 (van parks at (65.8,3.6)). Front street y=40-44.
${layoutText()}
`;
  if (side === 'crew') {
    return (
      common +
      `
YOU ARE THE CREW. Your crew start as pedestrians and look exactly like customers.
Turn 0 ONLY: choose the plan with {"t":"plan","breach":"drill|thermal|charge","escape":"van|fulton"}.
  breach: drill $${C.breach.drill.cost} (${C.breach.drill.time}s, jams randomly and must be restarted, vibration alarm pings the manager every ${C.breach.drill.noiseEvery}s),
          thermal $${C.breach.thermal.cost} (${C.breach.thermal.time}s, silent, cannot be stopped, glows), charge $${C.breach.charge.cost} (${C.breach.charge.time}s fuse, explosion triggers the alarm).
  escape: van $${C.escape.van.cost} (load bags at the van in the back alley, then "escape"; police roadblocks block the alley; the van can be shot while driving),
          fulton $${C.escape.fulton.cost} (ONLY on the north part of the Grand Hotel rooftop west of the bank (x1-8, y8-16), reached by fire escapes from the west alley at (9,9-10) and (9,14-15): attach a balloon to a carried bag (${C.escape.fulton.attachTime}s, inflates in ${C.escape.fulton.inflateTime}s), then {"t":"callPlane"}; the plane comes ONLY when called, passes over the rooftop ${C.escape.fulton.arriveTime}s later and takes every ready balloon (callable again ${C.escape.fulton.callCooldown}s after a pass). Nobody on the ground can shoot people or balloons on the rooftop (and vice versa): the police must climb the fire escapes. Not stopped by roadblocks. A robber on the rooftop can "extract" himself, carrying a bag or not, once secured + waiting balloons + his bag reach ${C.gold.quotaBags}; when the next called pass lifts him and the quota is secured = win).
  Budget $${C.gold.bags * C.gold.bagValue} minus the plan cost.
Detection rules during casing: the manager can call the police only if he (a) sees someone MASKED or in HEAVY armor (instant), or keeps someone standing in a STAFF-ONLY area in view for ${C.observe.privateGrace}s (a quick dash across a camera can go unnoticed), or
 (b) watches one person for ${C.observe.duration}s and sees suspicious behaviour for >= ${C.observe.requiredSuspicious}s (doing an action, carrying a money bag).
 The manager reacts immediately to anyone reportable on sight. Walking around like a customer is safe. Cameras you have spotted and the manager window are listed; your units show "WATCHED by ..." and "REPORTABLE-ON-SIGHT".
 Looped cameras (tamper) show nothing for ${C.actions.tamper.loop}s. A bribed guard ignores your crew and deserts when the alarm sounds.
After the alarm everyone is masked automatically. You can take civilians hostage. Releasing a hostage gives +1 negotiation card (freeze police ${C.negotiation.freeze}s) and +1 purchase ticket (during the assault, fortifications and heavy armor can only be bought with a ticket; medkits any time).
Fortifications are bought into stock (buyStock) before the assault and deployed any time near your crew (within 6 tiles, line of sight). Turret auto-fires; barricade blocks police movement (your crew can pass); trap explodes once on police.
Manager keycard: drill the card-locked manager office door with a small drill (buyStock drill, then act officedrill, ${C.breach.officeDrill.time}s, noisy), pick up the keycard, then act keycard at the vault (${C.breach.keycardTime}s) to open it regardless of the breach method.
Cameras see about ${C.vision.camera.range} tiles in a ${C.vision.camera.fov}° cone (walls block them, glass does not); guards and police see ${C.vision.unit} tiles all around.
Each crew member carries ONE gold bag at a time. Crew max ${C.crew.max} alive at a time (hire $${C.crew.hireCost}; you can replace fallen crew, but not after the police arrive). Carrying gold slows you.

COMMANDS (ids: your crew are numbers like 12; others use the names shown, e.g. "G1234" guard, "P5678" civilian):
 {"t":"move","ids":[12,13],"x":41,"y":30}
 {"t":"blend","ids":[12]}                      wander like a customer (casing only) until given another order
 {"t":"stop","ids":[12]}
 {"t":"auto","ids":[12,13],"mode":"intercept|attack|hostage|roam","on":true}   per-unit automation, acts only while the unit has no manual order:
        intercept = after the alarm, chase enemies seen within ${C.auto.interceptRange} tiles of its post, then walk back; attack = hunt the nearest enemy you can see;
        hostage = after the alarm, grab civilians within ${C.auto.hostageRange} tiles when empty-handed; roam = wander within ${C.auto.roamRadius} tiles of its post (same area only).
        The post is where the unit stood when switched on, and moves to wherever you send it with "move".
 {"t":"mask","ids":[12]}                       (casing) faster actions but instantly reportable
 {"t":"act","id":12,"kind":"tamper","target":CAM_ID}      loop a camera, $${C.actions.tamper.cost}, casing only, stand next to it
 {"t":"act","id":12,"kind":"bribe","target":"G1234"}      $${C.actions.bribe.cost}, casing only, unmasked
 {"t":"act","id":12,"kind":"lockpick","target":DOOR_ID}   ${C.actions.lockpick.time}s (security door ${C.actions.lockpick.securityTime}s); door stays open, manager gets a door alert
 {"t":"act","id":12,"kind":"c4","target":DOOR_ID}         $${C.actions.c4.cost}, blows the door, LOUD (alarm); not the reinforced manager office door
 {"t":"act","id":12,"kind":"install"}          the breach-tool holder installs the breach device at the vault door
 {"t":"act","id":12,"kind":"fix"}              restart a jammed drill
 {"t":"act","id":12,"kind":"officedrill","target":OFFICE_DOOR_ID}   needs drill stock
 {"t":"act","id":12,"kind":"pickup","target":BAG_ID}      gold bag (vault must be open), tool, or keycard; "target":"nearest" = closest free gold bag
 {"t":"act","id":12,"kind":"keycard"}          open the vault with the keycard
 {"t":"act","id":12,"kind":"deposit"}          put the carried bag into the van (stand within ${C.escape.van.loadRadius} tiles)
 {"t":"act","id":12,"kind":"fulton"}           on the hotel rooftop, send the carried bag up on a balloon
 {"t":"act","id":12,"kind":"extract"}          on the hotel rooftop, after the quota is secured: escape by balloon
 {"t":"callPlane"}                             fulton: call the pickup plane (arrives over the rooftop in ${C.escape.fulton.arriveTime}s)
 {"t":"act","id":12,"kind":"hostage","target":"P5678"}    after the alarm
 {"t":"act","id":12,"kind":"equip"}            heavy armor $${C.heavy.cost} (+${C.heavy.armor} armor, x${C.heavy.damageMul} damage, gas mask: tear gas x${C.heavy.gasMul}, slower; reportable on sight during casing)
 {"t":"act","id":12,"kind":"medkit"}           $${C.medkit.cost} heal ${C.medkit.heal} (can be bought any time, also during the assault)
 {"t":"attack","ids":[12],"target":"G1234"}   or {"t":"attack","ids":[12],"targetKind":"camera","target":CAM_ID} / "roadblock"
 {"t":"intel"}                                 casing only, $${C.actions.intel.cost}: a bribed cleaner hands you the security plan — every camera and motion sensor installed at that moment becomes known to you
 {"t":"hire"}  {"t":"buyStock","item":"turret|barricade|trap|drill"}  {"t":"deploy","item":"turret|barricade|trap","x":40,"y":15}
 {"t":"goLoud"}  {"t":"release"}  {"t":"negotiate"}  {"t":"escape"} (van: crew within ${C.escape.van.loadRadius} tiles board and drive off;
   the van also leaves AUTOMATICALLY the moment ${C.gold.quotaBags}+ bags are loaded and a crew member stands within ${C.escape.van.loadRadius} tiles)
Prices: turret $${C.fort.turret.cost}, barricade $${C.fort.barricade.cost}, trap $${C.fort.trap.cost}, drill $${C.breach.officeDrill.cost}.`
    );
  }
  return (
    common +
    `
YOU ARE THE BANK. During casing you are the branch manager; when the police arrive you command the police.
You see only through your cameras, your office window (while the manager sits in the office) and your guards. Robbers look exactly like customers.
Calling the police (ends casing): {"t":"report","target":"P1234"} works only for a person seen MASKED or in HEAVY armor, or kept in view inside a STAFF-ONLY area for ${C.observe.privateGrace}s.
 Otherwise observe: {"t":"observe","target":"P1234"} watches that person for ${C.observe.duration}s (he must stay in view). If he is seen doing something suspicious
 (an action, carrying a money bag) for >= ${C.observe.requiredSuspicious}s, the police are called. If not, you cannot observe for ${C.observe.failCooldown}s.
 {"t":"observeQueue","targets":["P1234","P5678"]} observes several people one after another during the turn.
 AUTO REPORT is ON by default: anyone who becomes reportable on sight (masked / heavy armor / staff-only area) while in your view is reported immediately.
 Alerts (door forced, drill vibration, motion sensor, keycard use) point at trouble but do not let you call the police by themselves.
Budget $${C.gold.bags * C.gold.bagValue} (same as the gold). Guards can be hired only before the alarm.
After the alarm guards fight; when the police arrive you get command points (CP, +${C.police.cpRegen}/s, max ${C.police.cpMax}) for police assets.

COMMANDS (your units are numbers like 7; people use their names "P1234"):
 {"t":"camera","x":45.4,"y":14.4,"dir":180}      $${C.bank.cameraCost}, any interior floor tile except restrooms; dir in degrees (0=E, 90=S, 180=W, 270=N); ${C.vision.camera.fov} deg cone, ${C.vision.camera.range} tiles
 {"t":"secdoor","slot":"gate"}                    $${C.bank.securityDoorCost}, casing only, door slots: ${L.doorSlots.filter((d) => d.securable).map((d) => d.id).join(', ')}
 {"t":"sensor","x":40.5,"y":14.5}                 $${C.bank.sensorCost}, staff-only areas, detects robbers within ${C.vision.sensorRadius} tiles
 {"t":"hire"}                                     guard $${C.guard.hireCost} (max ${C.guard.max}, before the alarm only)
 {"t":"reinforce"}                                vault door x${C.breach.reinforceMul} breach time, $${C.breach.reinforceCost}, casing only
 {"t":"move","ids":[7],"x":40,"y":15}   {"t":"patrol","ids":[7],"points":[{"x":28,"y":26},{"x":55,"y":26}]}   {"t":"stop","ids":[7]}
 {"t":"attack","ids":[7],"target":"P1234"}   {"t":"attack","ids":[7],"targetKind":"turret|barricade","target":ID}
 {"t":"auto","ids":[7,8],"mode":"intercept|attack|roam","on":true}   per-unit automation (acts only while the unit has no manual order):
        intercept = after the alarm, chase robbers seen within ${C.auto.interceptRange} tiles of its post, then walk back; attack = hunt the nearest robber you can see; roam = wander within ${C.auto.roamRadius} tiles of its post.
 {"t":"act","id":7,"kind":"repair","target":DOOR_ID}     guard re-locks a forced door
 {"t":"act","id":7,"kind":"sabotage"}                    stop a drill / defuse a charge at the vault (stand at (40,14.6))
 {"t":"act","id":7,"kind":"sabotage","target":OFFICE_DOOR_ID}   remove a drill from the manager office door
POLICE (assault phase; police orders sent during the response phase are queued and run the moment the police arrive): {"t":"swat","staging":"fw|fc|fe|aw|ae","x":60,"y":12} ${C.swat.cost}CP (optional x,y: where the officer walks after arriving) (max ${C.swat.maxActive} at once; fw/fc/fe front street west/center/east, aw/ae back alley west/east)
 {"t":"sniper","spot":"sw|se|w|e|fw|fc|fe"} ${C.sniper.cost}CP (max ${C.sniper.maxActive}; sw/se cover the back alley, w/e the side halls through windows, fw/fc/fe the front facade)
 {"t":"roadblock","slot":"aw|ae|fw|fe"} ${C.roadblock.cost}CP (aw/ae block the back alley where a getaway van would drive)
 {"t":"gas","x":40,"y":15} ${C.gas.cost}CP tear gas   {"t":"act","id":SWAT_ID,"kind":"wallbreach","x":12,"y":14} ${C.wallBreach.cost}CP blow a 2-tile hole in a bank wall (stand next to it)
Suggested wall breach points: (12,14) west wall into the corridor, (30,7) back wall into the deposit room, (71,14) east wall into the loading dock, (12,30) west hall.
The crew escapes either with a van in the back alley (roadblocks aw/ae stop it; it can be shot while driving) or with FULTON balloons:
 bags (and finally a robber) are tied to balloons ON THE GRAND HOTEL ROOFTOP west of the bank (fire escapes from the west alley at (9,9-10) and (9,14-15)),
 and a small plane the crew calls passes over the rooftop ${C.escape.fulton.arriveTime}s after the call and snatches ready balloons. You get a warning ${C.escape.fulton.warnAt}s before it arrives.
 Nobody on the ground can shoot robbers or balloons (${C.escape.fulton.balloonHp} hp) on the rooftop, and they cannot shoot down at you either: send SWAT up the fire escapes to fight there.
An explosion while the police are on their way makes them arrive sooner (at most ${C.phase.blastResponse}s left).`
  );
}

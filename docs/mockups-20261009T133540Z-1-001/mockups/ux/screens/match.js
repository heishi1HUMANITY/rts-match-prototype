// 試合HUD(S05)と研究画面(S05a)。盤面はプレースホルダ図、時間とチケットは疑似的に進む
(function () {
  const { CIVS } = D;

  // ───────── 試合の状態(研究画面との行き来で失われないよう UX.state に置く) ─────────
  const NODE_TYPES = { hq: "首都", power: "発電所", hub: "物流ハブ", sub: "変電所", gate: "中央水門", npc: "現地勢力の本拠" };
  function initMatch() {
    return {
      t: 14 * 60 + 32, phase: "MID", late: false,
      tickets: { a: 820, b: 714, c: 552 },
      supply: 1284, rp: 62,
      off: [0, 0],
      nodes: [
        { id: "hq", x: 330, y: 300, owner: "a", guard: 0, lv: 2, big: true },
        { id: "power", x: 470, y: 200, owner: "a", guard: 0, lv: 1 },
        { id: "hub", x: 640, y: 170, owner: null, guard: 3, lv: 1 },
        { id: "sub", x: 720, y: 300, owner: "b", guard: 1, lv: 1 },
        { id: "npc", x: 280, y: 140, owner: "npc", guard: 4, lv: 1 },
      ],
      squads: [
        { no: "01", type: "強襲", full: "装甲強襲", pos: [420, 228], hp: 86, rank: 2, exp: 62, stance: "atk", state: "ready" },
        { no: "02", type: "砲", full: "自走砲", pos: [440, 266], hp: 44, rank: 1, exp: 30, stance: "hold", state: "ready" },
        { no: "03", type: "偵察", full: "偵察", pos: [380, 270], hp: 100, rank: 0, exp: 12, stance: "retreat", state: "ready" },
      ],
      enemies: [
        { id: "e1", team: "b", type: "装甲強襲", pos: [670, 250], hp: 72 },
        { id: "e2", team: "npc", type: "現地勢力 偵察", pos: [300, 190], hp: 50 },
      ],
      sel: 0, dest: null, rally: null,
      orderCd: 0, orderMode: null, signalMode: null,
      addonCd: { forward: 0, armor: 0 }, addonUsed: {},
      research: { done: ["fire", "supply1"], doing: { id: "siege", p: 58 }, queue: ["aa"] },
      signalShown: false, log: [],
    };
  }
  const M = () => (UX.state.match ??= initMatch());
  UX.newMatch = () => { UX.state.match = initMatch(); };
  const nodeName = (n) => NODE_TYPES[n.id] ?? n.id;
  const TEAMC = { a: "var(--team-a)", b: "var(--team-b)", c: "var(--team-c)", npc: "var(--npc)" };
  const STANCE = { atk: ["▲", "攻勢", "見つけた敵を追う"], hold: ["■", "保持", "その場を守る"], retreat: ["◀", "退避", "交戦を避ける"] };
  const RANKS = ["新兵", "熟練", "精鋭", "古参"];
  const devPos = (e) => { const r = document.getElementById("device").getBoundingClientRect(); const s = r.width / 900; return [(e.clientX - r.left) / s, (e.clientY - r.top) / s]; };
  const civ = () => CIVS[UX.state.civ] ?? CIVS.pmc;

  // ───────── CSS ─────────
  UX.css(`
  [data-screen=match] .mx-board, [data-screen=tutorial] .mx-board { position: absolute; inset: 0; overflow: hidden; touch-action: none; }
  .mx-world { position: absolute; inset: 0; transition: transform .45s cubic-bezier(.2,.8,.2,1); }
  .mx-world .board-ph { inset: -120px; }
  .mx-node { position: absolute; transform: translate(-50%, -50%); width: 26px; height: 26px; border: 1.5px solid var(--tc, var(--ink-2)); background: rgba(255,255,255,.88); cursor: pointer; }
  .mx-node.big { width: 38px; height: 38px; }
  .mx-node::after { content: ""; position: absolute; inset: 4px; background: var(--tc, var(--faint)); opacity: .38; }
  .mx-node.neutral { border-style: dashed; }
  .mx-node.capturing { animation: mx-blink .5s steps(2) infinite; }
  @keyframes mx-blink { 50% { border-color: var(--team-a); } }
  .mx-nl { position: absolute; transform: translate(-50%, 0); white-space: nowrap; font-size: 8.5px; font-weight: 700; padding: 1px 5px; background: rgba(255,255,255,.92); border-left: 2px solid var(--tc, var(--ink)); pointer-events: none; }
  .mx-tok { position: absolute; width: 16px; height: 16px; margin: -8px 0 0 -8px; transform: rotate(45deg); background: var(--tc); border: 2px solid #fff; box-shadow: 0 0 0 1px var(--tc), 0 0 12px var(--tc); cursor: pointer; transition-property: left, top; transition-timing-function: linear; }
  .mx-tok.mine { box-shadow: 0 0 0 1px var(--ink), 0 0 0 4px rgba(255,255,255,.8), 0 0 14px var(--tc); }
  .mx-tok.sel { outline: 2px solid var(--ink); outline-offset: 6px; }
  .mx-tl { position: absolute; transform: translate(-50%, 10px); font-family: var(--f-mono); font-size: 8px; font-weight: 700; white-space: nowrap; pointer-events: none; transition-property: left, top; transition-timing-function: linear; }
  .mx-path { position: absolute; height: 0; border-top: 1.5px dashed var(--ink); transform-origin: 0 0; pointer-events: none; }
  .mx-path.bad { border-color: var(--danger); }
  .mx-dest { position: absolute; width: 26px; height: 26px; margin: -13px 0 0 -13px; border: 1.5px solid var(--ink); border-radius: 50%; pointer-events: none; animation: mx-ping 1.2s ease-out infinite; }
  .mx-dest::before, .mx-dest::after { content: ""; position: absolute; left: 50%; top: 50%; background: var(--ink); transform: translate(-50%,-50%); }
  .mx-dest::before { width: 10px; height: 1.5px; } .mx-dest::after { width: 1.5px; height: 10px; }
  @keyframes mx-ping { 0% { box-shadow: 0 0 0 0 rgba(14,22,30,.25); } 100% { box-shadow: 0 0 0 14px rgba(14,22,30,0); } }
  .mx-mark { position: absolute; transform: translate(-50%, -50%); pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 2px; animation: mx-mark-in .3s ease; }
  .mx-mark i { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--c); box-shadow: 0 0 0 6px color-mix(in srgb, var(--c) 20%, transparent); }
  .mx-mark span { font-size: 8.5px; font-weight: 700; color: #fff; background: var(--c); padding: 1px 6px; }
  @keyframes mx-mark-in { from { transform: translate(-50%, -50%) scale(1.6); opacity: 0; } }
  .mx-strike { position: absolute; width: 90px; height: 90px; margin: -45px 0 0 -45px; border-radius: 50%; border: 2px solid var(--danger); background: rgba(226,51,79,.08); pointer-events: none; display: grid; place-items: center; font-size: 9px; font-weight: 700; color: var(--danger); animation: mx-mark-in .3s ease; }
  [data-screen=research] .mx-menu { display: none; }
  [data-screen=match] .caseno, [data-screen=tutorial] .caseno, [data-screen=research] .caseno { pointer-events: auto; cursor: pointer; display: flex; gap: 4px; z-index: 6; }
  .mx-menu { width: 24px; height: 21px; display: grid; place-items: center; background: var(--ink); color: #fff; font-size: 11px; }
  [data-screen=match] .minimap { cursor: pointer; }
  [data-screen=match] .squad, [data-screen=tutorial] .squad { touch-action: none; user-select: none; -webkit-user-select: none; }
  [data-screen=match] .squad.dragging { opacity: .4; }
  .squad .rk { color: var(--gold); }
  .mx-ghost { position: absolute; z-index: 30; width: 76px; height: 32px; padding: 4px 6px 3px 9px; background: rgba(255,255,255,.95); box-shadow: 0 0 0 2px var(--ink), 0 10px 20px -8px rgba(0,0,0,.4); transform: translate(-50%, -120%) rotate(-4deg); pointer-events: none; font-family: var(--f-display); font-weight: 700; font-size: 12px; }
  .mx-ghost::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--team-a); }
  .mx-fc { position: absolute; z-index: 31; width: 200px; background: rgba(14,22,30,.94); color: #fff; clip-path: var(--cut-sm); pointer-events: none; transform: translate(-50%, calc(-100% - 22px)); }
  .mx-fc .v { display: flex; align-items: center; gap: 8px; padding: 7px 10px 6px; border-left: 3px solid var(--ok); }
  .mx-fc .v b { font-size: 12px; color: #4be3a8; }
  .mx-fc.lose .v { border-left-color: var(--danger); } .mx-fc.lose .v b { color: #ff7b8e; }
  .mx-fc .v .n { font-family: var(--f-display); font-size: 16px; font-weight: 700; margin-left: auto; }
  .mx-fc .vs { display: grid; grid-template-columns: 1fr auto 1fr; gap: 6px; padding: 6px 10px 8px; border-top: 1px solid rgba(255,255,255,.12); font-size: 9px; color: rgba(255,255,255,.75); }
  .mx-cutin { position: absolute; z-index: 21; left: 214px; top: 98px; width: 296px; height: 64px; display: grid; grid-template-columns: 112px 1fr; background: var(--ink); color: #fff; clip-path: polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%); box-shadow: 0 12px 30px -12px rgba(0,0,0,.6); pointer-events: none; animation: mx-cut 1.9s cubic-bezier(.2,.8,.2,1) forwards; }
  .mx-cutin::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 2px; background: var(--team-a); z-index: 2; }
  .mx-cutin .ph { border: 0; margin-left: 6px; }
  .mx-cutin .ph > * { background: rgba(14,22,30,.8); color: #c3ccd4; }
  .mx-cutin .tx { padding: 7px 18px 0 10px; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .mx-cutin .k { font-family: var(--f-mono); font-size: 7.5px; letter-spacing: .2em; color: var(--team-a); }
  .mx-cutin .b { font-family: var(--f-display); font-weight: 700; font-size: 17px; line-height: 1.1; white-space: nowrap; }
  .mx-cutin .l { font-size: 9px; color: rgba(255,255,255,.75); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mx-cutin .life { position: absolute; left: 118px; right: 14px; bottom: 0; height: 2px; background: var(--team-a); transform-origin: 0 0; animation: mx-life 1.8s linear forwards; }
  @keyframes mx-cut { 0% { transform: translateX(-30px); opacity: 0; } 12% { transform: none; opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0; transform: translateX(10px); } }
  @keyframes mx-life { to { transform: scaleX(0); } }
  .mx-warn { position: absolute; z-index: 25; left: 50%; top: 63%; width: 430px; transform: translate(-50%, -50%); background: rgba(14,22,30,.94); color: #fff; pointer-events: none; animation: mx-warn 4.2s ease forwards; }
  .mx-warn::before, .mx-warn::after { content: ""; display: block; height: 8px; background: repeating-linear-gradient(135deg, var(--crayon) 0 8px, transparent 8px 16px); }
  .mx-warn .in { padding: 10px 18px; display: flex; align-items: center; gap: 14px; }
  .mx-warn .big { font-family: var(--f-display); font-weight: 700; font-size: 34px; letter-spacing: -.02em; line-height: 1; }
  @keyframes mx-warn { 0% { opacity: 0; transform: translate(-50%, -50%) scaleY(.2); } 8% { opacity: 1; transform: translate(-50%, -50%); } 85% { opacity: 1; } 100% { opacity: 0; } }
  .mx-erosion { position: absolute; inset: 0; z-index: 7; pointer-events: none; }
  .mx-erosion path { fill: none; stroke: var(--crayon); stroke-linecap: round; filter: url(#crayon-rough); opacity: .85; stroke-dasharray: 1600; stroke-dashoffset: 1600; animation: mx-draw 2.4s ease forwards; }
  @keyframes mx-draw { to { stroke-dashoffset: 0; } }
  [data-screen=match].late .timer { background: var(--crayon); }
  .mx-dev { position: absolute; left: 50%; bottom: 2px; transform: translateX(-50%); z-index: 8; display: flex; gap: 3px; opacity: .55; }
  .mx-dev:hover { opacity: 1; }
  .mx-dev button { height: 15px; padding: 0 6px; font-family: var(--f-mono); font-size: 7.5px; letter-spacing: .1em; background: rgba(14,22,30,.75); color: #fff; }
  .mx-order { cursor: pointer; }
  .mx-order.cd .o-state { color: var(--warn); }
  .mx-order.armed { outline: 2px solid var(--crayon); }
  .addon.armed { box-shadow: 0 0 0 2px var(--crayon); }
  .sig.on { background: var(--ink); color: #fff; }
  /* ポップ(#dialogs 側に出るので固有の接頭辞で書く) */
  .mx-pop { width: 220px; background: var(--surface-solid); box-shadow: 0 18px 40px -16px rgba(14,22,30,.45), 0 0 0 1px var(--line); }
  .mx-pop .hd { display: flex; gap: 8px; align-items: center; padding: 8px 10px 6px; border-bottom: 1px solid var(--line); }
  .mx-pop .bd { padding: 8px 10px; }
  .mx-pop .kv { display: flex; justify-content: space-between; font-size: 9.5px; padding: 2px 0; }
  .mx-pop .kv b { font-family: var(--f-mono); font-weight: 500; }
  .mx-pop .acts { display: flex; gap: 4px; padding: 0 10px 10px; }
  .mx-pop .acts .btn { flex: 1; }
  .mx-pop .st3 { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin: 6px 0; }
  .mx-pop .st3 div { padding: 2px 0; text-align: center; border-right: 1px solid var(--line); font-size: 8.5px; }
  .mx-pop .st3 div:last-child { border-right: 0; }
  .mx-pop .st3 .num { font-size: 13px; display: block; line-height: 1.2; }
  .mx-stance { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 0 10px 10px; }
  .mx-stance button { height: 32px; border: 1px solid var(--line-2); display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1; font-size: 10px; font-weight: 700; }
  .mx-stance button span { font-size: 7.5px; font-weight: 400; color: var(--dim); }
  .mx-stance button.on { background: var(--ink); color: #fff; border-color: var(--ink); }
  .mx-stance button.on span { color: rgba(255,255,255,.6); }
  .mx-target { width: 200px; }
  .mx-target .row { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-top: 1px solid var(--line); font-size: 10.5px; width: 100%; text-align: left; }
  .mx-target .row:hover { background: var(--surface-sunk); }
  .mx-target .row.dis { opacity: .4; pointer-events: none; }
  .mx-recv { width: 330px; background: var(--surface-solid); box-shadow: 0 18px 40px -16px rgba(14,22,30,.45), 0 0 0 1px var(--line); }
  .mx-recv .hd { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-left: 4px solid var(--team-b); }
  .mx-recv .ops { display: grid; grid-template-columns: 1.2fr 1fr .8fr; gap: 4px; padding: 0 10px 8px; }
  .mx-recv .ops .btn { height: 28px; }
  .mx-recv .to { height: 2px; background: var(--team-b); transform-origin: 0 0; animation: mx-life 8s linear forwards; }
  .mx-base { width: 520px; height: 236px; display: flex; flex-direction: column; background: var(--surface-solid); box-shadow: 0 18px 40px -16px rgba(14,22,30,.45), 0 0 0 1px var(--line); }
  .mx-base .head { display: flex; align-items: center; gap: 10px; padding: 6px 10px 0; border-bottom: 1px solid var(--line); }
  .mx-base .body { flex: 1; display: grid; grid-template-columns: minmax(0,1fr) 150px; gap: 10px; padding: 8px 10px; min-height: 0; }
  .mx-base .units { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; align-content: start; }
  .mx-base .u { position: relative; height: 62px; padding: 5px 7px; border: 1px solid var(--line); text-align: left; display: flex; flex-direction: column; }
  .mx-base .u:hover { box-shadow: 0 0 0 1.5px var(--ink); }
  .mx-base .u b { font-size: 10px; }
  .mx-base .u .meta { margin-top: auto; display: flex; justify-content: space-between; font-family: var(--f-mono); font-size: 8px; color: var(--dim); }
  .mx-base .u .cost { font-family: var(--f-display); font-weight: 700; font-size: 11px; color: var(--ink); }
  .mx-base .u.locked { opacity: .45; background: repeating-linear-gradient(135deg, #fff 0 5px, var(--surface-sunk) 5px 10px); }
  .mx-base .q { display: flex; gap: 6px; align-items: center; padding: 5px 6px; border: 1px solid var(--line); font-size: 9.5px; margin-bottom: 4px; }
  .mx-base .q .bar { flex: 1; }
  .mx-base .q .bar > i { background: var(--signal); transition: width 1s linear; }
  `);

  // ───────── HUD の描画(チュートリアルでも使う) ─────────
  function hudTop(m) {
    const c = civ();
    const order = Object.entries(m.tickets).sort((x, y) => y[1] - x[1]).map((x) => x[0]);
    const tk = (k, label) => `<div class="ticket t-${k} ${k === "a" ? "me" : ""}"><div class="row"><span class="sym ${D.TEAMS[k].sym}"></span><span class="civ">${D.TEAMS[k].key} · ${label}</span><span class="rank">#${order.indexOf(k) + 1}</span></div><div class="row"><div class="bar" style="flex:1"><i style="width:${m.tickets[k] / 10}%"></i></div><span class="val" data-tk="${k}">${Math.round(m.tickets[k])}</span></div></div>`;
    return `<div class="caseno"><button class="mx-menu" data-act="menu">≡</button><span class="docno">CASE NO: DR-09F9DB4F</span></div>
      <div class="hud-top"><div class="tickets">${tk("a", c.short)}${tk("b", "CORP")}${tk("c", m.late ? "SOC" : "???")}</div>
      <div class="timer"><span class="ph-name">${m.phase}</span><span class="t">${D.mmss(m.t)}</span></div></div>`;
  }
  function boardHTML(m) {
    const nodes = m.nodes.map((n) => { const tc = n.owner ? TEAMC[n.owner] : ""; return `<div class="mx-node ${n.big ? "big" : ""} ${n.owner ? "" : "neutral"}" data-node="${n.id}" style="left:${n.x}px;top:${n.y}px;${tc ? `--tc:${tc}` : ""}"></div><div class="mx-nl" data-nl="${n.id}" style="left:${n.x}px;top:${n.y + (n.big ? 22 : 16)}px;${tc ? `--tc:${tc}` : ""}">${nodeName(n)}${n.id === "hq" ? ` Lv${n.lv}` : n.guard ? ` · 守備 ${n.guard}` : ""}</div>`; }).join("");
    const toks = m.squads.filter((s) => s.state !== "training").map((s, i) => `<div class="mx-tok mine t-a ${m.sel === i ? "sel" : ""}" data-tok="${i}" style="left:${s.pos[0]}px;top:${s.pos[1]}px"></div><div class="mx-tl" data-tl="${i}" style="left:${s.pos[0]}px;top:${s.pos[1]}px">${s.no} ${s.type[0]}</div>`).join("");
    const ens = m.enemies.map((e) => `<div class="mx-tok t-${e.team}" data-en="${e.id}" style="left:${e.pos[0]}px;top:${e.pos[1]}px"></div>`).join("");
    const dest = m.dest ? `<div class="mx-dest" style="left:${m.dest[0]}px;top:${m.dest[1]}px"></div>` : "";
    return `<div class="mx-world" style="transform:translate(${m.off[0]}px,${m.off[1]}px)">
      <div class="board-ph">
        <div class="river" style="left:-40px;right:-40px;top:370px;height:26px;transform:rotate(-8deg)"></div>
        <div class="river" style="left:680px;width:22px;top:100px;height:300px;transform:rotate(18deg)"></div>
        <div class="fog" style="right:0;top:0;width:380px;height:270px;clip-path:polygon(30% 0,100% 0,100% 100%,0 70%)"></div>
      </div>
      <div class="mx-paths"></div>${nodes}${ens}${toks}<div class="mx-marks"></div>${dest}
    </div>`;
  }
  function minimapHTML(m) {
    const p = (x, y) => `left:${(x + 120) / 1140 * 100}%;top:${(y + 120) / 660 * 100}%`;
    return `<div class="mm">
      <i style="left:0;right:0;top:72%;height:5px;background:rgba(16,191,232,.5);transform:rotate(-8deg)"></i>
      ${m.nodes.map((n) => `<i style="${p(n.x, n.y)};width:${n.big ? 8 : 6}px;height:${n.big ? 8 : 6}px;background:${n.owner ? TEAMC[n.owner] : "transparent"};${n.owner ? "" : "border:1px dashed var(--ink-2);"}transform:translate(-50%,-50%)"></i>`).join("")}
      ${m.squads.filter((s) => s.state !== "training").map((s) => `<i style="${p(s.pos[0], s.pos[1])};width:4px;height:4px;background:var(--team-a);outline:1px solid #fff"></i>`).join("")}
      <i class="mm-view" style="left:${(120 - m.off[0]) / 1140 * 100}%;top:${(120 - m.off[1]) / 660 * 100}%;width:${900 / 1140 * 100}%;height:${420 / 660 * 100}%;border:1px solid var(--ink);transition:all .45s"></i>
    </div>`;
  }
  function squadsHTML(m) {
    const cells = [];
    for (let i = 0; i < 6; i++) {
      const s = m.squads[i];
      if (!s) { cells.push(i === m.squads.length ? `<button class="squad empty" data-act="base">＋ 生産</button>` : `<button class="squad empty">—</button>`); continue; }
      if (s.state === "training") { cells.push(`<button class="squad t-a training" data-sq="${i}"><span class="no">${s.no}</span><span class="ty">${s.type} 生産中</span><div class="bar"><i style="width:${s.prog}%;background:var(--ink)"></i></div></button>`); continue; }
      cells.push(`<button class="squad t-a ${m.sel === i ? "sel" : ""} ${s.state === "fight" ? "fight" : ""}" data-sq="${i}"><span class="no">${s.no}</span><span class="ty">${s.type}</span><span class="rk">${"❯".repeat(s.rank)}</span><span class="st">${STANCE[s.stance][0]}</span><div class="bar"><i style="width:${s.hp}%;${s.hp < 50 ? "background:var(--warn)" : ""}"></i></div></button>`);
    }
    return cells.join("");
  }
  function addonsHTML(m) {
    return UX.state.addons.concat([null, null, null, null]).slice(0, 4).map((id, i) => {
      if (!id) return `<button class="addon" style="opacity:.4"><span class="k">${"①②③④"[i]}</span><b>—</b><span class="s dim">空き</span></button>`;
      const a = D.addon(id), cd = m.addonCd[id] || 0, used = m.addonUsed[id];
      const st = used ? "使用済" : cd > 0 ? `CD ${D.mmss(cd)}` : a.kind === "cons" ? "使い切り" : id === "forward" || id === "armor" || id === "optics" ? "常時" : "発動";
      return `<button class="addon ${a.kind === "cons" ? "consumable" : ""} ${used ? "used" : ""} ${cd > 0 ? "cd" : ""}" data-addon="${id}"><span class="k">${"①②③④"[i]}</span><b>${a.name}</b><span class="s" style="color:${used ? "var(--dim)" : cd > 0 ? "var(--dim)" : a.kind === "cons" ? "var(--crayon)" : "var(--ok)"}">${st}</span></button>`;
    }).join("");
  }
  function hudHTML(m, opts = {}) {
    const c = civ();
    return `<div class="screen ${m.late ? "late" : ""}">
      <div class="mx-board">${boardHTML(m)}</div>
      ${hudTop(m)}
      <div class="npc-strip">現地勢力 ×1.4 · 拠点3 · 部隊5</div>
      <div class="panel minimap marks" data-act="minimap">${minimapHTML(m)}</div>
      <section class="panel comm marks">
        <div class="frame"><div class="portrait">${D.ph("BUST", "", "tinted", `--tc:${c.c}`)}<div class="live"><i style="height:4px"></i><i style="height:9px"></i><i style="height:6px"></i><i style="height:10px"></i></div></div>
          <div><div class="who"><span>${c.leader}</span><span class="tag" style="height:14px">${c.short}</span></div><div class="eyebrow" style="margin-top:2px">RADIO · CH-A</div><p class="sub" data-sub>発電所を押さえた。次は物流ハブだ、守備は3。部隊チップを拠点までドラッグしろ。</p></div></div>
        <div class="order mx-order" data-act="order"><div class="o-main"><span class="eyebrow" style="color:rgba(255,255,255,.5)">LEADER ORDER</span><b>作戦指令: ${c.order}</b></div><div class="o-state" data-ost>READY</div></div>
      </section>
      <section class="left-bottom">
        <div class="panel res"><div><div class="eyebrow">SUPPLY</div><div class="v" data-supply>${Math.round(m.supply).toLocaleString()}</div><div class="d"><span style="color:var(--ok)">+14</span> <span style="color:var(--danger)">−6</span>/s</div></div><div><div class="eyebrow">RESEARCH</div><div class="v" data-rp>${Math.floor(m.rp)}</div><div class="d dim">+1.2/s</div></div></div>
        <div class="cmd-row"><button class="btn" data-act="research">RESEARCH</button><button class="btn light" data-act="base">BASE</button></div>
        <div class="signals"><span class="lbl">味方</span><button class="sig" data-ally="攻撃">攻</button><button class="sig" data-ally="防衛">守</button><button class="sig" data-ally="撤退">退</button>
          <span class="lbl" style="margin-left:4px">他</span><button class="sig other" data-other="共闘" style="box-shadow:inset 0 -2px 0 var(--ok)">共闘</button><button class="sig other" data-other="休戦" style="box-shadow:inset 0 -2px 0 var(--signal)">休戦</button><button class="sig other" data-other="手を引け" style="flex:1.5;box-shadow:inset 0 -2px 0 var(--danger)">手を引け</button></div>
      </section>
      <section class="right-bottom"><div class="squads">${squadsHTML(m)}</div><div class="addons">${addonsHTML(m)}</div></section>
      ${m.late ? erosionSVG() : ""}
      ${opts.dev === false ? "" : `<div class="mx-dev"><span class="mono" style="font-size:7px;color:var(--dim);align-self:center">DEV</span><button data-act="late">終盤へ</button><button data-act="capture">制圧演出</button><button data-act="end">試合終了</button></div>`}
    </div>`;
  }
  const erosionSVG = () => `<svg class="mx-erosion" viewBox="0 0 900 420" preserveAspectRatio="none"><path d="M0 40 C 60 10, 140 70, 210 30 S 300 60, 330 20" stroke-width="3"/><path d="M760 110 C 800 140, 850 90, 900 130" stroke-width="3"/><path d="M780 10 L 880 110 M 880 10 L 780 110" stroke-width="2.5"/><path d="M0 330 C 50 300, 90 360, 140 320" stroke-width="3"/><path d="M500 410 C 600 380, 700 420, 900 380" stroke-width="2.5"/></svg>`;
  window.MX = { initMatch, hudHTML, M };

  // ───────── 試合HUD ─────────
  UX.screen("match", {
    title: "S05 試合HUD", group: "試合", transition: "dive",
    render: () => hudHTML(M()),
    mount(el) {
      const m = M();
      const scr = () => el.querySelector(".screen");
      const world = () => el.querySelector(".mx-world");
      if (m.late) scr().classList.add("late");
      const say = (t) => { const s = el.querySelector("[data-sub]"); if (s) { s.textContent = t; s.animate([{ opacity: 0 }, { opacity: 1 }], 300); } };
      const redrawSquads = () => { el.querySelector(".squads").innerHTML = squadsHTML(m); bindChips(); };
      const redrawAddons = () => { el.querySelector(".addons").innerHTML = addonsHTML(m); };
      const redrawBoard = () => { el.querySelector(".mx-board").innerHTML = boardHTML(m); el.querySelector(".minimap").innerHTML = minimapHTML(m); };
      const redrawTop = () => { const old = el.querySelector(".hud-top"); const tmp = UX.h(`<div>${hudTop(m)}</div>`); old.replaceWith(tmp.querySelector(".hud-top")); };
      const clearHint = () => { el.querySelector(".ux-hint")?.remove(); };
      const hint = (text, cls = "") => { clearHint(); scr().insertAdjacentHTML("beforeend", `<div class="ux-hint ${cls}">${text}</div>`); };

      // 時間・資源・研究・CD の進行
      UX.every(1000, () => {
        m.t = Math.max(0, m.t - 1);
        m.tickets.a -= 0.3; m.tickets.b -= 0.6 + (m.late ? 0.6 : 0); m.tickets.c -= 0.5 + (m.late ? 0.4 : 0);
        m.supply += 8; m.rp += 1.2;
        tickResearch(m);
        el.querySelector(".timer .t").textContent = D.mmss(m.t);
        for (const k of ["a", "b", "c"]) { const v = el.querySelector(`[data-tk=${k}]`); if (v) { v.textContent = Math.round(m.tickets[k]); v.closest(".ticket").querySelector(".bar i").style.width = m.tickets[k] / 10 + "%"; } }
        el.querySelector("[data-supply]").textContent = Math.round(m.supply).toLocaleString();
        el.querySelector("[data-rp]").textContent = Math.floor(m.rp);
        if (m.orderCd > 0) { m.orderCd--; const o = el.querySelector("[data-ost]"); o.textContent = m.orderCd ? D.mmss(m.orderCd) : "READY"; el.querySelector(".mx-order").classList.toggle("cd", m.orderCd > 0); }
        let addonChange = false;
        for (const k in m.addonCd) if (m.addonCd[k] > 0) { m.addonCd[k]--; addonChange = true; }
        if (addonChange) redrawAddons();
        let sqChange = false;
        for (const s of m.squads) if (s.state === "training") { s.prog += 17; sqChange = true; if (s.prog >= 100) { s.state = "ready"; s.prog = 100; UX.toast(`${s.no} ${s.full} 完成`, "ok"); say(`${s.full}が上がった。チップから盤面へドラッグして使え。`); redrawBoard(); } }
        if (sqChange) redrawSquads();
      });
      if (m.orderCd > 0) el.querySelector(".mx-order").classList.add("cd");

      // 他チームからの合図(D32)
      if (!m.signalShown) UX.after(12000, () => {
        m.signalShown = true;
        UX.dialog(`<div class="mx-recv"><div class="hd">${D.ph("PT", "", "tinted", "--tc:var(--team-b);width:34px;height:34px;flex:none")}<div style="flex:1"><div class="eyebrow">SIGNAL · TEAM B · CORP</div><div style="font-size:15px;font-weight:900">「共闘しよう」</div><div class="tiny dim">対象: TEAM C(首位を削る)</div></div></div>
          <div class="ops"><button class="btn sm" data-r="共闘に応じた">共闘しよう</button><button class="btn sm light" data-r="休戦を返した">休戦</button><button class="btn sm ghost" data-r="無視した">無視</button></div><div class="to"></div></div>`,
          { kind: "pop", x: 450, y: 92, anchor: "below", dismiss: false, auto: 8000, mount: (b, d) => b.querySelectorAll("[data-r]").forEach((x) => x.addEventListener("click", () => { UX.toast(`TEAM B: ${x.dataset.r}`, "signal"); d.close(); })) });
      });

      // ── 盤面のタップ ──
      const hitNode = (p) => m.nodes.find((n) => Math.hypot(n.x - p[0], n.y - p[1]) < (n.big ? 26 : 20));
      const hitEnemy = (p) => m.enemies.find((e) => Math.hypot(e.pos[0] - p[0], e.pos[1] - p[1]) < 16);
      const boardPos = (e) => { const p = devPos(e); return [p[0] - m.off[0], p[1] - m.off[1]]; };
      const screenOf = (x, y) => [x + m.off[0], y + m.off[1]];
      el.querySelector(".mx-board").addEventListener("click", (e) => {
        const p = boardPos(e);
        if (m.orderMode) { fireOrder(p); return; }
        if (m.signalMode) { placeSignal(p); return; }
        const tok = e.target.closest("[data-tok]");
        if (tok) { const i = +tok.dataset.tok; if (m.sel === i) openSquadPop(i); else select(i); return; }
        const n = hitNode(p); if (n) return openNodePop(n);
        const en = hitEnemy(p); if (en) return openEnemyPop(en);
        setDest(p);
      });
      function setDest(p) {
        m.dest = p;
        el.querySelector(".mx-dest")?.remove();
        world().insertAdjacentHTML("beforeend", `<div class="mx-dest" style="left:${p[0]}px;top:${p[1]}px"></div>`);
        hint("目的地: 部隊チップをタップするとここへ向かう", "ink");
        clearTimeout(m._destT); m._destT = UX.after(8000, () => { m.dest = null; el.querySelector(".mx-dest")?.remove(); clearHint(); });
      }
      function select(i) { m.sel = i; for (const t of el.querySelectorAll("[data-tok]")) t.classList.toggle("sel", +t.dataset.tok === i); for (const c of el.querySelectorAll("[data-sq]")) c.classList.toggle("sel", +c.dataset.sq === i); }

      // 移動(経路線 → トークンが進む → 着いた拠点が敵/中立なら交戦 → 制圧)
      function moveSquad(i, to, node) {
        const s = m.squads[i]; if (!s || s.state === "training") return;
        const from = [...s.pos], dist = Math.hypot(to[0] - from[0], to[1] - from[1]), dur = Math.max(0.6, dist / 70);
        const pathEl = UX.h(`<div class="mx-path" style="left:${from[0]}px;top:${from[1]}px;width:${dist}px;transform:rotate(${Math.atan2(to[1] - from[1], to[0] - from[0])}rad)"></div>`);
        el.querySelector(".mx-paths").appendChild(pathEl);
        const tok = el.querySelector(`[data-tok="${i}"]`), tl = el.querySelector(`[data-tl="${i}"]`);
        for (const x of [tok, tl]) if (x) { x.style.transitionDuration = dur + "s"; x.style.left = to[0] + "px"; x.style.top = to[1] + "px"; }
        s.pos = to; m.dest = null; el.querySelector(".mx-dest")?.remove(); clearHint();
        UX.toast(`${s.no} ${s.full} → ${node ? nodeName(node) : "指定地点"}`);
        UX.after(dur * 1000, () => {
          pathEl.remove();
          if (node && node.owner !== "a") {
            s.state = "fight"; redrawSquads();
            el.querySelector(`[data-node="${node.id}"]`)?.classList.add("capturing");
            say(`${nodeName(node)}で交戦中。守備を削っている。`);
            UX.after(2600, () => { s.state = "ready"; s.exp = Math.min(100, s.exp + 30); capture(node); });
          }
          el.querySelector(".minimap").innerHTML = minimapHTML(m);
        });
      }
      function capture(node) {
        node.owner = "a"; node.guard = 0;
        m.tickets.b -= 20; m.tickets.c -= 10;
        redrawBoard(); redrawSquads();
        cutin(`BASE CAPTURED · TEAM ${D.TEAMS.a.key}`, `${nodeName(node)} 制圧`, `${civ().leader}「ここは貰った。次の線へ進む。」`);
        say(`${nodeName(node)}を取った。補給が増える。`);
      }
      function cutin(k, big, line) {
        scr().querySelector(".mx-cutin")?.remove();
        scr().insertAdjacentHTML("beforeend", `<div class="mx-cutin">${D.ph("CUT-IN", "", "tinted", `--tc:${civ().c}`)}<div class="tx"><div class="k">${k}</div><div class="b">${big}</div><div class="l">${line}</div></div><div class="life"></div></div>`);
        UX.after(1900, () => scr().querySelector(".mx-cutin")?.remove());
      }

      // ── ポップ ──
      const popAt = (x, y, html, opts = {}) => { const [sx, sy] = screenOf(x, y); return UX.dialog(html, { kind: "pop", x: sx, y: sy - 12, anchor: sy < 170 ? "below" : "above", ...opts }); };
      function openNodePop(n) {
        const own = n.owner === "a", tc = n.owner ? TEAMC[n.owner] : "var(--ink-2)";
        const html = `<div class="mx-pop"><div class="hd"><span style="width:10px;height:10px;background:${tc}"></span><div style="flex:1"><div class="eyebrow">${n.owner ? (own ? "自陣営" : n.owner === "npc" ? "現地勢力" : "TEAM " + D.TEAMS[n.owner].key) : "中立"} · Lv${n.lv}</div><b style="font-size:12px">${nodeName(n)}</b></div>${n.guard ? `<span class="tag danger">守備 ${n.guard}</span>` : ""}</div>
          <div class="bd"><div class="kv"><span>耐久</span><b>${own ? "1,200 / 1,200" : "800 / 1,000"}</b></div><div class="kv"><span>収入</span><b>+4.0/s</b></div><div class="kv"><span>補給線</span><b style="color:${own ? "var(--ok)" : "var(--dim)"}">${own ? "接続" : "—"}</b></div></div>
          <div class="acts">${n.id === "hq" ? `<button class="btn sm light" data-p="rally">集結点を設定</button><button class="btn sm" data-p="up">強化 → Lv${n.lv + 1}</button>` : own ? `<button class="btn sm light" data-p="up">強化 → Lv${n.lv + 1}</button><button class="btn sm" data-p="dest">ここへ向かう</button>` : `<button class="btn sm" data-p="dest">目的地にする</button>`}</div></div>`;
        popAt(n.x, n.y, html, { mount: (b, d) => b.querySelectorAll("[data-p]").forEach((x) => x.addEventListener("click", () => {
          d.close();
          if (x.dataset.p === "dest") { setDest([n.x, n.y]); m._destNode = n; }
          if (x.dataset.p === "up") { UX.toast(`${nodeName(n)} 強化開始(0:40)`); }
          if (x.dataset.p === "rally") { hint("集結点: マップをタップして位置を指定(以後に生産した部隊が向かう)", "green"); m.signalMode = { rally: true }; }
        })) });
      }
      function openEnemyPop(en) {
        popAt(en.pos[0], en.pos[1], `<div class="mx-pop"><div class="hd"><span style="width:10px;height:10px;transform:rotate(45deg);background:${TEAMC[en.team]}"></span><div style="flex:1"><div class="eyebrow">${en.team === "npc" ? "現地勢力" : "TEAM " + D.TEAMS[en.team].key + " · CORP"} · 陸上</div><b style="font-size:12px">${en.type}</b></div></div>
          <div class="bd"><div class="kv"><span>HP</span><b>${en.hp}%</b></div><div class="bar" style="margin:3px 0 6px"><i style="width:${en.hp}%;background:var(--danger)"></i></div>
          <div class="tiny" style="line-height:1.6"><b style="color:var(--ok)">有効:</b> 装甲強襲 60/s · 自走砲 80/s<br><b style="color:var(--danger)">無効:</b> 偵察 · 対空車両</div></div></div>`);
      }
      function openSquadPop(i) {
        const s = m.squads[i], chip = el.querySelector(`[data-sq="${i}"]`);
        const r = chip.getBoundingClientRect(), dr = document.getElementById("device").getBoundingClientRect(), sc = dr.width / 900;
        UX.dialog(`<div class="mx-pop" style="width:230px"><div class="hd"><b style="font-family:var(--f-display);font-size:16px">${s.no}</b><div style="flex:1"><div class="eyebrow">${s.full} · 陸上</div><b style="font-size:11px"><span style="color:var(--gold);letter-spacing:-2px">${"❯".repeat(s.rank)}</span> ${RANKS[s.rank]}</b></div><span class="mono tiny">HP ${s.hp}%</span></div>
          <div class="bd" style="padding-bottom:4px"><div class="st3"><div><span class="num">6</span>維持費/分</div><div><span class="num">42</span>速度</div><div><span class="num">${s.type === "砲" ? 260 : 120}</span>射程</div></div>
            <div class="tiny dim">練度の補正 攻 +${s.rank * 8}% · 耐久 +${s.rank * 8}%</div>
            <div class="kv" style="margin-top:4px"><span>経験値 ${s.exp} / 100</span><b style="color:var(--gold)">次: ${RANKS[Math.min(3, s.rank + 1)]}</b></div><div class="bar"><i style="width:${s.exp}%;background:var(--gold)"></i></div></div>
          <div class="eyebrow" style="padding:6px 10px 4px">STANCE · 態勢</div>${stanceButtons(s)}</div>`,
          { kind: "pop", x: (r.left + r.width / 2 - dr.left) / sc, y: (r.top - dr.top) / sc, anchor: "above", mount: (b, d) => bindStance(b, d, s) });
      }
      const stanceButtons = (s) => `<div class="mx-stance">${Object.entries(STANCE).map(([k, [sym, n, ds]]) => `<button data-stance="${k}" class="${s.stance === k ? "on" : ""}">${sym} ${n}<span>${ds}</span></button>`).join("")}</div>`;
      const bindStance = (b, d, s) => b.querySelectorAll("[data-stance]").forEach((x) => x.addEventListener("click", () => { s.stance = x.dataset.stance; d.close(); redrawSquads(); UX.toast(`${s.no} ${s.full}: ${STANCE[s.stance][1]}`); }));
      function openStancePop(i) {
        const s = m.squads[i], chip = el.querySelector(`[data-sq="${i}"]`);
        const r = chip.getBoundingClientRect(), dr = document.getElementById("device").getBoundingClientRect(), sc = dr.width / 900;
        UX.dialog(`<div class="mx-pop" style="width:230px"><div class="eyebrow ink" style="padding:8px 10px 6px">${s.no} ${s.full} の態勢</div>${stanceButtons(s)}</div>`,
          { kind: "pop", x: (r.left + r.width / 2 - dr.left) / sc, y: (r.top - dr.top) / sc, anchor: "above", mount: (b, d) => bindStance(b, d, s) });
      }

      // ── 部隊チップ: タップ / 長押し / ドラッグ ──
      function bindChips() {
        for (const chip of el.querySelectorAll("[data-sq]")) {
          const i = +chip.dataset.sq, s = m.squads[i];
          if (s.state === "training") { chip.addEventListener("click", () => UX.toast(`${s.no} ${s.full} 生産中 ${s.prog}%`)); continue; }
          let down = null, lp = null, dragging = false, ghost = null, fc = null, prev = null;
          chip.addEventListener("pointerdown", (e) => {
            e.preventDefault(); try { chip.setPointerCapture(e.pointerId); } catch {}
            down = devPos(e); dragging = false;
            lp = setTimeout(() => { lp = "fired"; openStancePop(i); }, 500);
          });
          chip.addEventListener("pointermove", (e) => {
            if (!down) return;
            const p = devPos(e);
            if (!dragging && Math.hypot(p[0] - down[0], p[1] - down[1]) > 10 && lp !== "fired") {
              clearTimeout(lp); lp = null; dragging = true; chip.classList.add("dragging");
              scr().insertAdjacentHTML("beforeend", `<div class="mx-ghost">${s.no} <span style="font-size:9px">${s.type}</span></div>`);
              ghost = scr().querySelector(".mx-ghost");
              world().insertAdjacentHTML("beforeend", `<div class="mx-path" data-prev></div>`); prev = world().querySelector("[data-prev]");
            }
            if (!dragging) return;
            ghost.style.left = p[0] + "px"; ghost.style.top = p[1] + "px";
            const bp = [p[0] - m.off[0], p[1] - m.off[1]], from = s.pos, dist = Math.hypot(bp[0] - from[0], bp[1] - from[1]);
            Object.assign(prev.style, { left: from[0] + "px", top: from[1] + "px", width: dist + "px", transform: `rotate(${Math.atan2(bp[1] - from[1], bp[0] - from[0])}rad)` });
            const n = hitNode(bp), en = hitEnemy(bp);
            const target = (n && n.owner !== "a") ? { x: n.x, y: n.y, name: nodeName(n), def: `守備NPC ×${n.guard || 1}`, win: s.type !== "偵察" } : en ? { x: en.pos[0], y: en.pos[1], name: en.type, def: `${en.type} HP ${en.hp}%`, win: s.hp > 50 } : null;
            if (target) {
              if (!fc) { scr().insertAdjacentHTML("beforeend", `<div class="mx-fc"></div>`); fc = scr().querySelector(".mx-fc"); }
              const [sx, sy] = screenOf(target.x, target.y);
              fc.style.left = sx + "px"; fc.style.top = sy + "px"; fc.classList.toggle("lose", !target.win);
              fc.innerHTML = `<div class="v"><b>${target.win ? "勝てる見込み" : "勝てない"}</b><span class="n">${target.win ? "約18秒" : "残り 64%"}</span></div><div class="vs"><div>${s.no} ${s.full}<br>${m.sel !== i && m.sel != null ? `+ ${m.squads[m.sel].no} 選択中` : ""}</div><span style="font-family:var(--f-mono);color:rgba(255,255,255,.4)">vs</span><div style="text-align:right">${target.name}<br>${target.def}</div></div>`;
              prev.classList.toggle("bad", !target.win);
            } else if (fc) { fc.remove(); fc = null; prev.classList.remove("bad"); }
          });
          const end = (e, cancel) => {
            if (!down) return;
            if (lp && lp !== "fired") clearTimeout(lp);
            const wasLong = lp === "fired"; lp = null; down = null;
            chip.classList.remove("dragging"); ghost?.remove(); fc?.remove(); prev?.remove(); ghost = fc = prev = null;
            if (dragging) {
              dragging = false;
              if (cancel) return;
              const p = devPos(e);
              const overHud = p[1] > 300 && (p[0] < 250 || p[0] > 560);
              if (overHud) return UX.toast("HUD の上で離したので取り消し");
              const bp = [p[0] - m.off[0], p[1] - m.off[1]], n = hitNode(bp);
              moveSquad(i, n ? [n.x + 14, n.y + 10] : bp, n);
              return;
            }
            if (wasLong) return;
            // タップ: 目的地があればそこへ、なければ選択 → 選択中なら部隊ポップ
            if (m.dest) { const n = m._destNode && m._destNode.x === m.dest[0] ? m._destNode : hitNode(m.dest); m._destNode = null; moveSquad(i, n ? [n.x + 14, n.y + 10] : m.dest, n); }
            else if (m.sel === i) openSquadPop(i);
            else select(i);
          };
          chip.addEventListener("pointerup", (e) => end(e, false));
          chip.addEventListener("pointercancel", (e) => end(e, true));
        }
      }
      bindChips();

      // ── 作戦指令(D26)と合図(D07 / D03) ──
      function fireOrder(p) {
        m.orderMode = null; clearHint(); el.querySelector(".mx-order").classList.remove("armed");
        const c = civ();
        const fx = UX.h(`<div class="mx-strike" style="left:${p[0]}px;top:${p[1]}px">着弾 3</div>`);
        if (c.id !== "pmc") { fx.style.borderColor = c.c; fx.style.color = c.c; fx.style.background = "rgba(255,255,255,.2)"; fx.textContent = c.order; }
        world().appendChild(fx);
        let k = 3; const t = setInterval(() => { k--; if (c.id === "pmc") fx.textContent = k ? `着弾 ${k}` : "着弾"; if (k <= 0) { clearInterval(t); setTimeout(() => fx.remove(), 600); } }, 900);
        m.orderCd = 239; el.querySelector("[data-ost]").textContent = D.mmss(m.orderCd); el.querySelector(".mx-order").classList.add("cd");
        cutin("LEADER ORDER", c.order, `${c.leader}「指定地点へ。巻き込まれるなよ。」`);
      }
      function placeSignal(p) {
        const sm = m.signalMode; m.signalMode = null; clearHint();
        for (const b of el.querySelectorAll(".sig")) b.classList.remove("on");
        if (sm.rally) { m.rally = p; world().querySelector(".mx-marks").insertAdjacentHTML("beforeend", `<div class="mx-mark" style="left:${p[0]}px;top:${p[1]}px;--c:var(--team-a)"><i></i><span>集結点</span></div>`); UX.toast("集結点を設定", "ok"); return; }
        const mk = UX.h(`<div class="mx-mark" style="left:${p[0]}px;top:${p[1]}px;--c:${sm.label === "撤退" ? "var(--danger)" : sm.label === "防衛" ? "var(--signal)" : "var(--team-a)"}"><i></i><span>${sm.label}</span></div>`);
        world().querySelector(".mx-marks").appendChild(mk);
        UX.toast(`味方に「${sm.label}」の合図`, "signal");
        setTimeout(() => mk.remove(), 5000);
      }
      function teamSelect(anchorEl, label, onPick) {
        const r = anchorEl.getBoundingClientRect(), dr = document.getElementById("device").getBoundingClientRect(), sc = dr.width / 900;
        UX.dialog(`<div class="mx-pop mx-target"><div class="eyebrow ink" style="padding:8px 10px 6px">「${label}」の送信先</div>
          <button class="row t-b" data-t="b"><span class="sym square"></span><b>TEAM B · CORP</b><span class="mono tiny dim" style="margin-left:auto">#2</span></button>
          <button class="row t-c" data-t="c"><span class="sym hex"></span><b>TEAM C · ${m.late ? "SOC" : "???"}</b><span class="mono tiny dim" style="margin-left:auto">#3</span></button>
          <button class="row dis"><span class="sym" style="background:var(--npc)"></span><b>現地勢力</b><span class="tiny dim" style="margin-left:auto">送れない</span></button></div>`,
          { kind: "pop", x: (r.left + r.width / 2 - dr.left) / sc, y: (r.top - dr.top) / sc, anchor: "above", mount: (b, d) => b.querySelectorAll("[data-t]").forEach((x) => x.addEventListener("click", () => { d.close(); onPick(x.dataset.t); })) });
      }

      // ── HUD のボタン ──
      el.addEventListener("click", (e) => {
        const a = e.target.closest("[data-act],[data-ally],[data-other],[data-addon]");
        if (!a) return;
        if (a.dataset.ally) { for (const b of el.querySelectorAll(".sig")) b.classList.toggle("on", b === a); m.signalMode = { label: a.dataset.ally }; m.orderMode = null; hint(`合図「${a.dataset.ally}」: マップをタップして位置を指定`, "green"); return; }
        if (a.dataset.other) { teamSelect(a, a.dataset.other, (t) => UX.toast(`TEAM ${D.TEAMS[t].key} へ「${a.dataset.other}」を送信`, "signal")); return; }
        if (a.dataset.addon) {
          const id = a.dataset.addon, ad = D.addon(id);
          if (m.addonUsed[id]) return UX.toast(`${ad.name}: 使用済`);
          if ((m.addonCd[id] || 0) > 0) return UX.toast(`${ad.name}: 再使用まで ${D.mmss(m.addonCd[id])}`);
          if (["forward", "armor", "optics"].includes(id)) return UX.toast(`${ad.name}: 常時効果(${ad.desc})`);
          if (id === "nemawashi") return teamSelect(a, "根回し", (t) => { m.addonUsed[id] = true; redrawAddons(); UX.toast(`根回し: TEAM ${D.TEAMS[t].key} のチケット減少 ×2(60秒)`, "violet"); });
          if (ad.kind === "cons") { m.addonUsed[id] = true; if (id === "airlift") m.supply += 250; redrawAddons(); UX.toast(`${ad.name} を使用: ${ad.desc}`, "violet"); return; }
          m.addonCd[id] = 30; redrawAddons(); UX.toast(`${ad.name} 発動`, "ok"); return;
        }
        const act = a.dataset.act;
        if (act === "menu") UX.openDialog("leave_confirm");
        if (act === "research") UX.go("research", {}, { transition: "up" });
        if (act === "base") openBase();
        if (act === "order") {
          if (m.orderCd > 0) return UX.toast(`作戦指令: 再使用まで ${D.mmss(m.orderCd)}`);
          const c = civ();
          if (["corp", "ipa"].includes(c.id)) { m.orderCd = 299; cutin("LEADER ORDER", c.order, `${c.leader}「${c.orderDesc}」`); el.querySelector(".mx-order").classList.add("cd"); return; }
          if (c.id === "int") return teamSelect(a, c.order, (t) => { m.orderCd = 239; UX.toast(`電波妨害: TEAM ${D.TEAMS[t].key} の視界を半減`, "violet"); });
          m.orderMode = true; m.signalMode = null; a.classList.add("armed"); hint(`作戦指令「${c.order}」: マップをタップして位置を指定`);
        }
        if (act === "minimap") {
          const r = a.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
          m.off = [Math.max(-240, Math.min(120, Math.round(450 - (fx * 1140 - 120)))), Math.max(-120, Math.min(120, Math.round(210 - (fy * 660 - 120))))];
          world().style.transform = `translate(${m.off[0]}px,${m.off[1]}px)`;
          el.querySelector(".mm-view").style.left = (120 - m.off[0]) / 1140 * 100 + "%"; el.querySelector(".mm-view").style.top = (120 - m.off[1]) / 660 * 100 + "%";
        }
        if (act === "late") goLate();
        if (act === "capture") { const n = m.nodes.find((x) => x.owner !== "a" && x.id !== "npc") ?? m.nodes[1]; capture(n); }
        if (act === "end") { UX.go("mvp", {}, { transition: "fade" }); }
      });
      function goLate() {
        if (m.late) return UX.toast("すでに終盤");
        m.late = true; m.phase = "LATE"; m.t = Math.min(m.t, 4 * 60 + 40);
        m.nodes.push({ id: "gate", x: 560, y: 90, owner: null, guard: 6, lv: 3, big: true });
        scr().classList.add("late"); redrawTop(); redrawBoard();
        scr().insertAdjacentHTML("beforeend", erosionSVG());
        scr().insertAdjacentHTML("beforeend", `<div class="mx-warn"><div class="in"><div style="flex:1"><div class="eyebrow" style="color:#c9a7ff">WARNING · LATE PHASE · 大拠点出現</div><div class="big">中央水門 開放</div><div class="tiny" style="color:rgba(255,255,255,.6);margin-top:4px">制圧したチームは毎秒チケットを削る · 休戦は自動で解除</div></div><div style="text-align:right"><div class="eyebrow" style="color:rgba(255,255,255,.5)">出現まで</div><div class="big" style="color:#c9a7ff">0:30</div></div></div></div>`);
        UX.after(4300, () => scr().querySelector(".mx-warn")?.remove());
        say("……何だ、この線は。地図が書き換えられていく。水門へ急げ。");
      }

      // ── BASE パネル(D02) ──
      function openBase() {
        const units = [["強襲", "装甲強襲", 120, 20], ["偵察", "偵察", 60, 10], ["砲", "自走砲", 150, 25], ["対空", "対空車両", 140, 22, "研究: 対空防御"], ["ヘリ", "攻撃ヘリ", 220, 35, "研究: 航空戦力"], ["艇", "哨戒艇", 80, 15]];
        const defs = [["砲座", 100], ["対空陣地", 120], ["地雷原", 60], ["観測塔", 90], ["妨害塔", 130, "研究: 電子戦"]];
        const body = (tab) => tab === "prod" ? `<div class="units">${units.map(([s, n, c, t, lock]) => `<button class="u ${lock ? "locked" : ""}" data-unit="${s}|${n}|${c}|${lock || ""}"><div style="display:flex;gap:6px;align-items:center">${D.ph("IC", "", "", "width:22px;height:22px;flex:none")}<b>${n}</b></div><span class="tiny dim">${lock || "陸上 · 部隊上限 1"}</span><div class="meta"><span class="cost">${c}</span><span>${t}s</span></div></button>`).join("")}</div>`
          : tab === "def" ? `<div class="units">${defs.map(([n, c, lock]) => `<button class="u ${lock ? "locked" : ""}" data-def="${n}|${lock || ""}"><b>${n}</b><span class="tiny dim">${lock || "首都の周囲に建設"}</span><div class="meta"><span class="cost">${c}</span><span>30s</span></div></button>`).join("")}</div>`
          : `<div style="display:flex;flex-direction:column;gap:6px"><div class="panel" style="padding:8px 10px;display:flex;align-items:center;gap:10px"><div style="flex:1"><b>首都 Lv2 → Lv3</b><div class="tiny dim">耐久 +40%、砲座を1基追加、維持費 +2/分</div></div><button class="btn sm" data-upg>300 で強化</button></div><div class="panel" style="padding:8px 10px"><b>部隊上限</b><div class="tiny dim">現在 ${m.squads.length} / 6(研究「契約増派」で +2)</div></div></div>`;
        const queue = () => { const tr = m.squads.filter((s) => s.state === "training"); return tr.length ? tr.map((s) => `<div class="q"><b>${s.no}</b>${s.full}<div class="bar"><i style="width:${s.prog}%"></i></div></div>`).join("") : `<div class="tiny dim" style="padding:4px 0">生産キューは空</div>`; };
        UX.dialog(`<div class="mx-base"><div class="head"><b style="font-size:13px;margin-right:4px">BASE</b><div class="tabs"><button class="tab on" data-tab="prod">生産</button><button class="tab" data-tab="def">防御施設</button><button class="tab" data-tab="up">強化</button></div><div class="spacer" style="flex:1"></div><span class="mono tiny">SUPPLY ${Math.round(m.supply)}</span><button class="btn sm ghost" data-close style="margin:0 0 4px 6px">✕</button></div>
          <div class="body"><div data-tb>${body("prod")}</div><aside><div class="eyebrow ink" style="margin-bottom:4px">QUEUE · 生産中</div><div data-q>${queue()}</div><div class="panel" style="padding:6px;margin-top:6px"><div class="eyebrow">UPKEEP</div><b class="mono" style="font-size:10px">−6/s · 部隊 ${m.squads.length}/6</b><div class="tiny dim" style="margin-top:4px">集結点: ${m.rally ? "設定済み" : "未設定(首都をタップ)"}</div></div></aside></div></div>`,
          { kind: "pop", x: 470, y: 64, anchor: "below", mount: (b, d) => {
            const bindTab = () => {
              b.querySelectorAll("[data-unit]").forEach((x) => x.addEventListener("click", () => {
                const [s, n, c, lock] = x.dataset.unit.split("|");
                if (lock) return UX.toast(`${n}: ${lock}が必要`, "danger");
                if (m.squads.length >= 6) return UX.toast("部隊上限 6 に達しています", "danger");
                m.supply -= +c; m.squads.push({ no: String(m.squads.length + 1).padStart(2, "0"), type: s, full: n, pos: [m.rally?.[0] ?? 350, m.rally?.[1] ?? 270], hp: 100, rank: 0, exp: 0, stance: "atk", state: "training", prog: 0 });
                redrawSquads(); b.querySelector("[data-q]").innerHTML = queue(); UX.toast(`${n} を生産開始`);
              }));
              b.querySelectorAll("[data-def]").forEach((x) => x.addEventListener("click", () => { const [n, lock] = x.dataset.def.split("|"); if (lock) return UX.toast(`${n}: ${lock}が必要`, "danger"); d.close(); hint(`${n}: マップをタップして建設地点を指定`, "ink"); m.signalMode = { label: n + " 建設予定" }; }));
              b.querySelector("[data-upg]")?.addEventListener("click", () => { d.close(); UX.toast("首都 強化開始 → Lv3(0:40)"); });
            };
            b.querySelectorAll("[data-tab]").forEach((t) => t.addEventListener("click", () => { b.querySelectorAll("[data-tab]").forEach((x) => x.classList.toggle("on", x === t)); b.querySelector("[data-tb]").innerHTML = body(t.dataset.tab); bindTab(); }));
            bindTab();
          } });
      }
    },
  });

  // ───────── D29 離脱の確認 ─────────
  UX.dialogs.leave_confirm = {
    opts: { kind: "modal" },
    render: () => `<div class="dlg marks" style="width:400px">
      <div class="dlg-head"><span class="docno">FORM 4X-29 · 離脱届</span><div class="h2" style="margin-top:4px">試合から離脱しますか?</div></div>
      <div class="dlg-body">
        <div style="display:flex;gap:10px;padding:8px 10px;background:rgba(226,51,79,.06);border-left:3px solid var(--danger);margin-bottom:8px"><b style="color:var(--danger)">!</b><span>試合は続きます。離脱中は指導者の AI が代わりに指揮します。</span></div>
        <div style="display:flex;flex-direction:column;gap:4px;font-size:10.5px">
          <div><span class="mono tiny dim">01</span> 離脱すると戻るまで操作できません(再接続で復帰可)</div>
          <div><span class="mono tiny dim">02</span> 途中離脱が続くとマッチングに待機時間が付きます</div>
          <div><span class="mono tiny dim">03</span> 報酬は試合終了時の順位で計算します</div>
        </div>
      </div>
      <div class="dlg-foot"><button class="btn ghost" data-close>戻る</button><button class="btn danger" data-leave>離脱する</button></div></div>`,
    mount(body, d) { body.querySelector("[data-leave]").addEventListener("click", () => { d.close(); UX.state.match = null; UX.reset("home"); UX.toast("試合から離脱(AI代行中)", "danger"); }); },
  };

  // ───────── S05a 研究画面 ─────────
  const BR = {
    power: ["戦力", "攻撃・部隊上限", [[["fire", "火力支援", "攻撃 +15%(PMC 固有)", 60, 30]], [["siege", "攻城装備", "攻城部隊を生産できる", 120, 45], ["mobile", "機動戦", "移動 +15%、攻撃 +5%", 120, 45]], [["aa", "対空防御", "対空車両を生産できる", 180, 60]], [["air", "航空戦力", "攻撃ヘリ、部隊上限 +1", 300, 90], ["contract", "契約増派", "部隊上限 +2、攻撃 +15%", 300, 90]]]],
    logi: ["兵站", "収入・拠点", [[["supply1", "前線補給", "収入 +10%", 60, 30]], [["line", "補給線延伸", "補給線の距離 +30%", 120, 45]], [["fort", "拠点強化", "拠点の耐久 +30%", 180, 60], ["arsenal", "野戦工廠", "拠点でも生産できる", 180, 60]], [["mobil", "総動員", "生産速度 +25%", 300, 90]]]],
    intel: ["情報", "視界・隠密", [[["recon", "偵察強化", "視界 +15%", 60, 30]], [["ew", "電子戦", "妨害塔を建設できる", 120, 45], ["stealth", "隠密行動", "移動中は敵に見えにくい", 120, 45]], [["tower", "観測塔", "観測塔を建設できる", 180, 60]], [["allsee", "全域照会", "30秒間マップ全体を見る", 300, 90]]]],
    eng: ["工兵", "渡河・水上", [[["bridge2", "架橋 II", "橋 II を架けられる", 60, 30]], [["ropeway", "索道", "索道を架けられる", 120, 45]], [["bridge3", "架橋 III", "橋 III を架けられる", 180, 60], ["boat", "渡河艇", "哨戒艇を生産できる", 180, 60]], [["fortify", "要塞化", "防御施設の耐久 +50%", 300, 90]]]],
  };
  const allNodes = () => Object.entries(BR).flatMap(([b, [, , tiers]]) => tiers.flatMap((t, ti) => t.map((n) => ({ b, tier: ti, id: n[0], name: n[1], desc: n[2], cost: n[3], time: n[4], pair: t.length > 1 ? t.find((x) => x !== n)[0] : null }))));
  const nodeById = (id) => allNodes().find((n) => n.id === id);
  function tickResearch(m) {
    const r = m.research;
    if (r.doing) { r.doing.p += 100 / (nodeById(r.doing.id)?.time ?? 40) * 1.5; if (r.doing.p >= 100) { r.done.push(r.doing.id); UX.toast(`研究完了: ${nodeById(r.doing.id).name}`, "ok"); r.doing = null; } }
    if (!r.doing && r.queue.length) { const id = r.queue.shift(); r.doing = { id, p: 0 }; }
  }
  UX.css(`
  [data-screen=research] .rs-sheet { position: absolute; left: 0; right: 0; top: 86px; bottom: 0; background: rgba(243,245,247,.96); backdrop-filter: var(--glass-blur); border-top: 1px solid var(--line-2); display: grid; grid-template-columns: minmax(0,1fr) 190px; grid-template-rows: auto 1fr; gap: 0 12px; padding: 8px 14px 12px; }
  [data-screen=research] .rs-head { grid-column: 1 / 3; display: flex; align-items: center; gap: 14px; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
  [data-screen=research] .rs-now { flex: 1; display: flex; align-items: center; gap: 10px; padding: 4px 10px; background: var(--surface-solid); border: 1px solid var(--line); max-width: 330px; margin-left: auto; }
  [data-screen=research] .rs-now .bar { flex: 1; } [data-screen=research] .rs-now .bar > i { background: var(--signal); transition: width 1s linear; }
  [data-screen=research] .rs-main { display: flex; flex-direction: column; min-height: 0; padding-top: 6px; }
  [data-screen=research] .rs-brs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
  [data-screen=research] .rs-br { padding: 4px 8px; border: 1px solid var(--line); background: var(--surface-solid); text-align: left; display: flex; align-items: center; gap: 8px; }
  [data-screen=research] .rs-br b { font-size: 11px; } [data-screen=research] .rs-br .d { font-size: 8.5px; color: var(--dim); }
  [data-screen=research] .rs-br .c { margin-left: auto; font-family: var(--f-mono); font-size: 9px; }
  [data-screen=research] .rs-br.on { background: var(--ink); color: #fff; border-color: var(--ink); } [data-screen=research] .rs-br.on .d { color: rgba(255,255,255,.6); }
  [data-screen=research] .rs-tiers { flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 6px; animation: ux-fade-in .25s; }
  [data-screen=research] .rs-tier { display: flex; flex-direction: column; justify-content: center; gap: 4px; padding: 14px 8px 0; position: relative; }
  [data-screen=research] .rs-tier + .rs-tier { border-left: 1px dashed var(--line-2); }
  [data-screen=research] .rs-tier .tl { position: absolute; top: 0; left: 8px; }
  [data-screen=research] .nd { position: relative; padding: 6px 8px; background: var(--surface-solid); border: 1px solid var(--line); text-align: left; }
  [data-screen=research] .nd b { font-size: 10.5px; display: block; } [data-screen=research] .nd .ds { font-size: 8.5px; color: var(--ink-2); line-height: 1.35; }
  [data-screen=research] .nd .ft { display: flex; justify-content: space-between; margin-top: 4px; font-family: var(--f-mono); font-size: 8px; color: var(--dim); }
  [data-screen=research] .nd .st { position: absolute; right: 6px; top: 5px; }
  [data-screen=research] .nd.done { background: var(--ink); color: #fff; border-color: var(--ink); } [data-screen=research] .nd.done .ds, [data-screen=research] .nd.done .ft { color: rgba(255,255,255,.6); }
  [data-screen=research] .nd.doing { box-shadow: 0 0 0 1.5px var(--signal); } [data-screen=research] .nd.doing .bar { margin-top: 4px; } [data-screen=research] .nd.doing .bar > i { background: var(--signal); }
  [data-screen=research] .nd.ex { opacity: .45; } [data-screen=research] .nd.ex b { text-decoration: line-through; }
  [data-screen=research] .nd.queued { box-shadow: 0 0 0 1.5px var(--ink); }
  [data-screen=research] .nd.short { border-style: dashed; }
  [data-screen=research] .xor { align-self: center; font-family: var(--f-mono); font-size: 8.5px; color: var(--dim); }
  [data-screen=research] .rs-side { padding-top: 6px; display: flex; flex-direction: column; gap: 6px; }
  [data-screen=research] .qi { display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: var(--surface-solid); border: 1px solid var(--line); font-size: 10px; animation: ux-fade-in .2s; }
  [data-screen=research] .qi .n { font-family: var(--f-display); font-weight: 700; font-size: 13px; width: 14px; }
  [data-screen=research] .qi .x { margin-left: auto; color: var(--dim); font-family: var(--f-mono); padding: 0 4px; }
  [data-screen=research] .qi.empty { border-style: dashed; color: var(--faint); background: transparent; }
  `);
  UX.screen("research", {
    title: "S05a 研究画面", group: "試合", transition: "up",
    render: () => {
      const m = M();
      return `<div class="screen"><div class="board-ph"></div>${hudTop(m)}
        <section class="rs-sheet">
          <div class="rs-head"><button class="btn sm light" data-back="match">← 戻る</button><div><span class="eyebrow">RESEARCH · 試合は進行中</span><div class="h1" style="font-size:20px">研究</div></div>
            <div style="display:flex;align-items:baseline;gap:5px"><span class="eyebrow">POINTS</span><span class="num" style="font-size:18px" data-rp>${Math.floor(m.rp)}</span><span class="mono tiny dim">+1.2/s</span></div>
            <div class="rs-now" data-now></div></div>
          <div class="rs-main"><div class="rs-brs"></div><div class="rs-tiers"></div></div>
          <aside class="rs-side"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="eyebrow ink">QUEUE · 予約列</span><span class="mono tiny" data-qn></span></div><div data-q style="display:flex;flex-direction:column;gap:6px"></div>
            <div class="panel" style="margin-top:auto;padding:8px"><div class="eyebrow">TIP</div><div class="small" style="line-height:1.5">排他の2枚はどちらか一方だけ。研究中にタップすると予約列に入ります。</div></div></aside>
        </section></div>`;
    },
    mount(el) {
      const m = M(), r = m.research;
      let br = UX.state.researchTab ?? "power";
      const taken = (id) => r.done.includes(id) || r.doing?.id === id || r.queue.includes(id);
      const status = (n) => {
        if (r.done.includes(n.id)) return "done";
        if (r.doing?.id === n.id) return "doing";
        if (r.queue.includes(n.id)) return "queued";
        if (n.pair && taken(n.pair)) return "ex";
        const prevTier = BR[n.b][2][n.tier - 1];
        if (prevTier && !prevTier.some((x) => taken(x[0]))) return "short";
        return "ok";
      };
      const draw = () => {
        el.querySelector(".rs-brs").innerHTML = Object.entries(BR).map(([k, [n, d, tiers]]) => `<button class="rs-br ${k === br ? "on" : ""}" data-br="${k}"><div><b>${n}</b><div class="d">${d}</div></div><span class="c">${tiers.flat().filter((x) => r.done.includes(x[0])).length} / 4</span></button>`).join("");
        el.querySelector(".rs-tiers").innerHTML = BR[br][2].map((t, ti) => `<div class="rs-tier"><span class="eyebrow tl">TIER ${ti + 1}</span>${t.map((x, j) => {
          const n = nodeById(x[0]), st = status(n), qi = r.queue.indexOf(n.id);
          const foot = st === "done" ? `<span>研究済み</span><span>${n.cost} RP</span>` : st === "doing" ? `<span style="color:var(--signal)">研究中 ${Math.floor(r.doing.p)}%</span><span>${n.time}s</span>` : st === "ex" ? `<span>排他で不可</span><span>${n.cost} RP</span>` : st === "short" ? `<span style="color:var(--danger)">前提不足</span><span>${n.cost}</span>` : st === "queued" ? `<span>予約 ${qi + 1}</span><span>${n.cost} RP</span>` : `<span>${r.doing ? "予約できる" : m.rp >= n.cost ? "研究できる" : "ポイント不足"}</span><span>${n.cost} RP · ${n.time}s</span>`;
          return `${j ? '<span class="xor">⇄ 排他</span>' : ""}<button class="nd ${st}" data-nd="${n.id}">${st === "done" ? '<span class="st tag" style="color:#fff;border-color:rgba(255,255,255,.3);height:15px">済</span>' : st === "queued" ? `<span class="st tag solid" style="height:15px">予約 ${qi + 1}</span>` : ""}<b>${n.name}</b><span class="ds">${n.desc}</span>${st === "doing" ? `<div class="bar"><i style="width:${r.doing.p}%"></i></div>` : ""}<div class="ft">${foot}</div></button>`;
        }).join("")}</div>`).join("");
        const d = r.doing && nodeById(r.doing.id);
        el.querySelector("[data-now]").innerHTML = d ? `<span class="eyebrow ink">NOW</span><b style="font-size:10.5px">${d.name}</b><div class="bar"><i style="width:${r.doing.p}%"></i></div><span class="mono tiny">${D.mmss(Math.ceil((100 - r.doing.p) / 100 * d.time))}</span>` : `<span class="small dim">研究していません。ノードをタップで開始</span>`;
        el.querySelector("[data-qn]").textContent = `${r.queue.length} / 3`;
        el.querySelector("[data-q]").innerHTML = [0, 1, 2].map((i) => { const id = r.queue[i]; return id ? `<div class="qi"><span class="n">${i + 1}</span>${nodeById(id).name} <span class="tag" style="height:14px">${BR[nodeById(id).b][0]}</span><button class="x" data-rm="${id}">×</button></div>` : `<div class="qi empty"><span class="n">${i + 1}</span>空き</div>`; }).join("");
        el.querySelector("[data-rp]").textContent = Math.floor(m.rp);
      };
      el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-br]"); if (b) { br = UX.state.researchTab = b.dataset.br; draw(); return; }
        const rm = e.target.closest("[data-rm]"); if (rm) { r.queue.splice(r.queue.indexOf(rm.dataset.rm), 1); UX.toast(`予約を取り消し: ${nodeById(rm.dataset.rm).name}`); draw(); return; }
        const nd = e.target.closest("[data-nd]"); if (!nd) return;
        const n = nodeById(nd.dataset.nd), st = status(n);
        if (st === "done") return UX.toast(`${n.name}: 研究済み`);
        if (st === "doing") return UX.toast(`${n.name}: 研究中`);
        if (st === "queued") return UX.toast(`${n.name}: 予約 ${r.queue.indexOf(n.id) + 1}番目(右の × で取り消し)`);
        if (st === "ex") return UX.toast(`${n.name}: ${nodeById(n.pair).name} と排他`, "danger");
        if (st === "short") return UX.toast(`${n.name}: 前の段の研究が必要`, "danger");
        if (!r.doing) { if (m.rp < n.cost) return UX.toast(`ポイント不足(${n.cost} RP 必要)`, "danger"); m.rp -= n.cost; r.doing = { id: n.id, p: 0 }; UX.toast(`研究開始: ${n.name}`, "signal"); }
        else { if (r.queue.length >= 3) return UX.toast("予約列は3つまで", "danger"); r.queue.push(n.id); UX.toast(`予約: ${n.name}`); }
        draw();
      });
      UX.every(1000, () => {
        m.t = Math.max(0, m.t - 1); m.rp += 1.2; m.supply += 8;
        m.tickets.a -= 0.3; m.tickets.b -= 0.6; m.tickets.c -= 0.5;
        tickResearch(m);
        el.querySelector(".timer .t").textContent = D.mmss(m.t);
        for (const k of ["a", "b", "c"]) { const v = el.querySelector(`[data-tk=${k}]`); if (v) v.textContent = Math.round(m.tickets[k]); }
        draw();
      });
      draw();
    },
  });
})();

// 試合後(S11 MVP → S06 リザルト + D35 レベルアップ)と導入(S08)
(function () {
  const { CIVS } = D;
  const civ = () => CIVS[UX.state.civ] ?? CIVS.pmc;

  // ───────── S11 MVP ─────────
  UX.css(`
  [data-screen=mvp] .screen { background: radial-gradient(90% 120% at 30% 40%, #1f2d3a, #0b1218 70%); }
  [data-screen=mvp] .rays { position: absolute; inset: 0; background: repeating-conic-gradient(from 200deg at 28% 60%, color-mix(in srgb, var(--cc) 10%, transparent) 0 4deg, transparent 4deg 14deg); mask-image: radial-gradient(70% 90% at 28% 60%, #000, transparent 75%); animation: mvp-rot 30s linear infinite; }
  @keyframes mvp-rot { to { transform: rotate(8deg) scale(1.1); } }
  [data-screen=mvp] .stand { position: absolute; left: 30px; top: 0; bottom: 0; width: 360px; border-top: 0; border-bottom: 0; animation: mvp-stand .7s cubic-bezier(.2,.8,.2,1) both; background: repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 7px), linear-gradient(180deg, color-mix(in srgb, var(--cc) 40%, transparent), transparent 80%); }
  @keyframes mvp-stand { from { transform: translateX(-40px); opacity: 0; } }
  [data-screen=mvp] .huge { position: absolute; right: 18px; top: 8px; font-family: var(--f-display); font-weight: 700; font-size: 150px; letter-spacing: -0.06em; line-height: .8; color: transparent; -webkit-text-stroke: 1.5px rgba(255,255,255,.16); animation: ux-fade-in 1s .2s both; }
  [data-screen=mvp] .info { position: absolute; left: 410px; right: 22px; top: 54px; bottom: 16px; display: flex; flex-direction: column; gap: 8px; }
  [data-screen=mvp] .info > * { animation: ux-in-r .45s cubic-bezier(.2,.8,.2,1) both; }
  [data-screen=mvp] .info > :nth-child(2) { animation-delay: .1s; } [data-screen=mvp] .info > :nth-child(3) { animation-delay: .2s; } [data-screen=mvp] .info > :nth-child(4) { animation-delay: .3s; } [data-screen=mvp] .info > :nth-child(5) { animation-delay: .4s; }
  [data-screen=mvp] .name { font-family: var(--f-display); font-weight: 700; font-size: 38px; letter-spacing: -0.02em; line-height: 1; }
  [data-screen=mvp] .quote { font-size: 12.5px; line-height: 1.6; border-left: 2px solid var(--cc); padding-left: 10px; color: var(--ink-2); }
  [data-screen=mvp] .cats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
  [data-screen=mvp] .cat { padding: 7px 10px; background: rgba(255,255,255,.05); border: 1px solid var(--line); }
  [data-screen=mvp] .cat .top { display: flex; justify-content: space-between; align-items: baseline; }
  [data-screen=mvp] .cat .num { font-size: 20px; line-height: 1; }
  [data-screen=mvp] .cat .bar { margin-top: 5px; background: rgba(255,255,255,.1); }
  [data-screen=mvp] .cat .bar > i { background: var(--cc); animation: mvp-bar 1s .5s cubic-bezier(.2,.8,.2,1) both; }
  @keyframes mvp-bar { from { width: 0 !important; } }
  [data-screen=mvp] .best { color: var(--warn); font-family: var(--f-mono); font-size: 8px; letter-spacing: .14em; }
  [data-screen=mvp] .kudos { display: flex; gap: 6px; align-items: center; margin-top: auto; }
  [data-screen=mvp] .kd { display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; white-space: nowrap; border: 1px solid var(--line-2); font-size: 10.5px; font-weight: 700; color: var(--ink); }
  [data-screen=mvp] .kd .c { font-family: var(--f-mono); font-size: 9px; color: var(--dim); }
  [data-screen=mvp] .kd.on { background: #fff; color: #0e161e; border-color: #fff; } [data-screen=mvp] .kd.on .c { color: #0e161e; }
  [data-screen=mvp] .cta { background: #fff; color: #0e161e; min-width: 0; height: 46px; margin-left: auto; }
  [data-screen=mvp] .cta .cta-sub { color: rgba(14,22,30,.55); } [data-screen=mvp] .cta .cta-go { border-color: rgba(14,22,30,.2); }
  [data-screen=mvp] .auto { position: absolute; left: 410px; right: 22px; bottom: 6px; height: 2px; background: rgba(255,255,255,.1); }
  [data-screen=mvp] .auto i { display: block; height: 100%; background: rgba(255,255,255,.5); transform-origin: 0 0; animation: mx-life 9s linear forwards; }
  `);
  UX.screen("mvp", {
    title: "S11 MVP", group: "試合後", transition: "fade",
    render: () => { const c = civ(); return `<div class="screen dark" style="--cc:${c.c}">
      <div class="rays"></div>
      <div class="ph stand"><span class="ph-k">MVP LEADER · FULL BODY</span><span class="ph-d">${c.leader} 全身 9:16(勝利ポーズ・衣装反映・ボイス)</span></div>
      <div class="huge">MVP</div>
      <section class="info">
        <div style="display:flex;align-items:center;gap:8px"><span class="tag" style="color:var(--warn);border-color:var(--warn)">MOST VALUABLE PLAYER</span><span class="tag">TEAM A · ${c.short}</span><span class="mono tiny dim">CASE DR-09F9DB4F</span></div>
        <div><div class="name">${UX.state.name}</div><div class="jp-sub" style="margin-top:4px">指導者 ${c.leader} · ${c.name}</div></div>
        <p class="quote">「いい仕事だった。報酬は弾む ── 次も俺を呼べ。」</p>
        <div class="cats">
          <div class="cat"><div class="top"><span class="small">制圧</span><span class="best">BEST</span></div><div class="top"><span class="num">7</span><span class="mono tiny dim">全体 1位</span></div><div class="bar"><i style="width:100%"></i></div></div>
          <div class="cat"><div class="top"><span class="small">チケット削り</span><span class="best">BEST</span></div><div class="top"><span class="num">384</span><span class="mono tiny dim">全体 1位</span></div><div class="bar"><i style="width:92%"></i></div></div>
          <div class="cat"><div class="top"><span class="small">NPC討伐</span></div><div class="top"><span class="num">9</span><span class="mono tiny dim">全体 1位</span></div><div class="bar"><i style="width:70%"></i></div></div>
          <div class="cat"><div class="top"><span class="small">部隊の昇格</span></div><div class="top"><span class="num">4</span><span class="mono tiny dim">古参 1</span></div><div class="bar"><i style="width:55%"></i></div></div>
        </div>
        <div class="kudos"><span class="eyebrow" style="white-space:nowrap">KUDOS</span>
          <button class="kd" data-kd>見事な指揮 <span class="c">2</span></button><button class="kd" data-kd>好判断 <span class="c">1</span></button><button class="kd" data-kd>良い勝負 <span class="c">0</span></button>
          <button class="cta" data-go="result" data-tr="up"><div><div class="cta-main" style="font-size:16px">戦闘詳報へ</div><div class="cta-sub">報酬を受け取る</div></div><div class="cta-go">→</div></button></div>
      </section>
      <div class="auto"><i></i></div>
    </div>`; },
    mount(el) {
      UX.toast(`${civ().leader} のボイスを再生`, "signal");
      for (const b of el.querySelectorAll("[data-kd]")) b.addEventListener("click", () => { if (b.classList.contains("on")) return; b.classList.add("on"); const c = b.querySelector(".c"); c.textContent = +c.textContent + 1; UX.toast(`「${b.firstChild.textContent.trim()}」を送った`, "ok"); });
      UX.after(9000, () => UX.go("result", {}, { transition: "up" }));
    },
  });

  // ───────── S06 リザルト ─────────
  UX.css(`
  [data-screen=result] .grid { position: absolute; inset: 44px 0 0 0; padding: 10px 14px 12px; display: grid; grid-template-columns: 170px minmax(0,1fr) 210px; grid-template-rows: auto 1fr; gap: 8px; }
  [data-screen=result] .rank { grid-row: 1 / 3; padding: 12px 12px; border-left: 4px solid var(--team-a); display: flex; flex-direction: column; gap: 6px; }
  [data-screen=result] .rank .big { font-family: var(--f-display); font-weight: 700; font-size: 84px; line-height: .85; letter-spacing: -.06em; position: relative; }
  [data-screen=result] table { width: 100%; border-collapse: collapse; font-size: 10px; }
  [data-screen=result] th { font-family: var(--f-mono); font-size: 8px; color: var(--dim); font-weight: 500; text-align: right; padding: 5px 6px; border-bottom: 1px solid var(--line); letter-spacing: .08em; }
  [data-screen=result] th:nth-child(-n+2) { text-align: left; }
  [data-screen=result] td { padding: 6px 6px; text-align: right; font-family: var(--f-display); font-weight: 600; border-bottom: 1px solid var(--line); }
  [data-screen=result] td:nth-child(-n+2) { text-align: left; }
  [data-screen=result] tr.me td { background: rgba(255,106,26,.08); }
  [data-screen=result] tr.me td:first-child { box-shadow: inset 3px 0 0 var(--team-a); }
  [data-screen=result] tbody tr { animation: ux-in-r .4s cubic-bezier(.2,.8,.2,1) both; }
  [data-screen=result] tbody tr:nth-child(2) { animation-delay: .1s; } [data-screen=result] tbody tr:nth-child(3) { animation-delay: .2s; }
  [data-screen=result] .rewards { grid-row: 1 / 3; grid-column: 3; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; transition: box-shadow .3s; }
  [data-screen=result] .rewards.hl { box-shadow: 0 0 0 2px var(--crayon), var(--shadow); }
  [data-screen=result] .rw { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--line); font-size: 10.5px; }
  [data-screen=result] .rw .ph { width: 22px; height: 22px; flex: none; }
  [data-screen=result] .rate { font-family: var(--f-display); font-weight: 700; font-size: 26px; color: var(--ok); }
  [data-screen=result] .frag { padding: 10px 12px; border-left: 3px solid var(--crayon); background: linear-gradient(90deg, var(--crayon-soft), transparent); }
  [data-screen=result] .lower { display: grid; grid-template-columns: 1fr 1.3fr; gap: 8px; min-height: 0; }
  `);
  UX.screen("result", {
    title: "S06 リザルト", group: "試合後", transition: "up",
    render: () => { const c = civ(); return `<div class="screen grid-bg">
      <header class="topbar"><div class="title"><span class="eyebrow">AFTER ACTION REPORT</span><b>戦闘詳報</b></div><span class="docno" style="margin-left:8px">CASE NO: DR-09F9DB4F</span><span class="tag">時間切れ</span><span class="tag">30:00</span><span class="tag">ランク戦</span><div class="spacer"></div><span class="stamp" style="color:var(--ok)">任務完了</span></header>
      <div class="grid">
        <section class="panel rank"><span class="eyebrow ink">FINAL STANDING</span><div class="big">#1<span style="font-size:24px;color:var(--dim)">/3</span>
          <svg class="crayon-svg" style="left:-6px;top:-10px" width="110" height="100" viewBox="0 0 110 100"><path d="M70 6 C 100 20, 108 70, 70 90 S 10 80, 14 40 S 50 0, 84 14" stroke-width="2.6" style="stroke-dasharray:400;stroke-dashoffset:400;animation:mx-draw 1s .6s ease forwards"/></svg></div>
          <div style="display:flex;align-items:center;gap:6px;font-weight:700;font-size:13px"><span class="sym diamond" style="--tc:var(--team-a)"></span>TEAM A</div><div class="small dim">${c.name} · ${c.leader}</div>
          <div class="rule"></div><div class="eyebrow">RATING</div><div><span class="rate" data-rate>+0</span> <span class="mono small">→ <span data-rv>1,624</span></span></div>
          <div class="rule" style="margin-top:auto"></div><div style="display:flex;gap:8px;align-items:center">${D.phRound(34)}<div><div class="eyebrow">MVP</div><b>${UX.state.name}</b></div></div></section>
        <section class="panel" style="padding:2px 8px 6px"><table><thead><tr><th>#</th><th>TEAM</th><th>所属</th><th>チケット</th><th>制圧</th><th>削り</th><th>NPC</th><th>撃破</th><th>損失</th><th>昇格</th></tr></thead><tbody>
          <tr class="me"><td>1</td><td><span class="sym diamond" style="--tc:var(--team-a)"></span> A ${UX.state.name}</td><td>${c.short}</td><td>612</td><td>7</td><td>384</td><td>9</td><td>14</td><td>5</td><td>4</td></tr>
          <tr><td>2</td><td><span class="sym square" style="--tc:var(--team-b)"></span> B BOT-02</td><td>CORP</td><td>455</td><td>5</td><td>251</td><td>6</td><td>9</td><td>11</td><td>2</td></tr>
          <tr><td>3</td><td><span class="sym hex" style="--tc:var(--team-c)"></span> C BOT-03</td><td>SOC</td><td style="color:var(--danger)">0 OUT</td><td>2</td><td>118</td><td>3</td><td>6</td><td>17</td><td>1</td></tr></tbody></table></section>
        <div class="lower">
          <section class="panel" style="padding:10px 12px"><div class="eyebrow ink">VETERANCY · 練度</div><div style="display:flex;gap:18px;margin-top:6px"><div><div class="num" style="font-size:24px">4</div><div class="tiny dim">昇格回数</div></div><div><div class="num" style="font-size:24px;color:var(--gold)">1</div><div class="tiny dim">古参で生還</div></div></div></section>
          <section class="frag"><div class="eyebrow" style="color:var(--crayon)">FRAGMENT 03 · 物語の断章</div><p style="font-size:11px;line-height:1.7;margin-top:4px">「線を引いたのは、わたし。だってその川、じゃまだったから。」</p><button class="btn sm light" style="margin-top:6px" data-go="story">物語で読む →</button></section>
        </div>
        <section class="panel rewards" style="grid-column:3;grid-row:1/3">
          <span class="eyebrow ink">REWARDS · 報酬</span>
          <div style="display:flex;justify-content:space-between;align-items:baseline"><span>文明XP</span><span class="num" style="font-size:20px" data-xp>+0</span></div><div class="bar"><i data-xpbar style="width:20%;transition:width 1s"></i></div>
          <div class="rw"><span class="mono">${c.short}</span><b data-lv>Lv.${c.lv}</b></div>
          <div class="rw" data-unlock style="opacity:.3">${D.ph("IC", "", "")}<span>開放: 衛星照会</span><span class="tiny" style="margin-left:auto;color:var(--gold)">永続</span></div>
          <div class="rw" style="color:var(--crayon)">${D.ph("IC", "", "")}<span>称号「渡河の先導者」</span></div>
          <div class="rw">${D.ph("IC", "", "")}<span>緊急空輸 ×1</span><span style="margin-left:auto;color:var(--gold)">★★</span></div>
          <div class="tiny dim">本日のドロップ 残り 2 / 5</div>
          <button class="cta" style="min-width:0;height:48px;margin-top:auto" data-home><div><div class="cta-main" style="font-size:16px">ロビーへ戻る</div><div class="cta-sub">RETURN TO HOME</div></div><div class="cta-go">→</div></button>
        </section>
      </div></div>`; },
    mount(el) {
      const c = civ();
      // 数値のカウントアップ → レベルアップ演出(D35)→ 閉じると報酬欄を強調
      const count = (sel, to, fmt) => { const e = el.querySelector(sel); let v = 0; const t = UX.every(30, () => { v = Math.min(to, v + Math.ceil(to / 25)); e.textContent = fmt(v); if (v >= to) clearInterval(t); }); };
      UX.after(400, () => { count("[data-rate]", 18, (v) => "+" + v); count("[data-xp]", 420, (v) => "+" + v); el.querySelector("[data-rv]").textContent = "1,642"; el.querySelector("[data-xpbar]").style.width = "100%"; });
      UX.after(1700, () => UX.openDialog("levelup", { onClose: () => {
        el.querySelector("[data-lv]").innerHTML = `Lv.${c.lv} → <span style="color:var(--ok)">Lv.${c.lv + 1}</span> <span class="tag ok">LEVEL UP</span>`;
        el.querySelector("[data-unlock]").style.opacity = 1;
        el.querySelector(".rewards").classList.add("hl");
      } }));
      el.querySelector("[data-home]").addEventListener("click", () => { UX.state.match = null; UX.reset("home"); });
    },
  });

  // ───────── D35 レベルアップ / 開放演出 ─────────
  UX.dialogs.levelup = {
    opts: { kind: "modal", dark: true },
    render: () => { const c = civ(); return `<div class="dark" style="width:560px;padding:18px 22px 16px;background:radial-gradient(80% 120% at 50% 0%, #2a1d44, #0e161e 70%);color:#fff;clip-path:var(--cut);position:relative;overflow:hidden">
      <div style="position:absolute;inset:0;background:repeating-conic-gradient(from 0deg at 50% 0%, rgba(155,92,255,.12) 0 5deg, transparent 5deg 15deg);pointer-events:none"></div>
      <div style="position:relative;text-align:center"><div class="eyebrow" style="color:#c9a7ff">CIVILIZATION LEVEL UP · ${c.short}</div>
        <div style="display:flex;justify-content:center;align-items:center;gap:18px;margin:6px 0 10px"><span class="display" style="font-size:54px;color:rgba(255,255,255,.4)">${c.lv}</span><span class="mono" style="font-size:18px;color:rgba(255,255,255,.5)">→</span><span class="display" style="font-size:72px;position:relative">${c.lv + 1}<svg class="crayon-svg" style="left:-14px;top:-10px" width="80" height="90" viewBox="0 0 80 90"><path d="M50 4 C 76 14, 80 64, 46 82 S 2 70, 6 36 S 34 0, 62 12" stroke-width="2.6" style="stroke-dasharray:300;stroke-dashoffset:300;animation:mx-draw .9s .3s ease forwards"/></svg></span></div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;text-align:left">
          ${[["永続アドオン", "衛星照会"], ["物語の断章", "断章 03"], ["衣装の色違い", "夜間迷彩"], ["ボイス", "勝利 II"]].map(([k, v], i) => `<div style="padding:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.04);animation:ux-in-up .4s ${0.4 + i * 0.12}s both"><div class="ph" style="height:44px;margin-bottom:6px"><span class="ph-k" style="font-size:6.5px">UNLOCK</span></div><div class="eyebrow" style="color:rgba(255,255,255,.5)">${k}</div><b style="font-size:11px">${v}</b></div>`).join("")}
        </div>
        <button class="btn light" style="margin-top:12px" data-close>受け取る</button></div></div>`; },
  };

  // ───────── S08 導入(HUD の上でステップ案内) ─────────
  UX.css(`
  [data-screen=tutorial] .tu-hole { position: absolute; z-index: 40; border-radius: 4px; pointer-events: none; transition: all .35s cubic-bezier(.2,.8,.2,1); outline: 2px solid var(--signal); outline-offset: 3px; }
  [data-screen=tutorial] .tu-dim { position: absolute; z-index: 39; background: rgba(10,16,22,.55); backdrop-filter: grayscale(.7) brightness(.75); transition: all .35s cubic-bezier(.2,.8,.2,1); }
  [data-screen=tutorial] .tu-box { position: absolute; z-index: 41; width: 330px; display: grid; grid-template-columns: 64px 1fr; gap: 10px; padding: 10px 12px; background: var(--surface-solid); box-shadow: 0 20px 40px -16px rgba(0,0,0,.5); transition: all .35s cubic-bezier(.2,.8,.2,1); }
  [data-screen=tutorial] .tu-box .ph { height: 74px; }
  [data-screen=tutorial] .tu-box p { font-size: 11px; line-height: 1.6; margin: 3px 0 8px; }
  [data-screen=tutorial] .tu-dots { display: flex; gap: 3px; } [data-screen=tutorial] .tu-dots i { width: 14px; height: 3px; background: var(--line-2); } [data-screen=tutorial] .tu-dots i.on { background: var(--ink); }
  [data-screen=tutorial] .mx-dev { display: none; }
  [data-screen=tutorial] .screen > :not(.tu-hole):not(.tu-box):not(.tu-dim) { pointer-events: none; }
  `);
  const STEPS = [
    ["STEP 1 · 戦況", ".hud-top", "上の帯は各陣営のチケット。0 になった陣営は脱落する。色と記号で見分けろ。", "below"],
    ["STEP 2 · 部隊", ".squads", "これが部隊チップだ。チップを盤面の拠点までドラッグすると、その部隊が向かう。", "above"],
    ["STEP 3 · 目的地", ".mx-node.neutral", "先に盤面をタップして目的地を決め、あとからチップをタップしてもいい。", "below"],
    ["STEP 4 · 生産と研究", ".cmd-row", "BASE で部隊を生産、RESEARCH で研究。試合は止まらないから手早くな。", "above"],
    ["STEP 5 · 合図", ".signals", "味方には攻・守・退、他の陣営には共闘や休戦を送れる。三つ巴だ、使い分けろ。", "above"],
  ];
  UX.screen("tutorial", {
    title: "S08 導入", group: "起動", transition: "fade",
    render: () => window.MX.hudHTML(window.MX.initMatch(), { dev: false }),
    mount(el) {
      const c = civ(), scr = el.querySelector(".screen");
      scr.insertAdjacentHTML("beforeend", `<div class="tu-dim"></div><div class="tu-dim"></div><div class="tu-dim"></div><div class="tu-dim"></div><div class="tu-hole"></div><div class="tu-box">${D.ph("BUST", "", "tinted", `--tc:${c.c}`)}<div><div class="eyebrow ink" data-k></div><p data-t></p><div style="display:flex;align-items:center;gap:6px"><div class="tu-dots">${STEPS.map(() => "<i></i>").join("")}</div><div style="flex:1"></div><button class="btn sm ghost" data-skip>スキップ</button><button class="btn sm" data-next>次へ</button></div></div></div>`);
      let i = 0;
      const dr = () => document.getElementById("device").getBoundingClientRect();
      const show = () => {
        const [k, sel, t, where] = STEPS[i], tg = scr.querySelector(sel);
        const r = tg.getBoundingClientRect(), d = dr(), s = d.width / 900;
        const x = (r.left - d.left) / s, y = (r.top - d.top) / s, w = r.width / s, h = r.height / s;
        Object.assign(scr.querySelector(".tu-hole").style, { left: x - 4 + "px", top: y - 4 + "px", width: w + 8 + "px", height: h + 8 + "px" });
        const [a, b, c2, d2] = scr.querySelectorAll(".tu-dim"), L = x - 4, T = y - 4, R = x + w + 4, B = y + h + 4;
        Object.assign(a.style, { left: 0, top: 0, width: "900px", height: Math.max(0, T) + "px" });
        Object.assign(b.style, { left: 0, top: B + "px", width: "900px", height: Math.max(0, 420 - B) + "px" });
        Object.assign(c2.style, { left: 0, top: T + "px", width: Math.max(0, L) + "px", height: B - T + "px" });
        Object.assign(d2.style, { left: R + "px", top: T + "px", width: Math.max(0, 900 - R) + "px", height: B - T + "px" });
        const box = scr.querySelector(".tu-box");
        const bx = Math.max(10, Math.min(900 - 340, x + w / 2 - 165));
        box.style.left = bx + "px"; box.style.top = (where === "below" ? y + h + 14 : Math.max(10, y - 128)) + "px";
        box.querySelector("[data-k]").textContent = k; box.querySelector("[data-t]").textContent = `${c.leader}「${t}」`;
        box.querySelectorAll(".tu-dots i").forEach((d, j) => d.classList.toggle("on", j <= i));
        box.querySelector("[data-next]").textContent = i === STEPS.length - 1 ? "試合へ" : "次へ";
      };
      const finish = () => { UX.newMatch(); UX.go("match", {}, { transition: "dive" }); };
      scr.querySelector("[data-next]").addEventListener("click", () => { if (++i >= STEPS.length) finish(); else show(); });
      scr.querySelector("[data-skip]").addEventListener("click", finish);
      UX.after(50, show);
    },
  });
})();

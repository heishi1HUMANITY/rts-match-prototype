// 物語: 章一覧(S20)→ 章扉(S30f)→ ドラマプレイヤー(S30 / S30b / S30c / S30d / S30e)
// プレイヤーは台本(1行1命令)を順に解釈して進む。マルチエンドにせず、選択は返答だけ分岐して join で合流する。
(function () {
  const { CIVS } = D;
  const css = (id, text) => UX.css(text.replaceAll("&", `[data-screen=${id}]`));

  const CAST = {
    garcia: { name: "ガルシア", sub: "PMC · LEADER", c: "#ff6a1a", key: "GARCIA" },
    holm: { name: "ホルム", sub: "IPA · 機関", c: "#9aa7b2", key: "HOLM" },
    staff: { name: "機関職員", sub: "STAFF", c: "#6b7a5e", key: "STAFF" },
    crow: { name: "クロウ", sub: "INT", c: "#c99a2e", key: "CROW" },
  };
  const BG = { control_room: "国際機関 管制室(マットホワイト・ガラス)。昼・夜・非常灯の3差分", camp: "前線キャンプ(コンテナと仮設照明)" };

  // 台本(UIモック検討メモ 5.4 の形をそのまま配列にしたもの)
  const SCRIPTS = {
    "pmc-3": [
      { scene: "CASE NO. 4092-B · BRIEFING", mode: "radio", brief: ["川の北岸から開始", "橋 II を先に確保する", "終盤、中央水門が開く", "IPA とは休戦の余地あり"], callers: ["garcia", "holm", "crow"] },
      { say: "garcia", text: "こちらガルシア。作戦図を見てくれ。川を渡れるのは二か所だけだ。", now: 0 },
      { say: "holm", text: "確認した。規定どおり、三者で夢を開く。", now: 1 },
      { say: "garcia", text: "橋を取った方が、水門の開く時間に間に合う。── ホルム、そっちの部隊とは今回も殴り合いか?", now: 2 },
      { say: "holm", text: "それは君たちの動き次第だ。休戦の余地は残しておく。", now: 3 },
      { scene: "CHAPTER 03 · SCENE 2 / 3", mode: "real", bg: "control_room" },
      { show: "staff", at: "C", far: true, expr: "待機" },
      { show: "holm", at: "L", expr: "平静" },
      { show: "garcia", at: "RC", expr: "険しい" },
      { say: "holm", text: "今回の案件は三者。PMC、CORP、そして我々だ。規定どおり、夢の中で決着をつける。" },
      { say: "garcia", text: "規定、ね。その規定に、作戦図へ落書きする奴のことは書いてあるのか。" },
      { say: "garcia", text: "あの地図を描いたのは俺たちじゃない。夢の中に、誰かがもう一人いる。\nそれとも ── あんたたちは最初から知っていたのか、ホルム。" },
      { expr: "holm", value: "沈黙" },
      { say: "holm", text: "……規定上、答えられることはない。君がどう報告するかは、君が決めることだ。" },
      { choice: "q03_2", options: [{ k: "A", label: "ホルムを問い詰める", to: "a" }, { k: "B", label: "黙って地図を回収する", to: "b" }, { k: "C", label: "線のことは報告しない", to: "d", girl: "いわないで" }] },
      { label: "a" }, { expr: "garcia", value: "怒り" }, { say: "garcia", text: "答えられない、じゃない。答えたくないんだろう。" }, { expr: "holm", value: "平静" }, { say: "holm", text: "同じことだ、ガルシア。" }, { join: "s3" },
      { label: "b" }, { expr: "garcia", value: "平静" }, { say: "garcia", text: "……わかった。地図はこちらで預かる。" }, { join: "s3" },
      { label: "d" }, { scene: "CHAPTER 03 · ███████", mode: "dream" },
      { girl: "このせんから さきは" }, { girl: "だれも わたらないで" },
      { say: "garcia", text: "……応答しろ。地図がザ──書き換わ──", radio: true },
      { girl: "ねえ、きこえてる?" }, { join: "s3" },
      { label: "s3" }, { scene: "CHAPTER 03 · SCENE 3 / 3", mode: "real", bg: "control_room" },
      { hide: "staff" }, { show: "holm", at: "L", expr: "平静" }, { show: "garcia", at: "RC", expr: "平静" },
      { say: "holm", text: "次の案件は三日後だ。それまでに、地図の線が消えていればいいが。" },
      { say: "garcia", text: "消えないさ。……あれは、誰かが本気で引いた線だ。" },
      { end: true },
    ],
    generic: [
      { scene: "SCENE 1 / 1", mode: "real", bg: "camp" },
      { show: "garcia", at: "C", expr: "平静" },
      { say: "garcia", text: "契約どおりだ。前線、降下した。" },
      { say: "garcia", text: "……この章の本文はモックでは省略している。" },
      { end: true },
    ],
  };
  const CHAPTERS = { pmc: [["降下契約書", "夢に降りる前、契約書の最後の行に誰かの署名があった。"], ["前線の配当", "勝った案件の配当が、なぜか三者に等しく振り込まれる。"], ["紫の線が引かれた地図", "発電所の案件のあと、PMC の作戦図に誰も描いていない線が残っていた。ガルシアは国際機関の管制室へ向かう。"], ["水門の向こう側", ""], ["契約の終わり", ""]] };
  const chKey = (civ, ch) => `${civ}-${ch}`;
  const isRead = (civ, ch) => UX.state.read?.[chKey(civ, ch)] ?? ch < 3;

  // ───────── S20 物語(章一覧) ─────────
  css("story", `
  & .tabs2 { position: absolute; left: 12px; top: 54px; display: flex; gap: 3px; }
  & .tabs2 button { height: 26px; padding: 0 10px; font-family: var(--f-mono); font-size: 9.5px; font-weight: 700; background: var(--surface-solid); border: 1px solid var(--line); border-bottom: 2px solid var(--c); }
  & .tabs2 button.on { background: var(--ink); color: #fff; }
  & .list { position: absolute; left: 12px; top: 90px; bottom: 12px; width: 330px; display: flex; flex-direction: column; gap: 4px; }
  & .ch { display: grid; grid-template-columns: 34px 1fr auto; gap: 10px; align-items: center; padding: 8px 12px; background: var(--surface-solid); border: 1px solid var(--line); text-align: left; }
  & .ch .n { font-family: var(--f-display); font-weight: 700; font-size: 18px; }
  & .ch.on { box-shadow: 0 0 0 2px var(--ink); }
  & .ch.new { border-left: 3px solid var(--crayon); }
  & .ch.lock { background: transparent; border-style: dashed; color: var(--faint); }
  & .pv { position: absolute; left: 356px; right: 14px; top: 54px; bottom: 12px; display: grid; grid-template-rows: 1fr auto; overflow: hidden; }
  & .pv .ph { border: 0; }
  & .pv .b { padding: 12px 14px; display: flex; gap: 12px; align-items: center; }
  `);
  UX.screen("story", {
    title: "S20 物語(章一覧)", group: "ドラマ",
    render: (p) => {
      const civ = p.civ || "pmc", sel = p.ch ?? 3, chs = CHAPTERS.pmc;
      return `<div class="screen grid-bg">${D.topbar("STORY · FRAGMENTS", "物語の断章", `<span class="tag">11 / 30 開放</span>`)}
      <div class="tabs2">${D.CIV_ORDER.map((id) => `<button class="${id === civ ? "on" : ""}" data-civ="${id}" style="--c:${CIVS[id].c}">${CIVS[id].short}</button>`).join("")}</div>
      <nav class="list">${chs.map(([t], i) => { const ch = i + 1, open = ch <= 3, rd = isRead(civ, ch); return `<button class="ch ${ch === sel ? "on" : ""} ${open && !rd ? "new" : ""} ${open ? "" : "lock"}" data-ch="${ch}"><span class="n">0${ch}</span><div><b style="font-size:11px">${open ? t : "—"}</b><div class="tiny dim">${open ? (rd ? "既読" : "未読 · 約6分") : `文明 Lv.${7 + i - 2} で開放`}</div></div>${open && !rd ? '<span class="tag violet">NEW</span>' : ""}</button>`; }).join("")}</nav>
      <section class="panel marks pv">${D.ph("CHAPTER KEY ART", `第${sel}話 章扉の一枚絵 4:3`, "tinted t-d")}
        <div class="b"><div style="flex:1"><div class="eyebrow">CHAPTER 0${sel}</div><b style="font-size:15px">${chs[sel - 1][0]}</b><div class="tiny dim" style="margin-top:2px">${chs[sel - 1][1]}</div></div><button class="btn" data-go="chapter" data-params='{"civ":"${civ}","ch":${sel}}'>開く →</button></div></section></div>`;
    },
    mount(el, p) {
      for (const b of el.querySelectorAll("[data-civ]")) b.addEventListener("click", () => b.dataset.civ === "pmc" ? null : UX.toast(`${CIVS[b.dataset.civ].short} の断章(モックでは PMC のみ)`));
      for (const b of el.querySelectorAll("[data-ch]")) b.addEventListener("click", () => {
        const ch = Number(b.dataset.ch);
        if (ch > 3) return UX.toast(`第${ch}話: 文明 Lv を上げると開放`, "danger");
        if (ch === (p.ch ?? 3)) return UX.go("chapter", { civ: "pmc", ch });
        UX.go("story", { ...p, ch }, { replace: true, transition: "none" });
      });
    },
  });

  // ───────── S30f 章扉 ─────────
  css("chapter", `
  & .key { position: absolute; right: 0; top: 0; bottom: 0; width: 52%; border: 0; clip-path: polygon(14% 0, 100% 0, 100% 100%, 0 100%); animation: ux-in-r .5s cubic-bezier(.2,.8,.2,1); }
  & .doc { position: absolute; left: 34px; top: 30px; bottom: 26px; width: 430px; z-index: 3; display: flex; flex-direction: column; gap: 10px; }
  & .ep { font-family: var(--f-display); font-weight: 700; font-size: 64px; letter-spacing: -0.05em; line-height: .85; }
  & .ep small { font-size: 16px; letter-spacing: .1em; font-family: var(--f-mono); color: var(--dim); margin-left: 6px; }
  & .ttl { font-size: 24px; font-weight: 900; letter-spacing: .04em; line-height: 1.25; }
  & .cast { display: flex; gap: 8px; }
  & .cast > div { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 9px; font-weight: 700; }
  & .meta { display: flex; gap: 14px; } & .meta div { font-size: 10px; } & .meta .num { font-size: 15px; display: block; }
  & .bk { position: absolute; left: 10px; top: 8px; z-index: 4; }
  `);
  UX.screen("chapter", {
    title: "S30f 章扉", group: "ドラマ", transition: "fade",
    render: (p) => {
      const civ = p.civ || "pmc", ch = p.ch || 3, [t, lead] = CHAPTERS.pmc[ch - 1], rd = isRead(civ, ch);
      return `<div class="screen grid-bg">${D.ph("CHAPTER KEY ART", "章扉の一枚絵 4:3 / 作戦図と少女の線", "key tinted t-d")}
      <button class="btn sm light bk" data-back="story">← 一覧</button>
      <section class="doc"><div style="display:flex;gap:8px;align-items:center;margin-top:18px"><span class="docno">STORY · ${CIVS[civ].short} · FRAGMENT</span>${rd ? '<span class="tag ok">既読</span>' : '<span class="tag violet">NEW</span>'}<span class="stamp" style="margin-left:auto;color:var(--crayon)">記録外</span></div>
        <div class="ep">0${ch}<small>/ 12</small></div><div class="ttl">${t}</div>
        <p class="small" style="color:var(--ink-2);line-height:1.7">${lead}</p>
        <div><div class="eyebrow" style="margin-bottom:4px">CAST · 登場人物</div><div class="cast"><div>${D.phRound(40, "PT", "background:#ffe3d1")}ガルシア</div><div>${D.phRound(40)}ホルム</div>${ch === 3 ? `<div>${D.phRound(40, "?", "border-color:var(--crayon)")}<span style="color:var(--crayon)">───</span></div>` : ""}</div></div>
        <div class="meta"><div><span class="num">約 6 分</span><span class="dim">ボイス</span></div><div><span class="num">選択 ${ch === 3 ? 1 : 0}</span><span class="dim">返答が変わる</span></div><div><span class="num">${rd ? "—" : "+50"}</span><span class="dim">初回報酬 D</span></div></div>
        <div style="margin-top:auto;display:flex;gap:8px"><button class="btn ghost syn" style="height:auto">あらすじで済ませる</button>
          <button class="cta" style="flex:1;min-width:0" data-go="drama" data-tr="fade" data-params='{"civ":"${civ}","ch":${ch}}'><div><div class="cta-main">${rd ? "REREAD" : "READ"}</div><div class="cta-sub">第${ch}話を読む</div></div><div class="cta-go">→</div></button></div>
      </section>
      <svg class="crayon-svg" style="left:250px;top:110px;z-index:4" width="200" height="50" viewBox="0 0 200 50"><path d="M4 36 C 60 10, 120 44, 196 14" stroke-width="3"/></svg></div>`;
    },
    mount(el, p) {
      el.querySelector(".syn").addEventListener("click", () => UX.dialog(`<div class="dlg"><div class="dlg-head"><div class="eyebrow">SYNOPSIS · あらすじ</div><b style="font-size:14px">第${p.ch || 3}話 ${CHAPTERS.pmc[(p.ch || 3) - 1][0]}</b></div><div class="dlg-body" style="line-height:1.8">${CHAPTERS.pmc[(p.ch || 3) - 1][1]} ホルムは答えず、ガルシアは線のことを胸にしまう。夢の中では、誰かが「わたらないで」と書いていた。</div><div class="dlg-foot"><button class="btn ghost sm" data-close>戻る</button><button class="btn sm ok-read">既読にする</button></div></div>`, { kind: "modal", mount: (b, dlg) => b.querySelector(".ok-read").addEventListener("click", () => { dlg.close(); finish(p.civ || "pmc", p.ch || 3, true); }) }));
    },
  });

  // 読了: 既読と初回報酬
  function finish(civ, ch, summary) {
    const k = chKey(civ, ch), first = !isRead(civ, ch);
    UX.state.read = { ...(UX.state.read || {}), [k]: true };
    if (first) { UX.state.dreams += 50; UX.toast(`第${ch}話 既読${summary ? "(あらすじ)" : ""} · 初回報酬 D 50`, "ok"); }
    else UX.toast(`第${ch}話 既読`, "ok");
    UX.go("chapter", { civ, ch }, { replace: true, transition: "fade" });
  }

  // ───────── S30 ドラマプレイヤー ─────────
  css("drama", `
  & .dp { position: absolute; inset: 0; cursor: pointer; }
  & .dr-bg.ph { transition: opacity .4s; }
  & .slot { animation: ux-fade-in .35s ease; transition: left .35s ease, filter .2s, opacity .2s; }
  & .slot.out { opacity: 0 !important; }
  & .ui { transition: opacity .2s; }
  & .dp.hidden .ui { opacity: 0; pointer-events: none; }
  & .qm { z-index: 8; }
  & .qm button.on { background: var(--ink); color: #fff; border-color: var(--ink); }
  & .msg { cursor: pointer; }
  & .msg p { white-space: pre-wrap; min-height: 50px; }
  & .msg.radio-win { left: calc(50% + 105px); width: 640px; }
  & .msg.off { display: none; }
  & .board { position: absolute; inset: 0; display: none; }
  & .dp.m-radio .board { display: block; }
  & .dp.m-radio .dr-bg, & .dp.m-radio .slot { display: none; }
  & .callers { position: absolute; left: 14px; top: 64px; z-index: 5; display: none; flex-direction: column; gap: 6px; }
  & .dp.m-radio .callers { display: flex; }
  & .caller { display: grid; grid-template-columns: 54px 1fr; gap: 8px; width: 196px; padding: 6px; background: var(--surface); backdrop-filter: var(--glass-blur); border: 1px solid var(--line); transition: box-shadow .2s, opacity .2s; }
  & .caller .ph { height: 56px; }
  & .caller .st { font-family: var(--f-mono); font-size: 8px; letter-spacing: .12em; color: var(--dim); margin-top: 2px; }
  & .caller.talk { box-shadow: 0 0 0 1.5px var(--signal), var(--shadow-sm); background: rgba(255,255,255,.95); }
  & .caller.talk .st { color: var(--signal); }
  & .caller.talk .st::before { content: "● "; }
  & .brief { position: absolute; right: 14px; top: 64px; width: 200px; z-index: 5; padding: 8px 10px; display: none; }
  & .dp.m-radio .brief { display: block; }
  & .brief li { list-style: none; display: flex; gap: 6px; font-size: 9.5px; padding: 3px 0; border-bottom: 1px solid var(--line); transition: color .2s; }
  & .brief li span { font-family: var(--f-mono); font-size: 8.5px; color: var(--dim); width: 14px; }
  & .brief li.now { font-weight: 700; } & .brief li.now span { color: var(--signal); }
  & .dream { position: absolute; inset: 0; display: none; }
  & .dp.m-dream .dream { display: block; }
  & .dp.m-dream .dr-bg.ph, & .dp.m-dream .slot { display: none; }
  & .dream { background: radial-gradient(80% 90% at 50% 40%, #2a1d44, #0d0a16 75%); }
  & .dp.m-dream .scene-tag .docno { background: rgba(14,22,30,.6); color: rgba(255,255,255,.6); border-left-color: var(--crayon); }
  & .dream .paper { position: absolute; left: 50%; top: 50%; width: 560px; height: 300px; transform: translate(-50%,-52%) rotate(-2deg); background: linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px); background-size: 24px 24px; border: 1px solid rgba(255,255,255,.12); }
  & .dream .girl { position: absolute; left: 50%; bottom: 0; height: 82%; width: 210px; transform: translateX(-50%); border-color: rgba(123,44,255,.6); animation: ux-fade-in 1.2s ease; }
  & .dream .crayon-text { animation: none; }
  & .radio-mini { position: absolute; left: 14px; bottom: 14px; width: 270px; z-index: 6; display: none; gap: 8px; padding: 7px 9px; background: rgba(14,22,30,.85); color: rgba(255,255,255,.85); border: 1px solid rgba(255,255,255,.12); }
  & .radio-mini.on { display: flex; animation: ux-in-up .25s; }
  & .radio-mini p { font-size: 9.5px; line-height: 1.5; }
  & .chs { position: absolute; left: 50%; top: 58px; transform: translateX(-50%); width: 430px; z-index: 9; display: none; flex-direction: column; gap: 6px; cursor: default; }
  & .chs.on { display: flex; animation: ux-in-up .25s; }
  & .opts { display: flex; flex-direction: column; gap: 6px; }
  & .opt { width: 100%; position: relative; display: grid; grid-template-columns: 30px 1fr auto; align-items: center; gap: 10px; height: 44px; padding: 0 14px 0 0; background: rgba(255,255,255,.96); border: 1px solid var(--line-2); box-shadow: var(--shadow-sm); text-align: left; }
  & .opt .k { height: 100%; display: grid; place-items: center; background: var(--surface-sunk); border-right: 1px solid var(--line); font-family: var(--f-mono); font-weight: 700; font-size: 11px; }
  & .opt b { font-size: 12.5px; }
  & .opt .eff { font-family: var(--f-mono); font-size: 8px; color: var(--dim); }
  & .opt:hover { box-shadow: 0 0 0 2px var(--ink); } & .opt:hover .k { background: var(--ink); color: #fff; }
  & .opt.read { opacity: .6; }
  & .opt.girl b { text-decoration: line-through; text-decoration-color: var(--crayon); text-decoration-thickness: 2px; color: var(--dim); }
  & .opt .gw { position: absolute; right: 70px; top: 18px; font-size: 15px; transform: rotate(-6deg); }
  & .ctimer { height: 3px; background: var(--line); position: relative; }
  & .ctimer i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--ink); animation: ux-ctimer 10s linear forwards; }
  @keyframes ux-ctimer { from { width: 100%; } to { width: 0; } }
  & .veil { position: absolute; inset: 0; z-index: 4; background: rgba(233,237,241,.45); backdrop-filter: blur(2px); display: none; }
  & .veil.on { display: block; }
  & .skipping { position: absolute; right: 14px; top: 40px; z-index: 8; font-family: var(--f-mono); font-size: 9px; letter-spacing: .2em; color: var(--crayon); display: none; }
  & .dp.skip .skipping { display: block; }
  & .tap { position: absolute; right: 18px; bottom: 16px; z-index: 6; font-family: var(--f-mono); font-size: 9px; letter-spacing: .2em; color: rgba(217,200,255,.7); display: none; }
  & .dp.m-dream .tap { display: block; }
  `);
  const DREAM_POS = [[96, 96, 24, -5], [150, 140, 24, -3], [540, 300, 16, -4], [300, 240, 20, 2]];

  UX.screen("drama", {
    title: "S30 ドラマプレイヤー", group: "ドラマ", transition: "fade",
    render: () => `<div class="screen">
      <div class="dp m-real">
        <div class="ph dr-bg"><span class="ph-k">BACKGROUND</span><span class="ph-d bgd"></span></div>
        <div class="board"><div class="board-ph"><div class="river" style="left:-40px;right:-40px;top:240px;height:26px;transform:rotate(-8deg)"></div><div class="node t-a" style="left:360px;top:300px"></div><div class="node big" style="left:560px;top:190px;border-style:dashed"></div><div class="node t-b" style="left:720px;top:290px"></div></div>
          <div style="position:absolute;left:560px;top:190px;width:46px;height:46px;transform:translate(-50%,-50%);border:2px solid var(--danger);border-radius:50%;box-shadow:0 0 0 8px rgba(226,51,79,.12)" class="pulse"></div></div>
        <div class="cast"></div>
        <div class="dream"><div class="paper"></div><div class="ph girl"><span class="ph-k" style="color:#d9c8ff">GIRL · CRAYON LINE</span><span class="ph-d">少女 全身(クレヨンの線画)</span></div><div class="words"></div><div class="tap">TAP ▼</div></div>
        <section class="callers ui"></section>
        <aside class="panel marks brief ui"><div class="eyebrow ink" style="margin-bottom:4px">BRIEFING · 要点</div><ul></ul></aside>
        <div class="veil"></div>
        <div class="scene-tag ui"><span class="docno sc"></span><span class="realm"><i></i><span class="rl">REALITY</span></span></div>
        <div class="qm ui"><button data-q="log">LOG</button><button data-q="auto">AUTO</button><button data-q="skip">SKIP</button><button data-q="hide">HIDE</button><button data-q="exit">✕</button></div>
        <div class="skipping">SKIPPING ▸▸</div>
        <section class="chs ui"><div style="display:flex;justify-content:space-between;align-items:end"><span class="eyebrow ink">RESPONSE FORM · 回答を選択</span><span class="tiny dim">返答だけが変わる · 本筋は合流</span></div><div class="ctimer"><i></i></div><div class="opts"></div></section>
        <section class="msg marks ui"><div class="plate"><b class="who"></b><span class="sub"></span></div><span class="voice">▶ VOICE</span><p class="txt"></p><span class="next">▼</span></section>
        <div class="radio-mini ui">${D.ph("BUST", "", "tinted t-a", "width:40px;height:44px;flex:none")}<div><div class="eyebrow" style="color:var(--signal)">CH-A · 信号微弱</div><p class="rtxt"></p></div></div>
      </div></div>`,
    mount(el, p) {
      const civ = p.civ || "pmc", ch = p.ch || 3;
      const script = SCRIPTS[chKey(civ, ch)] || SCRIPTS.generic;
      const $ = (s) => el.querySelector(s);
      const dp = $(".dp"), msg = $(".msg"), txt = $(".txt"), scr = el.querySelector(".screen");
      const st = { i: 0, cast: {}, mode: "real", typing: null, full: "", auto: false, skip: false, wait: null, log: [], callers: [], dreamN: 0, done: false };
      const ui = (q) => el.querySelector(`[data-q=${q}]`);

      const drawCast = () => {
        const speaker = st.speaker;
        $(".cast").innerHTML = Object.entries(st.cast).map(([id, c]) => { const x = CAST[id]; return `<div class="ph tinted slot ${c.at} ${c.far ? "far" : ""} ${speaker && speaker !== id ? "idle" : ""}" style="--tc:${x.c}"><span class="face"></span><span class="expr">${x.key} · ${c.expr || "—"}</span><span class="ph-k">${x.key}</span><span class="ph-d">${x.name} 膝上 3:4 / 表情差分</span></div>`; }).join("");
      };
      const drawCallers = () => {
        $(".callers").innerHTML = st.callers.map((id) => { const x = CAST[id], talk = st.speaker === id; return `<div class="caller ${talk ? "talk" : ""}">${D.ph("BUST", "", "tinted", `--tc:${x.c}`)}<div><b style="font-size:10.5px">${x.name}</b> <span class="tag" style="height:14px">${x.sub.split(" ")[0]}</span><div class="st">${talk ? "TRANSMITTING" : "STANDBY"}</div></div></div>`; }).join("");
      };
      const setMode = (m) => {
        st.mode = m;
        dp.classList.remove("m-real", "m-radio", "m-dream"); dp.classList.add(`m-${m}`);
        scr.classList.toggle("dark", m === "dream");
        msg.classList.toggle("radio-win", m === "radio");
        msg.classList.toggle("off", m === "dream");
        $(".realm").classList.toggle("dream", m === "dream");
        $(".realm").style.background = m === "radio" ? "var(--signal)" : "";
        $(".rl").textContent = { real: "REALITY", radio: "RADIO · 作戦前通信", dream: "DREAM · 記録外" }[m];
        if (m === "dream") { el.querySelector(".words").innerHTML = ""; st.dreamN = 0; }
        $(".radio-mini").classList.remove("on");
      };
      const typeInto = (node, text, speed, done) => {
        node.textContent = ""; st.full = text; let k = 0;
        clearInterval(st.typing);
        if (st.skip) { node.textContent = text; st.typing = null; return done(); }
        st.typing = setInterval(() => { if (!node.isConnected) return clearInterval(st.typing); node.textContent = text.slice(0, ++k); if (k >= text.length) { clearInterval(st.typing); st.typing = null; st.typingNode = null; done(); } }, speed);
        UX.timers.add(st.typing); st.typingNode = node;
      };
      const lineDone = () => {
        if (st.skip) st.wait = UX.after(110, next);
        else if (st.auto) st.wait = UX.after(1100 + st.full.length * 35, next);
      };
      const showChoice = (c) => {
        const prev = UX.state.choices?.[c.choice];
        $(".opts").innerHTML = c.options.map((o) => `<button class="opt ${prev === o.k ? "read" : ""} ${o.girl ? "girl" : ""}" data-k="${o.k}" data-to="${o.to}" data-label="${o.label}"><span class="k">${o.k}</span><b>${o.label}</b><span class="eff">${prev === o.k ? "選択済み" : o.girl ? "→ 夢の挿話" : "→ 返答"}</span>${o.girl ? `<span class="crayon-text gw">${o.girl}</span>` : ""}</button>`).join("");
        $(".chs").classList.add("on"); $(".veil").classList.add("on");
        st.skip = false; ui("skip").classList.remove("on"); dp.classList.remove("skip");
        st.auto = false; ui("auto").classList.remove("on");
        const pick = (b) => {
          $(".chs").classList.remove("on"); $(".veil").classList.remove("on");
          UX.state.choices = { ...(UX.state.choices || {}), [c.choice]: b.dataset.k };
          st.log.push({ sys: `回答 ${b.dataset.k}「${b.dataset.label}」を選択` });
          jump(b.dataset.to); next();
        };
        for (const b of el.querySelectorAll(".opt")) b.addEventListener("click", (e) => { e.stopPropagation(); clearTimeout(st.ctimer); pick(b); });
        st.ctimer = UX.after(10000, () => $(".chs").classList.contains("on") && pick(el.querySelector(".opt")));
      };
      const jump = (label) => { const j = script.findIndex((c) => c.label === label); if (j >= 0) st.i = j + 1; };

      function next() {
        if (st.done) return;
        clearTimeout(st.wait);
        while (st.i < script.length) {
          const c = script[st.i++];
          if (c.scene) $(".sc").textContent = c.scene;
          if (c.mode) setMode(c.mode);
          if (c.bg) $(".bgd").textContent = `背景 16:9 / ${BG[c.bg]}`;
          if (c.brief) $(".brief ul").innerHTML = c.brief.map((b, i) => `<li><span>0${i + 1}</span>${b}</li>`).join("");
          if (c.callers) { st.callers = c.callers; drawCallers(); }
          if (c.show) { st.cast[c.show] = { at: c.at, expr: c.expr, far: c.far }; drawCast(); }
          if (c.hide) { delete st.cast[c.hide]; drawCast(); }
          if (c.expr && c.value) { if (st.cast[c.expr]) st.cast[c.expr].expr = c.value; drawCast(); }
          if (c.join) { jump(c.join); continue; }
          if (c.label) continue; // 分岐の目印。分岐は必ず join で終わるので、順に流れ込むことはない
          if (c.choice) return showChoice(c);
          if (c.say) {
            const x = CAST[c.say];
            st.speaker = c.say;
            if (c.radio || st.mode === "dream") {
              const rm = $(".radio-mini"); rm.classList.add("on");
              st.log.push({ who: x.name, sub: x.sub, text: c.text });
              return typeInto($(".rtxt"), `${x.name}「${c.text}」`, 30, lineDone);
            }
            if (c.now !== undefined) for (const [i, li] of [...el.querySelectorAll(".brief li")].entries()) li.classList.toggle("now", i === c.now);
            drawCast(); drawCallers();
            $(".who").textContent = x.name; $(".sub").textContent = st.mode === "radio" ? "CH-A · 作戦前通信" : x.sub;
            $(".plate b").style.borderLeftColor = x.c;
            st.log.push({ who: x.name, sub: x.sub, text: c.text });
            return typeInto(txt, c.text, 28, lineDone);
          }
          if (c.girl) {
            const [x, y, fs, r] = DREAM_POS[st.dreamN++ % DREAM_POS.length];
            const w = UX.h(`<div class="crayon-text" style="left:${x}px;top:${y}px;font-size:${fs}px;transform:rotate(${r}deg)"></div>`);
            el.querySelector(".words").appendChild(w);
            st.log.push({ girl: true, text: c.girl });
            return typeInto(w, c.girl, 90, lineDone);
          }
          if (c.end) {
            st.done = true; clearInterval(st.typing);
            $(".veil").classList.add("on");
            return UX.after(st.skip ? 100 : 500, () => finish(civ, ch));
          }
        }
      }
      const advance = () => {
        if (dp.classList.contains("hidden")) { dp.classList.remove("hidden"); return; }
        if ($(".chs").classList.contains("on") || st.done) return;
        if (st.typing) { clearInterval(st.typing); st.typing = null; if (st.typingNode) st.typingNode.textContent = st.full; return lineDone(); }
        next();
      };
      dp.addEventListener("click", (e) => { if (e.target.closest(".qm, .chs")) return; advance(); });
      ui("auto").addEventListener("click", () => { st.auto = !st.auto; ui("auto").classList.toggle("on", st.auto); if (st.auto && !st.typing) next(); });
      ui("skip").addEventListener("click", () => { st.skip = !st.skip; ui("skip").classList.toggle("on", st.skip); dp.classList.toggle("skip", st.skip); if (st.skip) advance(); });
      ui("hide").addEventListener("click", () => dp.classList.add("hidden"));
      ui("exit").addEventListener("click", () => UX.dialog(`<div class="dlg" style="width:340px"><div class="dlg-head"><b style="font-size:13px">ドラマを中断しますか</b></div><div class="dlg-body">続きは章扉から最初に戻って読めます。</div><div class="dlg-foot"><button class="btn ghost sm" data-close>続ける</button><button class="btn sm q-exit">中断する</button></div></div>`, { kind: "modal", mount: (b, d) => b.querySelector(".q-exit").addEventListener("click", () => { d.close(); UX.back("story"); }) }));
      ui("log").addEventListener("click", () => {
        st.auto = false; ui("auto").classList.remove("on");
        UX.dialog(`<div class="dlg" style="width:640px;max-height:380px;display:flex;flex-direction:column"><div class="dlg-head" style="display:flex;align-items:center;gap:10px"><div style="flex:1"><div class="eyebrow">TRANSCRIPT · 通信記録 · S30e</div><b style="font-size:13px">第${ch}話 ${CHAPTERS.pmc[ch - 1][0]}</b></div><button class="btn sm light" data-close>閉じる ✕</button></div>
          <div style="overflow:auto;flex:1">${st.log.map((l, i) => l.sys ? `<div style="padding:7px 14px;background:var(--surface-sunk);border-bottom:1px solid var(--line);font-size:9.5px;color:var(--ink-2)">記録 · ${l.sys}</div>` : `<div style="display:grid;grid-template-columns:92px 1fr 28px;gap:10px;padding:7px 14px;border-bottom:1px solid var(--line);${i === st.log.length - 1 ? "box-shadow:inset 3px 0 0 var(--ink);" : ""}"><div style="font-size:10.5px;font-weight:700;border-left:3px solid ${l.girl ? "var(--crayon)" : "var(--line-2)"};padding-left:6px;${l.girl ? "color:var(--crayon)" : ""}">${l.girl ? "───" : l.who}<small style="display:block;font-family:var(--f-mono);font-size:7.5px;color:var(--dim);font-weight:400">${l.girl ? "UNKNOWN" : l.sub}</small></div><p style="font-size:11px;line-height:1.6;${l.girl ? "color:var(--crayon);font-family:Yomogi,var(--f-body);font-size:13px" : ""}">${l.text}</p><button class="btn sm ghost" style="padding:0;width:24px" data-toast="ボイスを再生">▶</button></div>`).join("")}</div></div>`, { kind: "modal", mount: (b) => { const sc = b.querySelector("[style*='overflow:auto']"); sc.scrollTop = sc.scrollHeight; } });
      });
      next();
    },
  });

})();

// 試合外の画面: 文明研究・指導者・装備庫・パス・お知らせ・設定・通報管理・プロフィール・ランク・ランキング・戦績・観戦・イベント・ログイン・メンテナンス
(function () {
  const { CIVS, CIV_ORDER } = D;
  // CSS の "&" を [data-screen=id] に置き換えて登録する
  const css = (id, text) => UX.css(text.replaceAll("&", `[data-screen=${id}]`));
  const tb = (eyebrow, title, right = "") => D.topbar(eyebrow, title, right);

  // ───────── S13 文明研究 一覧 ─────────
  css("civ_list", `
  & .grid { position: absolute; inset: 44px 0 0 0; padding: 12px 16px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
  & .civ { position: relative; display: flex; flex-direction: column; text-align: left; background: var(--surface-solid); border: 1px solid var(--line); box-shadow: var(--shadow-sm); overflow: hidden; transition: transform .15s; }
  & .civ:hover { transform: translateY(-3px); }
  & .civ .top { height: 4px; background: var(--c); }
  & .civ .ph { height: 128px; border: 0; border-bottom: 1px dashed var(--line-2); }
  & .civ .lv { position: absolute; right: 8px; top: 10px; z-index: 2; text-align: right; }
  & .civ .lv .num { font-size: 26px; line-height: 1; }
  & .civ .short { position: absolute; left: 8px; top: 12px; z-index: 2; background: var(--c); border-color: var(--c); }
  & .civ .body { padding: 8px 9px; display: flex; flex-direction: column; gap: 3px; flex: 1; }
  & .civ .body b { font-size: 11px; }
  & .civ .bar > i { background: var(--c); }
  & .civ .next { margin-top: auto; font-size: 9px; padding-top: 5px; border-top: 1px solid var(--line); }
  & .civ .next .k { display: block; font-family: var(--f-mono); font-size: 7.5px; letter-spacing: .14em; color: var(--dim); }
  `);
  const XP = { pmc: [3840, 6000, 42, "永続「衛星照会」"], corp: [1200, 4000, 18, "断章 第3話"], soc: [880, 2000, 9, "永続「広域光学」"], ipa: [2900, 5000, 26, "断章 第4話"], fnd: [80, 1000, 1, "永続「前方集積」"], int: [1500, 3000, 12, "衣装「夜間迷彩」"] };
  UX.screen("civ_list", {
    title: "S13 文明研究", group: "育成・収集",
    render: () => `<div class="screen grid-bg">${tb("CIVILIZATION RESEARCH", "文明研究", `<div class="tabs"><span class="tab on">文明 <span class="count">6</span></span><span class="tab" data-toast="称号一覧(モック)">称号 <span class="count">14</span></span><span class="tab" data-go="story">断章 <span class="count">11/30</span></span></div><span class="tag">総XP 48,210</span>`)}
      <main class="grid">${CIV_ORDER.map((id) => { const c = CIVS[id], x = XP[id]; return `<button class="civ" data-go="civ_detail" data-params='{"civ":"${id}"}' style="--c:${c.c}"><div class="top"></div><span class="tag solid short">${c.short}</span><div class="lv"><div class="eyebrow">LV</div><div class="num">${c.lv}</div></div>${D.ph("LEADER", `${c.leader} 胸像 3:4`, "tinted", `--tc:${c.c}`)}<div class="body"><b>${c.name}</b><span class="tiny dim">${c.tagline} · ${x[2]}試合</span><div class="bar"><i style="width:${(x[0] / x[1]) * 100}%"></i></div><span class="tiny mono dim">XP ${x[0].toLocaleString()} / ${x[1].toLocaleString()}</span><div class="next"><span class="k">NEXT · LV${c.lv + 1}</span>${x[3]}</div></div></button>`; }).join("")}</main></div>`,
  });

  // ───────── S13b 文明詳細 ─────────
  css("civ_detail", `
  & .wrap { position: absolute; inset: 44px 0 0 0; display: grid; grid-template-columns: 250px 1fr 250px; }
  & .art { position: relative; overflow: hidden; background: var(--hatch), radial-gradient(90% 70% at 50% 80%, color-mix(in srgb, var(--c) 40%, #fff), transparent 75%), #e6eaee; border-right: 1px solid var(--line); }
  & .art .ph { position: absolute; left: 22px; right: 22px; top: 18px; bottom: 0; border-bottom: 0; }
  & .art .word { position: absolute; left: 6px; bottom: -14px; font-family: var(--f-display); font-weight: 700; font-size: 96px; letter-spacing: -.06em; color: transparent; -webkit-text-stroke: 1px var(--c); z-index: 2; }
  & .art .plate { position: absolute; left: 12px; top: 12px; z-index: 2; background: rgba(255,255,255,.88); padding: 6px 10px; }
  & .mid { padding: 12px 14px; display: flex; flex-direction: column; gap: 5px; }
  & .ad { display: grid; grid-template-columns: 38px 1fr auto; align-items: center; gap: 10px; padding: 7px 10px; background: var(--surface-solid); border: 1px solid var(--line); text-align: left; }
  & .ad .lvk { font-family: var(--f-mono); font-size: 9px; font-weight: 700; text-align: center; padding: 3px 0; border: 1px solid var(--line-2); }
  & .ad.open .lvk { background: var(--ink); color: #fff; border-color: var(--ink); }
  & .ad.lock { opacity: .5; }
  & .right { padding: 12px 14px 12px 0; display: flex; flex-direction: column; gap: 5px; }
  & .frag { display: grid; grid-template-columns: 28px 1fr auto; gap: 8px; align-items: center; padding: 7px 10px; background: var(--surface-solid); border: 1px solid var(--line); text-align: left; font-size: 10px; }
  & .frag .n { font-family: var(--f-mono); font-size: 9px; color: var(--dim); }
  & .frag.new { border-left: 3px solid var(--crayon); }
  & .frag.lock { color: var(--faint); background: transparent; border-style: dashed; }
  & .thumbs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-top: auto; }
  & .thumbs .ph { height: 46px; }
  `);
  const PERMS = [["前方集積", "開始補給 +150", 2], ["複合装甲", "部隊HP +10%", 4], ["広域光学", "視界 +15%", 6], ["先遣斥候", "開始時に斥候1部隊", 8], ["衛星照会", "10秒間マップ全体を見る", 9]];
  const FRAGS = ["降下契約書", "前線の配当", "紫の線が引かれた地図", "水門の向こう側", "契約の終わり"];
  UX.screen("civ_detail", {
    title: "S13b 文明詳細", group: "育成・収集",
    render: (p) => {
      const c = CIVS[p.civ || "pmc"];
      return `<div class="screen" style="--c:${c.c}">${tb(`CIVILIZATION · ${c.short}`, c.name, `<button class="btn sm ghost" data-toast="試合内の研究ツリー(閲覧専用)を開く想定">研究ツリーを見る</button>`)}
      <div class="wrap">
        <section class="art">${D.ph("LEADER", `${c.leader} 立ち絵 膝上`, "tinted", `--tc:${c.c}`)}<div class="word">${c.short}</div><div class="plate"><div class="eyebrow">LV ${c.lv} · ${c.leader}</div><b style="font-size:13px">${c.tagline}</b></div></section>
        <section class="mid"><div class="eyebrow ink">PERMANENT ADD-ONS · 永続アドオン</div>
          ${PERMS.map(([n, d, lv]) => `<button class="ad ${lv <= c.lv ? "open" : "lock"}" ${lv > c.lv ? `data-toast="${n}: 文明 Lv.${lv} で開放"` : `data-toast="${n}: 試合前の装備で選べます"`}><span class="lvk">LV${lv}</span><div><b style="font-size:11px">${n}</b><div class="tiny dim">${d}</div></div><span class="tiny ${lv <= c.lv ? "" : "lock"}">${lv <= c.lv ? "開放済み" : "未開放"}</span></button>`).join("")}
        </section>
        <section class="right"><div class="eyebrow ink">FRAGMENTS · 物語の断章</div>
          ${FRAGS.map((f, i) => { const open = i < 3; return `<button class="frag ${i === 2 ? "new" : ""} ${open ? "" : "lock"}" ${open ? `data-go="chapter" data-params='{"civ":"${c.id}","ch":${i + 1}}'` : `data-toast="第${i + 1}話: 文明 Lv.${c.lv + i - 1} で開放"`}><span class="n">0${i + 1}</span><span>${open ? f : "—"}</span>${i === 2 ? '<span class="tag violet">NEW</span>' : open ? '<span class="tiny dim">既読</span>' : ""}</button>`; }).join("")}
          <div class="eyebrow" style="margin-top:6px">COSTUME · VOICE</div>
          <div class="thumbs"><button data-go="leader" data-params='{"civ":"${c.id}"}'>${D.ph("COSTUME", "", "")}</button><button data-go="leader" data-params='{"civ":"${c.id}"}'>${D.ph("COSTUME", "", "")}</button><button data-toast="${c.leader}: ボイス再生(モック)">${D.ph("VOICE ▸", "", "")}</button></div>
        </section>
      </div></div>`;
    },
  });

  // ───────── S14 指導者 / 衣装 ─────────
  css("leader", `
  & .rail { position: absolute; left: 12px; top: 56px; bottom: 12px; width: 120px; display: flex; flex-direction: column; gap: 4px; }
  & .rail button { flex: 1; display: flex; align-items: center; gap: 8px; padding: 0 8px; background: var(--surface-solid); border: 1px solid var(--line); border-left: 3px solid var(--c); text-align: left; font-size: 10px; font-weight: 700; }
  & .rail button.on { background: var(--ink); color: #fff; }
  & .stage { position: absolute; left: 144px; top: 44px; bottom: 0; width: 360px; overflow: hidden; background: var(--hatch), radial-gradient(70% 80% at 50% 70%, color-mix(in srgb, var(--c) 36%, #fff), transparent 75%); }
  & .stage .ph { position: absolute; left: 60px; right: 60px; top: 14px; bottom: 0; border-bottom: 0; animation: ux-leader-in .4s cubic-bezier(.2,.8,.2,1); }
  & .stage .en { position: absolute; left: 10px; bottom: 8px; z-index: 2; font-family: var(--f-display); font-weight: 700; font-size: 54px; letter-spacing: -.05em; line-height: .9; }
  & .side { position: absolute; right: 14px; top: 56px; bottom: 12px; width: 370px; display: flex; flex-direction: column; gap: 8px; }
  & .costumes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  & .cos { text-align: left; background: var(--surface-solid); border: 1px solid var(--line); padding: 4px; }
  & .cos .ph { height: 48px; }
  & .cos.sel { box-shadow: 0 0 0 2px var(--ink); }
  & .cos.lock { opacity: .5; }
  & .cos b { display: block; font-size: 9.5px; margin-top: 3px; }
  & .voices { display: flex; flex-direction: column; }
  & .vo { display: grid; grid-template-columns: 24px 1fr auto; gap: 8px; align-items: center; padding: 3px 4px; border-bottom: 1px solid var(--line); text-align: left; font-size: 10px; }
  & .vo .pl { width: 22px; height: 22px; border: 1px solid var(--line-2); display: grid; place-items: center; font-size: 9px; }
  & .vo.playing .pl { background: var(--signal); color: #fff; border-color: var(--signal); }
  & .vo .wv { display: none; gap: 2px; align-items: center; height: 12px; }
  & .vo.playing .wv { display: flex; }
  & .vo .wv i { width: 2px; background: var(--signal); animation: ux-wave .6s ease-in-out infinite alternate; }
  `);
  const COSTUMES = [["現実の制服", "標準", true], ["夢の姿", "標準", true], ["夜間迷彩", "ショップ", false], ["式典礼装", "パス S3", false]];
  const VOICES = ["試合開始", "拠点制圧", "合図: 共闘", "勝利"];
  UX.screen("leader", {
    title: "S14 指導者 / 衣装", group: "育成・収集",
    render: (p) => {
      const c = CIVS[p.civ || UX.state.homeCiv];
      const cos = UX.state.costume?.[c.id] ?? 0;
      return `<div class="screen grid-bg" style="--c:${c.c}">${tb("LEADER · WARDROBE", "指導者 / 衣装", D.wallet())}
      <nav class="rail">${CIV_ORDER.map((id) => `<button class="${id === c.id ? "on" : ""}" data-civ="${id}" style="--c:${CIVS[id].c}">${D.phRound(24)}<div>${CIVS[id].leader}<div class="mono tiny" style="opacity:.6">${CIVS[id].short}</div></div></button>`).join("")}</nav>
      <section class="stage">${D.ph("LEADER · FULL BODY", `${c.leader} 全身 / 衣装「${COSTUMES[cos][0]}」`, "tinted", `--tc:${c.c}`)}<div class="en">${c.en}</div></section>
      <aside class="side">
        <div><div class="eyebrow ink">COSTUME · 衣装</div><div class="costumes" style="margin-top:4px">${COSTUMES.map(([n, s, own], i) => `<button class="cos ${i === cos ? "sel" : ""} ${own ? "" : "lock"}" data-cos="${i}" data-own="${own}">${D.ph("COS", "")}<b>${n}</b><span class="tiny dim">${own ? (i === cos ? "装備中" : "所持") : s}</span></button>`).join("")}</div></div>
        <div class="panel" style="padding:6px 10px"><div class="eyebrow ink">VOICE · ボイス試聴</div><div class="voices">${VOICES.map((v, i) => `<button class="vo" data-vo="${i}"><span class="pl">▶</span><span>${v}</span><span class="wv"><i></i><i style="animation-delay:.2s"></i><i style="animation-delay:.1s"></i><i style="animation-delay:.3s"></i></span></button>`).join("")}</div></div>
        <button class="cta home-set" style="min-width:0;height:46px;margin-top:auto"><div><div class="cta-main" style="font-size:16px">${UX.state.homeCiv === c.id ? "ホームに表示中" : "ホームに表示"}</div><div class="cta-sub">ホームの立ち絵と背景をこの指導者にする</div></div><div class="cta-go">✓</div></button>
      </aside></div>`;
    },
    mount(el, p) {
      const civ = p.civ || UX.state.homeCiv;
      for (const b of el.querySelectorAll("[data-civ]")) b.addEventListener("click", () => UX.go("leader", { civ: b.dataset.civ }, { replace: true, transition: "none" }));
      for (const b of el.querySelectorAll("[data-cos]")) b.addEventListener("click", () => {
        if (b.dataset.own !== "true") return UX.go("shop", { cat: "cosmetic" });
        UX.state.costume = { ...(UX.state.costume || {}), [civ]: Number(b.dataset.cos) };
        UX.go("leader", { civ }, { replace: true, transition: "none" });
        UX.toast(`衣装を変更: ${COSTUMES[b.dataset.cos][0]}`);
      });
      for (const b of el.querySelectorAll("[data-vo]")) b.addEventListener("click", () => {
        for (const x of el.querySelectorAll("[data-vo]")) x.classList.toggle("playing", x === b && !b.classList.contains("playing"));
        if (b.classList.contains("playing")) { UX.toast(`${CIVS[civ].leader}「${VOICES[b.dataset.vo]}」を再生`, "signal"); UX.after(2200, () => b.classList.remove("playing")); }
      });
      el.querySelector(".home-set").addEventListener("click", () => { UX.state.homeCiv = civ; UX.toast(`ホームに ${CIVS[civ].leader} を表示します`, "ok"); UX.go("leader", { civ }, { replace: true, transition: "none" }); });
    },
  });

  // ───────── S29 装備庫 ─────────
  css("armory", `
  & .wrap { position: absolute; inset: 44px 0 0 0; padding: 14px 16px; display: grid; grid-template-columns: 1fr 1fr 1fr 230px; gap: 10px; }
  & .item { display: flex; flex-direction: column; gap: 6px; padding: 12px; border-top: 3px solid var(--crayon); }
  & .item .ph { height: 92px; }
  & .cells { display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; }
  & .cells i { height: 12px; background: var(--line); }
  & .cells i.on { background: var(--crayon); }
  & .item.empty .cells i { background: var(--line); }
  & .item.empty { border-top-color: var(--faint); }
  & .drop { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 12px; }
  & .ring { width: 110px; height: 110px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(var(--ink) 0 40%, var(--line) 40% 100%); }
  & .ring > div { width: 92px; height: 92px; border-radius: 50%; background: var(--surface-solid); display: grid; place-items: center; text-align: center; }
  & .kv { width: 100%; display: flex; justify-content: space-between; font-size: 10px; border-bottom: 1px solid var(--line); padding: 3px 0; }
  `);
  UX.screen("armory", {
    title: "S29 装備庫", group: "育成・収集",
    render: () => `<div class="screen grid-bg">${tb("ARMORY · CONSUMABLES", "装備庫", `<span class="tiny dim">使い切りアドオンは試合前の装備で最大2枠</span>`)}
      <div class="wrap">${D.ADDONS.filter((a) => a.kind === "cons").map((a) => `<section class="panel marks item ${a.stock ? "" : "empty"}">${D.ph("ADD-ON ICON", "使い切りアドオン 1:1")}<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:13px">${a.name}</b><span class="tiny" style="color:var(--gold)">${"★".repeat(a.rare)}</span></div><div class="small dim">${a.desc}</div><div class="eyebrow" style="display:flex;justify-content:space-between;margin-top:auto"><span>STOCK</span><span>${a.stock} / 10</span></div><div class="cells">${Array.from({ length: 10 }, (_, i) => `<i class="${i < a.stock ? "on" : ""}"></i>`).join("")}</div><div class="tiny dim">${a.stock ? "試合のドロップで補充" : "在庫なし · ドロップで入手"}</div></section>`).join("")}
        <aside class="panel marks drop"><div class="eyebrow ink">TODAY'S DROP</div><div class="ring"><div><div><div class="num" style="font-size:26px">2<span class="small dim"> / 5</span></div><div class="tiny dim">本日の残り</div></div></div></div>
          <div class="kv"><span>パス</span><b>スタンダード</b></div><div class="kv"><span>1試合のドロップ</span><b>1</b></div><div class="kv"><span>貢献ボーナス</span><b>+1(上位時)</b></div>
          <button class="btn sm light block" data-go="pass">パスを見る →</button></aside>
      </div></div>`,
  });

  // ───────── S17 バトルパス ─────────
  css("pass", `
  & .head { position: absolute; left: 16px; right: 16px; top: 54px; display: flex; gap: 14px; align-items: end; }
  & .head .lvl { font-family: var(--f-display); font-weight: 700; font-size: 44px; line-height: .9; }
  & .track { position: absolute; left: 0; right: 0; top: 118px; bottom: 14px; overflow-x: auto; overflow-y: hidden; padding: 0 16px; }
  & .lanes { display: grid; grid-template-rows: 1fr 26px 1fr; width: max-content; height: 100%; gap: 6px; }
  & .lane { display: flex; gap: 6px; }
  & .lbl { position: sticky; left: 0; z-index: 2; width: 70px; flex: none; display: flex; flex-direction: column; justify-content: center; padding: 0 8px; background: var(--ink); color: #fff; font-size: 10px; font-weight: 700; }
  & .lbl.prem { background: var(--crayon); }
  & .rw { width: 96px; flex: none; display: flex; flex-direction: column; padding: 4px; background: var(--surface-solid); border: 1px solid var(--line); text-align: left; position: relative; }
  & .rw .ph { flex: 1; }
  & .rw b { font-size: 9.5px; margin-top: 3px; }
  & .rw.claim { box-shadow: 0 0 0 2px var(--warn); animation: ux-pulse 1.4s ease-in-out infinite; }
  & .rw.got { opacity: .45; }
  & .rw.got::after { content: "受取済"; position: absolute; right: 6px; top: 6px; font-family: var(--f-mono); font-size: 8px; color: var(--ok); }
  & .rw.locked::after { content: "LOCK"; position: absolute; right: 6px; top: 6px; font-family: var(--f-mono); font-size: 8px; color: var(--crayon); }
  & .tiers { display: flex; gap: 6px; padding-left: 76px; }
  & .tier { width: 96px; flex: none; display: grid; place-items: center; font-family: var(--f-mono); font-size: 10px; font-weight: 700; border-top: 2px solid var(--line-2); }
  & .tier.done { border-top-color: var(--ink); }
  & .tier.cur { border-top-color: var(--warn); color: var(--warn); }
  `);
  const PASS_FREE = ["C 500", "緊急空輸 ×1", "C 800", "称号「渡河者」", "D 30", "再集結 ×1", "C 1,000", "合図スタンプ", "D 50", "根回し ×1", "C 1,500", "断章 特別編"];
  const PASS_PREM = ["衣装 夜間迷彩", "D 80", "盤面スキン", "C 2,000", "ボイス 追加", "部隊プレート", "D 120", "衣装 式典礼装", "C 3,000", "称号「水門の主」", "D 200", "立ち絵 特別版"];
  UX.screen("pass", {
    title: "S17 バトルパス", group: "ショップ・パス",
    render: () => {
      const cur = 7, prem = UX.state.premiumPass, got = UX.state.passGot || {};
      const cell = (lane, i, name) => { const k = `${lane}${i}`; const reached = i + 1 <= cur; const locked = lane === "p" && !prem; const st = got[k] ? "got" : locked ? "locked" : reached ? "claim" : ""; return `<button class="rw ${st}" data-k="${k}" data-name="${name}" data-locked="${locked}" data-reached="${reached}">${D.ph(lane === "p" ? "PREMIUM" : "REWARD", "")}<b>${name}</b></button>`; };
      return `<div class="screen grid-bg">${tb("BATTLE PASS · SEASON 03 「渡河」", "バトルパス", D.wallet())}
      <div class="head"><div><div class="eyebrow">CURRENT TIER</div><div class="lvl">07<span class="small dim"> / 50</span></div></div><div style="flex:1"><div class="eyebrow" style="display:flex;justify-content:space-between"><span>次の段まで</span><span>620 / 1,000 XP</span></div><div class="bar thick" style="margin-top:4px"><i style="width:62%"></i></div></div>
        <button class="btn sm light claim-all">まとめて受け取る</button>${prem ? '<span class="tag violet">上位 購入済み</span>' : '<button class="btn sm violet" data-dialog="purchase" data-params=\'{"name":"バトルパス 上位 S03","price":980,"cur":"yen"}\'>上位を購入 ¥980</button>'}</div>
      <div class="track"><div class="lanes">
        <div class="lane"><div class="lbl">無料<span class="tiny" style="opacity:.6">FREE</span></div>${PASS_FREE.map((n, i) => cell("f", i, n)).join("")}</div>
        <div class="tiers">${PASS_FREE.map((_, i) => `<div class="tier ${i + 1 < cur ? "done" : i + 1 === cur ? "cur" : ""}">${String(i + 1).padStart(2, "0")}</div>`).join("")}</div>
        <div class="lane"><div class="lbl prem">上位<span class="tiny" style="opacity:.6">PREMIUM</span></div>${PASS_PREM.map((n, i) => cell("p", i, n)).join("")}</div>
      </div></div></div>`;
    },
    mount(el) {
      const claim = (b) => { UX.state.passGot = { ...(UX.state.passGot || {}), [b.dataset.k]: true }; b.classList.remove("claim"); b.classList.add("got"); };
      for (const b of el.querySelectorAll(".rw")) b.addEventListener("click", () => {
        if (b.classList.contains("got")) return UX.toast("受取済みです");
        if (b.dataset.locked === "true") return UX.openDialog("purchase", { name: "バトルパス 上位 S03", price: 980, cur: "yen" });
        if (b.dataset.reached !== "true") return UX.toast(`段に到達すると受け取れます: ${b.dataset.name}`);
        claim(b); UX.toast(`受け取りました: ${b.dataset.name}`, "ok");
      });
      el.querySelector(".claim-all").addEventListener("click", () => { const cs = el.querySelectorAll(".rw.claim"); cs.forEach(claim); UX.toast(cs.length ? `${cs.length}件を受け取りました` : "受け取れる報酬はありません", cs.length ? "ok" : ""); });
    },
  });

  // ───────── S25 お知らせ ─────────
  css("news", `
  & .wrap { position: absolute; inset: 44px 0 0 0; display: grid; grid-template-columns: 290px 1fr; }
  & .list { border-right: 1px solid var(--line); overflow: auto; background: rgba(255,255,255,.5); }
  & .it { display: block; width: 100%; text-align: left; padding: 9px 14px; border-bottom: 1px solid var(--line); }
  & .it.on { background: var(--ink); color: #fff; }
  & .it .k { font-family: var(--f-mono); font-size: 8.5px; color: var(--dim); display: flex; gap: 6px; }
  & .it.on .k { color: rgba(255,255,255,.6); }
  & .it b { font-size: 10.5px; display: block; margin-top: 2px; }
  & .doc { position: relative; margin: 14px 18px; padding: 16px 20px; background: var(--surface-solid); border: 1px solid var(--line); box-shadow: var(--shadow); overflow: hidden; animation: ux-fade-in .25s ease; }
  & .doc::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 5px; background: var(--hazard); }
  & .doc h2 { font-size: 16px; margin: 6px 0 8px; }
  & .doc p { font-size: 11px; line-height: 1.8; color: var(--ink-2); }
  & .doc .stamp { position: absolute; right: 22px; top: 16px; }
  `);
  const NEWS = [
    ["CASE", "10.09", "【案件】中央水門 争奪案件を開始しました", "期間中、中央水門が終盤に開く特殊マップで試合が行われます。中央水門を制圧したチームは毎秒チケットを削ることができます。参加報酬として断章「水の底」を用意しています。", "承認", "var(--danger)"],
    ["PASS", "10.08", "シーズン 3「渡河」バトルパス 追加段を公開", "バトルパスに 51〜60 段を追加しました。上位パスでは衣装「式典礼装」を受け取れます。", "公開", "var(--ok)"],
    ["RULE", "10.06", "ランク戦における持ち込み制限の改定について", "ランク戦では使い切りアドオンを2枠までとします。上位帯(参事官 I 以上)では1枠までとなります。", "改定", "var(--ink-2)"],
    ["MAINT", "10.02", "10/14 定期メンテナンスのお知らせ", "10月14日 4:00〜6:00 に定期メンテナンスを行います。メンテナンス中はログインできません。", "予告", "var(--warn)"],
  ];
  UX.screen("news", {
    title: "S25 お知らせ", group: "記録・その他",
    render: (p) => {
      const i = p.i ?? 0, n = NEWS[i];
      return `<div class="screen grid-bg">${tb("BULLETIN · 報せ", "お知らせ", `<span class="tag">${NEWS.length} 件</span>`)}
      <div class="wrap"><nav class="list">${NEWS.map((x, j) => `<button class="it ${j === i ? "on" : ""}" data-i="${j}"><div class="k"><span>${x[1]}</span><span>${x[0]}</span>${j === 0 && !UX.state.readNews ? '<span style="color:var(--danger)">NEW</span>' : ""}</div><b>${x[2]}</b></button>`).join("")}</nav>
      <article class="doc"><span class="docno">DOC NO. DO-2026-${String(1009 - i * 2).padStart(4, "0")} · ${n[0]}</span><span class="stamp" style="color:${n[5]}">${n[4]}</span><h2>${n[2]}</h2><p>${n[3]}</p><p class="tiny dim" style="margin-top:14px">発行: 国際夢域調停局 管制第4課 · ${n[1]}</p>
        ${i === 0 ? `<button class="btn sm" style="margin-top:10px" data-go="event">案件を見る →</button>` : ""}
        ${i === 0 ? `<svg class="crayon-svg" style="right:30px;bottom:20px" width="120" height="40" viewBox="0 0 120 40"><path d="M4 26 C 30 8, 70 36, 116 12" stroke-width="2.4"/></svg>` : ""}</article></div></div>`;
    },
    mount(el) {
      for (const b of el.querySelectorAll("[data-i]")) b.addEventListener("click", () => UX.go("news", { i: Number(b.dataset.i) }, { replace: true, transition: "none" }));
      UX.after(800, () => (UX.state.readNews = true));
    },
  });

  // ───────── S23 設定 ─────────
  css("settings", `
  & .cats { position: absolute; left: 12px; top: 56px; bottom: 12px; width: 150px; display: flex; flex-direction: column; padding: 6px; }
  & .cat { display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 8px; font-size: 10.5px; font-weight: 700; text-align: left; color: var(--ink-2); }
  & .cat .ic { width: 20px; font-family: var(--f-mono); font-size: 9px; color: var(--dim); }
  & .cat.on { background: var(--ink); color: #fff; }
  & .main { position: absolute; left: 174px; right: 14px; top: 56px; bottom: 12px; overflow: auto; display: flex; flex-direction: column; gap: 8px; }
  & .row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 10px; padding: 7px 12px; border-bottom: 1px solid var(--line); }
  & .row > :last-child { justify-self: end; }
  & .row b { font-size: 11px; display: block; }
  & input[type=range] { -webkit-appearance: none; appearance: none; width: 180px; height: 4px; background: linear-gradient(90deg, var(--ink) var(--p), var(--line) var(--p)); }
  & input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; background: #fff; border: 2px solid var(--ink); transform: rotate(45deg); }
  & .sl { display: flex; align-items: center; gap: 8px; }
  & .sl .v { font-family: var(--f-mono); font-size: 10px; width: 26px; text-align: right; }
  & .toggle { width: 38px; height: 20px; border-radius: 10px; background: var(--line-2); position: relative; transition: background .15s; }
  & .toggle::after { content: ""; position: absolute; left: 3px; top: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: left .15s; }
  & .toggle.on { background: var(--ink); }
  & .toggle.on::after { left: 21px; }
  & .danger-zone { border: 1px dashed var(--danger); padding: 10px 12px; display: flex; gap: 8px; align-items: center; }
  `);
  const slider = (n, v, sub = "") => `<div class="row"><div><b>${n}</b>${sub ? `<span class="tiny dim">${sub}</span>` : ""}</div><div class="sl"><input type="range" min="0" max="100" value="${v}" style="--p:${v}%"><span class="v">${v}</span></div></div>`;
  const toggle = (n, on, sub = "") => `<div class="row"><div><b>${n}</b>${sub ? `<span class="tiny dim">${sub}</span>` : ""}</div><button class="toggle ${on ? "on" : ""}"></button></div>`;
  const seg = (n, opts, on, sub = "") => `<div class="row"><div><b>${n}</b>${sub ? `<span class="tiny dim">${sub}</span>` : ""}</div><div class="seg">${opts.map((o, i) => `<span class="${i === on ? "on" : ""}">${o}</span>`).join("")}</div></div>`;
  const group = (t, rows) => `<section class="panel"><div class="panel-head"><span class="eyebrow ink">${t}</span></div>${rows}</section>`;
  const SET = {
    sound: ["♪", "サウンド", () => group("VOLUME / 音量", slider("マスター", 80) + slider("BGM", 55) + slider("効果音", 70) + slider("指導者ボイス", 100, "無線の台詞・ドラマ")) + group("BEHAVIOR / 再生", toggle("無線字幕", true, "試合中の台詞を字幕で表示") + seg("カットイン", ["なし", "短縮", "標準"], 1, "拠点制圧・陥落時の演出"))],
    graphic: ["G", "グラフィック", () => group("QUALITY / 品質", seg("描画品質", ["低", "中", "高"], 1) + seg("フレームレート", ["30", "60"], 1) + toggle("影", false, "盤面の模型の影") + toggle("省電力", false))],
    control: ["OP", "操作", () => group("INPUT / 操作", slider("カメラ速度", 60) + toggle("ドラッグで移動", true, "部隊チップを盤面へドラッグ") + toggle("目的地を先に指定", true) + seg("長押しの時間", ["短", "標準", "長"], 1))],
    notify: ["!", "通知", () => group("NOTIFY / 通知", toggle("マッチング成立", true) + toggle("案件の開始", true) + toggle("パスの受取", false))],
    lang: ["あ", "言語 / 字幕", () => group("LANGUAGE / 言語", seg("表示言語", ["日本語", "English"], 0) + seg("ドラマの文字送り", ["遅い", "標準", "速い", "瞬間"], 1) + toggle("ドラマの AUTO を既定にする", false))],
    account: ["ID", "アカウント", () => group("ACCOUNT / アカウント", `<div class="row"><div><b>引き継ぎ</b><span class="tiny dim">Google で連携済み</span></div><button class="btn sm light" data-go="login">ログイン方法</button></div><div class="row"><div><b>サーバー地域</b><span class="tiny dim">TOKYO-01 · 24ms</span></div><button class="btn sm light" data-toast="地域の選択(D51)">変更</button></div><div class="row"><div><b>接続エラーの表示</b><span class="tiny dim">UX 確認用(D42)</span></div><button class="btn sm light" data-dialog="conn_error">表示する</button></div><div class="row"><div><b>メンテナンス画面</b><span class="tiny dim">UX 確認用(S28)</span></div><button class="btn sm light" data-go="maintenance">表示する</button></div>`) + `<div class="danger-zone"><span class="eyebrow" style="color:var(--danger)">DANGER</span><span class="small" style="flex:1">ログアウト、データ削除</span><button class="btn sm ghost" data-reset="title">ログアウト</button><button class="btn sm danger" data-dialog="delete_confirm">データ削除</button></div>`],
    block: ["⊘", "通報 / ブロック", () => group("SAFETY / 通報・ブロック", `<div class="row"><div><b>組まないリスト</b><span class="tiny dim">4 / 10 枠 · 期限つき</span></div><button class="btn sm light" data-go="blocklist">管理する</button></div><div class="row"><div><b>通報の履歴</b><span class="tiny dim">対応済 2 · 審査中 1</span></div><button class="btn sm light" data-go="blocklist">見る</button></div>`)],
  };
  UX.screen("settings", {
    title: "S23 設定", group: "記録・その他",
    render: (p) => {
      const cat = p.cat || "sound";
      return `<div class="screen grid-bg">${tb("CONFIGURATION", "設定", `<button class="btn sm ghost" data-toast="初期値に戻しました">初期値に戻す</button>`)}
      <nav class="panel cats">${Object.entries(SET).map(([k, [ic, n]]) => `<button class="cat ${k === cat ? "on" : ""}" data-cat="${k}"><span class="ic">${ic}</span>${n}</button>`).join("")}<div class="tiny mono dim" style="margin-top:auto;line-height:1.6">BUILD 0.9.4 (S03)<br>ID 4X-7F21-0C9A</div></nav>
      <main class="main">${SET[cat][2]()}</main></div>`;
    },
    mount(el) {
      for (const b of el.querySelectorAll("[data-cat]")) b.addEventListener("click", () => UX.go("settings", { cat: b.dataset.cat }, { replace: true, transition: "none" }));
      for (const r of el.querySelectorAll("input[type=range]")) r.addEventListener("input", () => { r.style.setProperty("--p", r.value + "%"); r.nextElementSibling.textContent = r.value; });
      for (const t of el.querySelectorAll(".toggle")) t.addEventListener("click", () => t.classList.toggle("on"));
      for (const s of el.querySelectorAll(".seg")) for (const o of s.children) o.addEventListener("click", () => { for (const x of s.children) x.classList.toggle("on", x === o); });
    },
  });
  UX.dialogs.delete_confirm = {
    opts: { kind: "modal" },
    render: () => `<div class="dlg"><div class="dlg-head"><div class="eyebrow" style="color:var(--danger)">D46 · CONFIRM</div><b style="font-size:14px">データを削除しますか</b></div>
      <div class="dlg-body">文明研究の進み具合、所持品、戦績がすべて消えます。購入した通貨は返金されません。<div style="margin-top:8px;padding:8px;background:var(--surface-sunk);font-size:10px">確認のため「削除」と入力 <input class="cf" style="margin-left:6px;border:1px solid var(--line-2);padding:2px 6px;width:80px"></div></div>
      <div class="dlg-foot"><button class="btn ghost sm" data-close>やめる</button><button class="btn danger sm go disabled">削除する</button></div></div>`,
    mount(body, dlg) {
      const go = body.querySelector(".go"), cf = body.querySelector(".cf");
      cf.addEventListener("input", () => go.classList.toggle("disabled", cf.value !== "削除"));
      go.addEventListener("click", () => { if (cf.value !== "削除") return UX.toast("「削除」と入力してください", "danger"); dlg.close(); UX.toast("削除しました(モック)", "danger"); UX.after(600, () => UX.reset("title")); });
    },
  };
  UX.dialogs.conn_error = {
    opts: { kind: "modal", dark: true, dismiss: false },
    render: () => `<div class="dlg" style="width:400px"><div style="height:6px;background:var(--hazard)"></div><div class="dlg-head" style="display:flex;gap:10px;align-items:center"><div style="font-size:22px">⌁</div><div><div class="eyebrow" style="color:var(--danger)">D42 · CONNECTION LOST</div><b style="font-size:14px">サーバーとの接続が切れました</b></div></div>
      <div class="dlg-body"><div class="small" style="color:var(--ink-2)">自動で再接続しています。試合中だった場合はAI代行が引き継いでいます。</div><div class="eyebrow" style="display:flex;justify-content:space-between;margin-top:10px"><span>RETRY <b class="n">1</b> / 5</span><span class="mono">ERR 4X-1006</span></div><div class="bar" style="margin-top:4px"><i class="p" style="width:0%;transition:width .4s"></i></div></div>
      <div class="dlg-foot"><button class="btn ghost sm" data-close data-reset="title">タイトルへ</button><button class="btn sm retry">再試行</button></div></div>`,
    mount(body, dlg) {
      let n = 1; const p = body.querySelector(".p"), nn = body.querySelector(".n");
      const t = setInterval(() => { if (!body.isConnected) return clearInterval(t); n = Math.min(5, n + 1); nn.textContent = n; p.style.width = n * 20 + "%"; }, 900);
      body.querySelector(".retry").addEventListener("click", () => { clearInterval(t); p.style.width = "100%"; setTimeout(() => { dlg.close(); UX.toast("再接続しました", "ok"); }, 500); });
    },
  };

  // ───────── S24 通報 / ブロック管理 ─────────
  css("blocklist", `
  & .wrap { position: absolute; inset: 44px 0 0 0; padding: 12px 16px; display: grid; grid-template-columns: 220px 1fr 260px; gap: 10px; }
  & .cap { padding: 14px; display: flex; flex-direction: column; gap: 8px; }
  & .cap .num { font-size: 48px; line-height: 1; }
  & .cells { display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; }
  & .cells i { height: 16px; background: var(--line); } & .cells i.on { background: var(--ink); }
  & .row { display: grid; grid-template-columns: 30px 1fr 90px auto; gap: 8px; align-items: center; padding: 8px 10px; border-bottom: 1px solid var(--line); font-size: 10.5px; transition: opacity .2s, transform .2s; }
  & .row.gone { opacity: 0; transform: translateX(20px); }
  & .rep { display: flex; justify-content: space-between; align-items: center; padding: 7px 10px; border-bottom: 1px solid var(--line); font-size: 10px; }
  `);
  UX.screen("blocklist", {
    title: "S24 通報 / ブロック管理", group: "記録・その他",
    render: () => {
      const list = UX.state.blocks ?? (UX.state.blocks = [["KUROGANE", 12, 30], ["ZEPHYR-7", 4, 30], ["GUEST-482", 21, 30], ["MOGURA", 28, 30]]);
      return `<div class="screen grid-bg">${tb("SAFETY · 組まないリスト", "通報 / ブロック管理")}
      <div class="wrap">
        <section class="panel marks cap"><div class="eyebrow ink">SLOTS</div><div><span class="num">${list.length}</span><span class="dim"> / 10</span></div><div class="cells">${Array.from({ length: 10 }, (_, i) => `<i class="${i < list.length ? "on" : ""}"></i>`).join("")}</div><div class="tiny dim" style="line-height:1.6">味方として組まないプレイヤー。枠は10、期限は30日。期限が切れると自動で外れます。</div></section>
        <section class="panel"><div class="panel-head"><span class="eyebrow ink">LIST · 組まない</span><span class="tiny dim">解除はいつでもできます</span></div>${list.map(([n, d, max], i) => `<div class="row" data-i="${i}">${D.phRound(26)}<b>${n}</b><div><div class="bar"><i style="width:${(d / max) * 100}%"></i></div><span class="tiny dim">残り ${d} 日</span></div><button class="btn sm ghost un">解除</button></div>`).join("") || '<div class="small dim" style="padding:14px">登録はありません</div>'}</section>
        <section class="panel"><div class="panel-head"><span class="eyebrow ink">REPORTS · 通報の履歴</span></div>
          <div class="rep"><span>放置 · GUEST-219</span><span class="stamp" style="color:var(--ok)">対応済</span></div><div class="rep"><span>暴言 · NIGHTOWL</span><span class="stamp" style="color:var(--ok)">対応済</span></div><div class="rep"><span>不正の疑い · AAA-01</span><span class="stamp" style="color:var(--warn)">審査中</span></div></section>
      </div></div>`;
    },
    mount(el) {
      for (const b of el.querySelectorAll(".un")) b.addEventListener("click", () => {
        const row = b.closest(".row"), i = Number(row.dataset.i);
        row.classList.add("gone");
        UX.after(220, () => { const [n] = UX.state.blocks.splice(i, 1)[0]; UX.go("blocklist", {}, { replace: true, transition: "none" }); UX.toast(`${n} を解除しました`); });
      });
    },
  });

  // ───────── S26 プロフィール ─────────
  css("profile", `
  & .banner { position: absolute; left: 0; right: 0; top: 44px; height: 110px; border: 0; }
  & .who { position: absolute; left: 20px; top: 104px; display: flex; gap: 14px; align-items: end; }
  & .who .name { font-family: var(--f-display); font-weight: 700; font-size: 34px; letter-spacing: -.03em; line-height: 1; }
  & .stats { position: absolute; left: 20px; right: 300px; top: 220px; display: grid; grid-template-columns: repeat(4, 1fr); }
  & .stats > div { padding: 8px 12px; border-right: 1px solid var(--line); }
  & .stats .v { font-family: var(--f-display); font-weight: 700; font-size: 22px; }
  & .titles { position: absolute; left: 20px; right: 300px; top: 300px; display: flex; flex-wrap: wrap; gap: 5px; }
  & .acts { position: absolute; left: 20px; bottom: 14px; display: flex; gap: 6px; }
  & .donut { position: absolute; right: 16px; top: 170px; width: 270px; padding: 12px; display: grid; grid-template-columns: 100px 1fr; gap: 12px; align-items: center; }
  & .donut .d { width: 100px; height: 100px; border-radius: 50%; background: conic-gradient(#ff6a1a 0 46%, #2a2a2a 46% 70%, #3b6cff 70% 84%, #9aa7b2 84% 94%, #12a874 94% 100%); display: grid; place-items: center; }
  & .donut .d > div { width: 62px; height: 62px; border-radius: 50%; background: var(--surface-solid); display: grid; place-items: center; font-family: var(--f-display); font-weight: 700; }
  & .donut li { list-style: none; display: flex; gap: 6px; align-items: center; font-size: 9.5px; }
  & .donut li i { width: 8px; height: 8px; }
  `);
  UX.screen("profile", {
    title: "S26 プロフィール", group: "記録・その他",
    render: () => `<div class="screen grid-bg">${tb("OPERATOR PROFILE", "プロフィール", `<button class="btn sm ghost" data-toast="名前の編集(D16)">編集</button>`)}
      ${D.ph("PROFILE BANNER", "称号に応じたバナー 21:5", "banner tinted t-a")}
      <div class="who">${D.phRound(72, "AVATAR", "background:#fff")}<div><div class="eyebrow ink">OPERATOR · LV 23</div><div class="name">${UX.state.name}</div><div style="display:flex;gap:6px;margin-top:4px"><span class="tag solid">参事官 II</span><span class="tag violet">渡河の先導者</span></div></div></div>
      <div class="panel stats"><div><div class="eyebrow">RATING</div><div class="v">1,642</div></div><div><div class="eyebrow">MATCHES</div><div class="v">158</div></div><div><div class="eyebrow">WIN</div><div class="v">38%</div></div><div><div class="eyebrow">MVP</div><div class="v">21</div></div></div>
      <div class="titles"><span class="eyebrow ink" style="width:100%">TITLES · 称号 14</span>${["渡河の先導者", "水門の主", "無血開城", "最後の一兵", "架橋技師", "三者調停"].map((t, i) => `<span class="tag ${i === 0 ? "violet" : ""}">${t}</span>`).join("")}</div>
      <section class="panel marks donut"><div class="d"><div>158</div></div><ul><li class="eyebrow ink" style="margin-bottom:2px">使用文明</li><li><i style="background:#ff6a1a"></i>PMC 46%</li><li><i style="background:#2a2a2a"></i>SOC 24%</li><li><i style="background:#3b6cff"></i>CORP 14%</li><li><i style="background:#9aa7b2"></i>IPA 10%</li><li><i style="background:#12a874"></i>FND 6%</li></ul></section>
      <div class="acts"><button class="btn sm" data-toast="称賛を送りました" data-toast-kind="ok">称賛</button><button class="btn sm light" data-go="history">戦績</button><button class="btn sm ghost" data-toast="通報フォーム(D39)">通報</button><button class="btn sm ghost" data-toast="組まないリストに追加しました">組まない</button></div>
    </div>`,
  });

  // ───────── S12 ランク / レート ─────────
  css("rank", `
  & .left { position: absolute; left: 16px; top: 56px; bottom: 14px; width: 220px; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px; }
  & .left .ph { width: 120px; height: 120px; }
  & .left .tier { font-size: 24px; font-weight: 900; }
  & .chart { position: absolute; left: 248px; right: 16px; top: 56px; height: 200px; padding: 10px 12px; }
  & .ladder { position: absolute; left: 248px; right: 16px; bottom: 14px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
  & .ladder > div { padding: 8px; background: var(--surface-solid); border: 1px solid var(--line); font-size: 9.5px; }
  & .ladder > div.cur { box-shadow: 0 0 0 2px var(--ink); }
  & .ladder .ph { height: 30px; margin-bottom: 4px; }
  & svg .ln { fill: none; stroke: var(--ink); stroke-width: 2; stroke-dasharray: 600; stroke-dashoffset: 600; animation: ux-draw 1.2s ease forwards; }
  @keyframes ux-draw { to { stroke-dashoffset: 0; } }
  `);
  UX.screen("rank", {
    title: "S12 ランク / レート", group: "記録・その他",
    render: () => `<div class="screen grid-bg">${tb("SEASON 03 · RANK", "ランク / レート", `<span class="tag">残り 23日</span><button class="btn sm light" data-go="ranking">ランキング →</button>`)}
      <section class="panel marks left">${D.ph("EMBLEM", "段位の紋章 1:1")}<div class="eyebrow">CURRENT</div><div class="tier">参事官 II</div><div class="mono">RATING 1,642 <span style="color:var(--ok)">▲18</span></div><div style="width:100%"><div class="bar"><i style="width:72%"></i></div><div class="tiny dim" style="display:flex;justify-content:space-between;margin-top:2px"><span>次の段まで 58</span><span>参事官 I</span></div></div></section>
      <section class="panel chart"><div class="eyebrow ink">RATING · 直近30試合</div>
        <svg viewBox="0 0 600 160" width="100%" height="160" preserveAspectRatio="none"><line x1="0" y1="50" x2="600" y2="50" stroke="var(--line-2)" stroke-dasharray="4 4"/><text x="4" y="46" font-size="9" fill="var(--dim)">参事官 I 1,700</text><line x1="0" y1="120" x2="600" y2="120" stroke="var(--line-2)" stroke-dasharray="4 4"/><text x="4" y="116" font-size="9" fill="var(--dim)">参事官 II 1,550</text>
        <polyline class="ln" points="0,140 40,132 80,138 120,120 160,124 200,110 240,116 280,98 320,104 360,92 400,96 440,84 480,90 520,74 560,78 600,70"/></svg></section>
      <div class="ladder">${["書記官", "主事", "参事官 III", "参事官 II", "参事官 I", "長官"].map((n, i) => `<div class="${i === 3 ? "cur" : ""}">${D.ph("EMB", "")}<b>${n}</b><div class="tiny dim">${["C 500", "C 1,000", "D 30", "D 50 + 称号", "衣装", "特別立ち絵"][i]}</div></div>`).join("")}</div>
    </div>`,
  });

  // ───────── S27 ランキング ─────────
  css("ranking", `
  & .podium { position: absolute; left: 16px; top: 60px; bottom: 14px; width: 330px; display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: end; gap: 6px; }
  & .pd { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  & .pd .blk { width: 100%; display: grid; place-items: center; font-family: var(--f-display); font-weight: 700; font-size: 28px; color: #fff; background: var(--ink); }
  & .pd.p1 .blk { background: var(--gold); }
  & .table { position: absolute; left: 360px; right: 16px; top: 56px; bottom: 54px; overflow: auto; }
  & .tr { display: grid; grid-template-columns: 40px 1fr 70px 70px; gap: 8px; align-items: center; padding: 6px 12px; border-bottom: 1px solid var(--line); font-size: 10.5px; }
  & .tr .n { font-family: var(--f-display); font-weight: 700; font-size: 14px; }
  & .me { position: absolute; left: 360px; right: 16px; bottom: 14px; background: var(--ink); color: #fff; }
  & .me .tr { border: 0; }
  `);
  const RANKERS = ["SHIRAKAWA", "VEIL_MAIN", "K-ROWAN", "TETSU", "MINATO", "AZUSA-9", "OBSERVER", "NORTHGATE", "HAYATE", "LUMEN"];
  UX.screen("ranking", {
    title: "S27 ランキング", group: "記録・その他",
    render: (p) => {
      const tab = p.tab || "season";
      const names = tab === "season" ? RANKERS : ["TETSU", UX.state.name, "MINATO", "AZUSA-9"];
      return `<div class="screen grid-bg">${tb("LEADERBOARD", "ランキング", `<div class="seg tabsw"><span class="${tab === "season" ? "on" : ""}" data-tab="season">シーズン</span><span class="${tab === "friend" ? "on" : ""}" data-tab="friend">フレンド</span></div>`)}
      <section class="podium">${[[2, 140], [1, 180], [3, 110]].map(([r, hgt]) => `<div class="pd p${r}">${D.phRound(r === 1 ? 64 : 50)}<b style="font-size:10.5px">${names[r - 1]}</b><span class="mono tiny dim">${2410 - r * 37}</span><div class="blk" style="height:${hgt - 60}px">${r}</div></div>`).join("")}</section>
      <section class="panel table">${names.map((n, i) => `<div class="tr" ${n === UX.state.name ? 'style="background:rgba(0,180,224,.08)"' : ""}><span class="n">${i + 1}</span><b>${n}</b><span class="mono tiny">${["PMC", "SOC", "INT", "CORP", "IPA"][i % 5]}</span><span class="mono">${2373 - i * 29}</span></div>`).join("")}</section>
      <section class="me"><div class="tr"><span class="n">${tab === "season" ? "1,284" : "2"}</span><b>${UX.state.name}(あなた)</b><span class="mono tiny">PMC</span><span class="mono">1,642</span></div></section></div>`;
    },
    mount(el) { for (const t of el.querySelectorAll("[data-tab]")) t.addEventListener("click", () => UX.go("ranking", { tab: t.dataset.tab }, { replace: true, transition: "none" })); },
  });

  // ───────── S21 戦績 ─────────
  css("history", `
  & .list { position: absolute; left: 12px; top: 56px; bottom: 12px; width: 280px; overflow: auto; display: flex; flex-direction: column; gap: 4px; }
  & .m { display: grid; grid-template-columns: 40px 1fr auto; gap: 8px; align-items: center; padding: 6px 10px; background: var(--surface-solid); border: 1px solid var(--line); border-left: 3px solid var(--c); text-align: left; }
  & .m.on { box-shadow: 0 0 0 2px var(--ink); }
  & .m .r { font-family: var(--f-display); font-weight: 700; font-size: 22px; }
  & .detail { position: absolute; left: 304px; right: 14px; top: 56px; bottom: 12px; display: flex; flex-direction: column; gap: 8px; animation: ux-fade-in .2s; }
  & .tbl .tr { display: grid; grid-template-columns: 30px 1fr 60px 60px 60px 60px; padding: 6px 12px; border-bottom: 1px solid var(--line); font-size: 10.5px; }
  & .tbl .tr.h { font-family: var(--f-mono); font-size: 8.5px; color: var(--dim); }
  `);
  const MATCHES = [[1, "pmc", "+18", "ランク戦", "10.09 21:14"], [3, "soc", "−12", "ランク戦", "10.09 20:31"], [2, "pmc", "+4", "案件戦", "10.08 23:02"], [1, "corp", "+21", "ランク戦", "10.08 22:10"], [2, "ipa", "+2", "カジュアル", "10.07 19:45"]];
  UX.screen("history", {
    title: "S21 戦績", group: "記録・その他",
    render: (p) => {
      const i = p.i ?? 0, m = MATCHES[i];
      return `<div class="screen grid-bg">${tb("MATCH HISTORY", "戦績", `<span class="tag">直近 ${MATCHES.length} 試合</span>`)}
      <nav class="list">${MATCHES.map(([r, c, d, mode, t], j) => `<button class="m ${j === i ? "on" : ""}" data-i="${j}" style="--c:${CIVS[c].c}"><span class="r">#${r}</span><div><b style="font-size:10.5px">${CIVS[c].short} · ${mode}</b><div class="tiny dim mono">${t}</div></div><span class="mono" style="color:${d.startsWith("+") ? "var(--ok)" : "var(--danger)"}">${d}</span></button>`).join("")}</nav>
      <section class="detail" data-k="${i}"><div style="display:flex;align-items:center;gap:10px"><span class="docno">CASE NO. DR-${(0x09f9db4f - i * 7919).toString(16).toUpperCase()}</span><span class="tag">${m[3]}</span><span class="tag">30:00</span><div style="flex:1"></div><button class="btn sm" data-go="spectate">▶ リプレイ</button></div>
        <div class="panel tbl"><div class="tr h"><span>#</span><span>TEAM</span><span>チケット</span><span>制圧</span><span>撃破</span><span>損失</span></div>${["a", "b", "c"].map((t, j) => `<div class="tr" ${j === m[0] - 1 ? 'style="background:rgba(255,106,26,.08)"' : ""}><b>${j + 1}</b><span class="t-${t}" style="display:flex;gap:6px;align-items:center"><span class="sym ${D.TEAMS[t].sym}"></span>${j === m[0] - 1 ? UX.state.name : "BOT-0" + (j + 1)}</span><span class="mono">${612 - j * 160}</span><span class="mono">${7 - j * 2}</span><span class="mono">${14 - j * 3}</span><span class="mono">${5 + j * 4}</span></div>`).join("")}</div>
        <div class="panel" style="padding:8px 12px;flex:1"><div class="eyebrow ink">TICKETS · 推移</div><svg viewBox="0 0 500 100" width="100%" height="90" preserveAspectRatio="none"><polyline points="0,8 100,20 200,30 300,46 400,58 500,70" fill="none" stroke="#ff6a1a" stroke-width="2"/><polyline points="0,8 100,18 200,36 300,50 400,70 500,82" fill="none" stroke="#10bfe8" stroke-width="2"/><polyline points="0,8 100,24 200,44 300,66 400,90 500,99" fill="none" stroke="#f0b323" stroke-width="2"/><line x1="380" y1="0" x2="380" y2="100" stroke="var(--crayon)" stroke-dasharray="3 3"/></svg></div>
      </section></div>`;
    },
    mount(el) { for (const b of el.querySelectorAll("[data-i]")) b.addEventListener("click", () => UX.go("history", { i: Number(b.dataset.i) }, { replace: true, transition: "none" })); },
  });

  // ───────── S22 観戦 / リプレイ ─────────
  css("spectate", `
  & .bar-top { position: absolute; left: 0; right: 0; top: 0; height: 44px; display: flex; align-items: center; gap: 10px; padding: 0 12px; background: var(--ink); color: #fff; z-index: 5; }
  & .bar-top .tk { display: flex; align-items: center; gap: 5px; font-family: var(--f-mono); font-size: 10px; padding: 3px 8px; border: 1px solid rgba(255,255,255,.15); }
  & .bar-top .back { color: #fff; border: 1px solid rgba(255,255,255,.25); width: 28px; height: 28px; }
  & .view { display: flex; gap: 2px; }
  & .view button { height: 24px; padding: 0 9px; font-size: 10px; font-weight: 700; color: rgba(255,255,255,.6); border: 1px solid rgba(255,255,255,.15); }
  & .view button.on { background: #fff; color: var(--ink); }
  & .board-ph { top: 44px; }
  & .focus { position: absolute; width: 140px; height: 100px; border: 2px solid var(--tc); transition: left .4s, top .4s; z-index: 2; }
  & .log:empty { display: none; }
  & .log { position: absolute; right: 12px; top: 56px; width: 220px; max-height: 220px; overflow: hidden; z-index: 4; padding: 6px 10px; display: flex; flex-direction: column-reverse; }
  & .log div { font-size: 9.5px; padding: 3px 0; border-bottom: 1px solid var(--line); animation: ux-in-r .3s; }
  & .ctrl { position: absolute; left: 12px; right: 12px; bottom: 10px; height: 56px; z-index: 4; display: grid; grid-template-columns: 40px 1fr 60px; gap: 10px; align-items: center; padding: 0 12px; }
  & .play { width: 34px; height: 34px; background: var(--ink); color: #fff; display: grid; place-items: center; font-size: 12px; }
  & .tl { position: relative; height: 18px; }
  & .tl .rail { position: absolute; left: 0; right: 0; top: 8px; height: 3px; background: var(--line); }
  & .tl .done { position: absolute; left: 0; top: 8px; height: 3px; background: var(--ink); }
  & .tl .head { position: absolute; top: 3px; width: 12px; height: 12px; transform: translateX(-50%) rotate(45deg); background: #fff; border: 2px solid var(--ink); }
  & .tl .ev { position: absolute; top: 0; width: 2px; height: 6px; background: var(--danger); }
  & .tl .ev.v { background: var(--crayon); height: 18px; top: 0; }
  & .spd { height: 28px; font-family: var(--f-mono); font-weight: 700; border: 1px solid var(--line-2); }
  `);
  const EVENTS = ["TEAM A が発電所を制圧", "TEAM B の部隊 02 が撃破", "TEAM C が橋 II を建設", "現地勢力の本拠 陥落", "中央水門 開放", "TEAM A が水門を制圧", "TEAM C 脱落"];
  UX.screen("spectate", {
    title: "S22 観戦 / リプレイ", group: "記録・その他",
    render: () => `<div class="screen">
      <div class="board-ph"><div class="river" style="left:-40px;right:-40px;top:220px;height:26px;transform:rotate(-8deg)"></div><div class="node t-a" style="left:300px;top:270px"></div><div class="node t-b" style="left:640px;top:200px"></div><div class="node big" style="left:470px;top:170px;border-style:dashed"></div><div class="node t-c" style="left:200px;top:140px"></div><div class="token t-a" style="left:350px;top:240px"></div><div class="token t-b" style="left:600px;top:230px"></div><div class="token t-c" style="left:240px;top:170px"></div></div>
      <div class="focus t-a" style="left:260px;top:200px"></div>
      <header class="bar-top"><button class="back" data-back>←</button><span class="eyebrow" style="color:rgba(255,255,255,.6)">REPLAY · DR-09F9DB4F</span>${["a", "b", "c"].map((t) => `<span class="tk t-${t}"><span class="sym ${D.TEAMS[t].sym}"></span><span class="tv" data-t="${t}">1000</span></span>`).join("")}<div style="flex:1"></div><div class="view">${["全体", "A", "B", "C"].map((v, i) => `<button class="${i === 1 ? "on" : ""}" data-v="${i}">${v}</button>`).join("")}</div></header>
      <section class="panel log"></section>
      <section class="panel ctrl"><button class="play">❚❚</button><div><div class="tl"><div class="rail"></div><div class="done" style="width:0"></div>${[12, 30, 44, 58, 66, 78, 90].map((x, i) => `<i class="ev ${i === 4 ? "v" : ""}" style="left:${x}%"></i>`).join("")}<div class="head" style="left:0"></div></div><div class="tiny mono dim" style="display:flex;justify-content:space-between"><span class="cur">00:00</span><span>30:00</span></div></div><button class="spd">×4</button></section>
    </div>`,
    mount(el) {
      let pos = 0, playing = true, speed = 4, ei = 0;
      const marks = [12, 30, 44, 58, 66, 78, 90];
      const play = el.querySelector(".play"), spd = el.querySelector(".spd"), done = el.querySelector(".done"), head = el.querySelector(".head"), cur = el.querySelector(".cur"), log = el.querySelector(".log");
      const draw = () => { done.style.width = pos + "%"; head.style.left = pos + "%"; cur.textContent = D.mmss(pos * 18); for (const t of el.querySelectorAll(".tv")) t.textContent = Math.round(1000 - pos * ({ a: 4, b: 6, c: 9 }[t.dataset.t])); };
      UX.every(200, () => {
        if (!playing) return;
        pos = Math.min(100, pos + 0.15 * speed);
        while (ei < marks.length && pos >= marks[ei]) { log.insertAdjacentHTML("afterbegin", `<div><span class="mono dim">${D.mmss(marks[ei] * 18)}</span> ${EVENTS[ei]}</div>`); ei++; }
        if (pos >= 100) { playing = false; play.textContent = "↺"; }
        draw();
      });
      play.addEventListener("click", () => { if (pos >= 100) { pos = 0; ei = 0; log.innerHTML = ""; } playing = !playing; play.textContent = playing ? "❚❚" : "▶"; });
      spd.addEventListener("click", () => { speed = { 1: 2, 2: 4, 4: 8, 8: 1 }[speed]; spd.textContent = "×" + speed; });
      el.querySelector(".tl").addEventListener("click", (e) => { const r = e.currentTarget.getBoundingClientRect(); pos = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)); ei = marks.filter((m) => m <= pos).length; draw(); });
      const foc = el.querySelector(".focus"), spots = [[350, 150, "var(--ink)"], [260, 200, "var(--team-a)"], [560, 160, "var(--team-b)"], [160, 100, "var(--team-c)"]];
      for (const b of el.querySelectorAll("[data-v]")) b.addEventListener("click", () => { for (const x of el.querySelectorAll("[data-v]")) x.classList.toggle("on", x === b); const [x, y, c] = spots[b.dataset.v]; foc.style.left = x + "px"; foc.style.top = y + "px"; foc.style.setProperty("--tc", c); foc.style.width = b.dataset.v === "0" ? "420px" : "140px"; foc.style.height = b.dataset.v === "0" ? "260px" : "100px"; });
    },
  });

  // ───────── S19 イベント ─────────
  css("event", `
  & .key { position: absolute; left: 0; top: 44px; bottom: 0; width: 50%; border: 0; }
  & .strip { position: absolute; left: 0; bottom: 0; width: 50%; z-index: 2; display: grid; grid-template-columns: repeat(3, 1fr); background: var(--ink); color: #fff; }
  & .strip > div { padding: 8px 14px; border-right: 1px solid rgba(255,255,255,.12); }
  & .strip .v { font-family: var(--f-display); font-weight: 700; font-size: 20px; }
  & .info { position: absolute; left: calc(50% + 16px); right: 16px; top: 56px; bottom: 14px; display: flex; flex-direction: column; gap: 8px; }
  & .info .ttl { font-size: 22px; font-weight: 900; }
  & .rl { display: flex; gap: 8px; font-size: 10.5px; padding: 5px 0; border-bottom: 1px solid var(--line); }
  & .rl span:first-child { font-family: var(--f-mono); font-size: 9px; color: var(--dim); width: 60px; }
  & .prog { display: grid; grid-template-columns: repeat(5, 1fr); gap: 3px; }
  & .prog i { height: 6px; background: var(--line); } & .prog i.on { background: var(--crayon); }
  `);
  UX.screen("event", {
    title: "S19 イベント / 案件", group: "ショップ・パス",
    render: () => `<div class="screen grid-bg">${tb("CASE · LIMITED", "案件", D.wallet())}
      ${D.ph("CASE KEY VISUAL", "案件のキービジュアル 4:3 / 中央水門", "key tinted t-d")}
      <div class="strip"><div><div class="eyebrow" style="color:rgba(255,255,255,.5)">ENDS IN</div><div class="v">2d 14h</div></div><div><div class="eyebrow" style="color:rgba(255,255,255,.5)">BEST</div><div class="v">#1</div></div><div><div class="eyebrow" style="color:rgba(255,255,255,.5)">GLOBAL</div><div class="v">12.4%</div></div></div>
      <section class="info"><div style="display:flex;gap:8px;align-items:center"><span class="docno">CASE NO. 4092-B</span><span class="tag violet">期間限定</span><span class="stamp" style="margin-left:auto">緊急</span></div>
        <div class="ttl">中央水門 争奪案件</div>
        <div><div class="rl"><span>MAP</span>環状の川に囲まれた中央水門(終盤に開放)</div><div class="rl"><span>RULE</span>水門の制圧チームは毎秒チケットを削る</div><div class="rl"><span>LOADOUT</span>持ち込み制限なし · 使い切り2枠</div><div class="rl"><span>REWARD</span>参加5回で断章「水の底」、上位で称号</div></div>
        <div><div class="eyebrow" style="display:flex;justify-content:space-between"><span>参加報酬</span><span>3 / 5</span></div><div class="prog" style="margin-top:4px">${[1, 1, 1, 0, 0].map((x) => `<i class="${x ? "on" : ""}"></i>`).join("")}</div></div>
        <button class="cta join" style="min-width:0;height:52px;margin-top:auto"><div><div class="cta-main">JOIN CASE</div><div class="cta-sub">案件戦でマッチング開始</div></div><div class="cta-go">→</div></button>
      </section></div>`,
    mount(el) { el.querySelector(".join").addEventListener("click", () => { UX.state.mode = "event"; UX.go("matching"); }); },
  });

  // ───────── S07 ログイン ─────────
  css("login", `
  & .logo { position: absolute; left: 40px; top: 50%; transform: translateY(-50%); font-family: var(--f-display); font-weight: 700; font-size: 92px; line-height: .85; letter-spacing: -.05em; color: transparent; -webkit-text-stroke: 1.5px var(--ink); }
  & .form { position: absolute; right: 30px; top: 50%; transform: translateY(-50%); width: 380px; padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; }
  & .m { height: 40px; display: flex; align-items: center; gap: 10px; padding: 0 14px; background: var(--surface-solid); border: 1px solid var(--line-2); font-weight: 700; font-size: 11.5px; }
  & .m.on { box-shadow: 0 0 0 2px var(--ink); }
  & .m i { width: 22px; height: 22px; display: grid; place-items: center; background: var(--ink); color: #fff; font-style: normal; font-size: 10px; font-family: var(--f-mono); }
  & select { height: 30px; border: 1px solid var(--line-2); background: #fff; padding: 0 8px; font: inherit; }
  `);
  UX.screen("login", {
    title: "S07 アカウント / ログイン", group: "起動", transition: "fade",
    render: () => `<div class="screen grid-bg"><div class="logo">DREAM<br>4X</div>
      <section class="panel marks form"><div style="display:flex;justify-content:space-between"><span class="docno">FORM 4X-00 · 登録申請</span><button class="tiny dim" data-back="title">← 戻る</button></div>
        <div class="eyebrow ink">METHOD · ログイン方法</div>
        <button class="m" data-m="Apple"><i></i>Apple でサインイン</button><button class="m" data-m="Google"><i>G</i>Google でサインイン</button><button class="m" data-m="ゲスト"><i>?</i>ゲストで始める(あとで引き継ぎ)</button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px"><label><span class="eyebrow">REGION</span><select><option>TOKYO-01 · 24ms</option><option>OSAKA-01 · 31ms</option><option>SEOUL-01 · 58ms</option></select></label><label><span class="eyebrow">BIRTH</span><select><option>2000年代</option><option>2010年以降</option><option>1990年代</option></select></label></div>
        <div class="tiny dim">18歳未満の方は月の購入上限が設定されます。</div></section></div>`,
    mount(el) { for (const b of el.querySelectorAll("[data-m]")) b.addEventListener("click", () => { for (const x of el.querySelectorAll("[data-m]")) x.classList.toggle("on", x === b); UX.openDialog("terms", { method: b.dataset.m }); }); },
  });
  UX.dialogs.terms = {
    opts: { kind: "modal" },
    render: (o) => `<div class="dlg" style="width:460px"><div class="dlg-head"><div class="eyebrow">D43 · TERMS · ${o.method ?? ""}</div><b style="font-size:14px">利用規約とプライバシーポリシー</b></div>
      <div class="dlg-body"><div style="height:110px;overflow:auto;padding:8px 10px;background:var(--surface-sunk);font-size:10px;line-height:1.7;color:var(--ink-2)">第1条(適用)本規約は、国際夢域調停局(以下「当局」)が提供する潜行サービスの利用に関する条件を定めるものです。<br>第2条(登録)利用者は、本規約に同意のうえ、当局の定める方法で登録を申請するものとします。<br>第3条(禁止事項)他の潜行者への迷惑行為、不正な手段による報酬の取得、夢の外への情報の持ち出しを禁止します。<br>第4条(未成年)18歳未満の利用者は、保護者の同意を得たうえで利用するものとします。</div>
        <label style="display:flex;gap:6px;align-items:center;margin-top:8px;font-size:11px"><input type="checkbox" class="ag"> 利用規約とプライバシーポリシーに同意する</label></div>
      <div class="dlg-foot"><button class="btn ghost sm" data-close>戻る</button><button class="btn sm go disabled">同意して始める</button></div></div>`,
    mount(body, dlg) {
      const ag = body.querySelector(".ag"), go = body.querySelector(".go");
      ag.addEventListener("change", () => go.classList.toggle("disabled", !ag.checked));
      go.addEventListener("click", () => { if (!ag.checked) return UX.toast("同意にチェックしてください", "danger"); dlg.close(); UX.toast("登録しました", "ok"); UX.after(300, () => UX.reset("home")); });
    },
  };

  // ───────── S28 メンテナンス ─────────
  css("maintenance", `
  & .hz { position: absolute; left: 0; right: 0; height: 10px; background: var(--hazard); }
  & .box { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 640px; display: grid; grid-template-columns: 1fr 230px; gap: 12px; }
  & .main { padding: 18px 20px; }
  & .main .t { font-family: var(--f-display); font-weight: 700; font-size: 40px; letter-spacing: -.03em; line-height: 1; margin: 10px 0; }
  & .upd { padding: 14px; display: flex; flex-direction: column; gap: 8px; }
  `);
  UX.screen("maintenance", {
    title: "S28 メンテナンス", group: "起動", transition: "fade",
    render: () => `<div class="screen grid-bg"><div class="hz" style="top:0"></div><div class="hz" style="bottom:0"></div>
      <div class="box"><section class="panel marks main"><div style="display:flex;justify-content:space-between"><span class="docno">NOTICE · 停止中</span><span class="stamp">停止中</span></div><div class="t">04:00 — 06:00</div><div class="small dim">10月14日(火)定期メンテナンス。案件の集計と、シーズン3の追加段の反映を行います。</div><div style="display:flex;gap:6px;margin-top:12px"><button class="btn sm light chk">状態を再確認</button><button class="btn sm ghost" data-go="news">お知らせ</button><button class="btn sm ghost" data-reset="title">タイトルへ</button></div></section>
        <section class="panel upd"><div class="eyebrow ink">UPDATE REQUIRED</div><b style="font-size:13px">新しいバージョンがあります</b><div class="tiny dim">0.9.4 → 0.9.5 · 128MB</div><button class="btn sm" data-toast="ストアを開く(モック)">ストアへ</button></section></div></div>`,
    mount(el) { el.querySelector(".chk").addEventListener("click", (e) => { e.currentTarget.textContent = "確認中…"; UX.after(900, () => { UX.toast("メンテナンス中です(残り 1:12)", "danger"); el.querySelector(".chk").textContent = "状態を再確認"; }); }); },
  });
})();

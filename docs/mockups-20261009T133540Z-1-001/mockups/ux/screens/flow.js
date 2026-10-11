// 起動 → ホーム → マッチング → 文明・アドオン選択(試合の手前まで)
(function () {
  const { CIVS, CIV_ORDER } = D;

  // ───────── S01 タイトル ─────────
  UX.css(`
  [data-screen=title] .form { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 560px; display: grid; grid-template-columns: 1fr 170px; }
  [data-screen=title] .form-main { padding: 18px 22px 16px; border-right: 1px solid var(--line); }
  [data-screen=title] .logo { font-family: var(--f-display); font-weight: 700; font-size: 64px; letter-spacing: -0.04em; line-height: .9; margin-top: 16px; }
  [data-screen=title] .logo sup { font-size: 14px; letter-spacing: .1em; vertical-align: top; margin-left: 4px; font-family: var(--f-mono); color: var(--dim); }
  [data-screen=title] .input { margin-top: 4px; height: 38px; display: flex; align-items: center; gap: 8px; padding: 0 12px; background: var(--surface-solid); border: 1px solid var(--line-2); border-bottom: 2px solid var(--ink); }
  [data-screen=title] .input input { flex: 1; border: 0; outline: 0; background: transparent; font-family: var(--f-display); font-weight: 600; font-size: 17px; letter-spacing: .06em; color: var(--ink); min-width: 0; }
  [data-screen=title] .input .cnt { font-family: var(--f-mono); font-size: 9px; color: var(--dim); }
  [data-screen=title] .side { padding: 18px 14px 16px; display: flex; flex-direction: column; gap: 10px; background: rgba(243,245,247,.6); }
  [data-screen=title] .side b { font-family: var(--f-mono); font-size: 10.5px; font-weight: 500; display: block; }
  [data-screen=title] .footer-stripe { grid-column: 1 / 3; display: flex; align-items: center; gap: 10px; height: 24px; padding-right: 12px; border-top: 1px solid var(--line); font-size: 9px; color: var(--dim); }
  [data-screen=title] .footer-stripe .hz { width: 64px; height: 100%; background: var(--hazard); }
  [data-screen=title] .stamp.ok { color: var(--ok); }
  `);
  UX.screen("title", {
    title: "S01 タイトル", group: "起動", transition: "fade",
    render: () => `<div class="screen grid-bg">
      <div style="position:absolute;right:16px;top:14px;text-align:right"><div class="eyebrow">INTERNATIONAL DREAM ARBITRATION BUREAU</div><div class="eyebrow" style="margin-top:2px">国際夢域調停局 · 管制第4課</div></div>
      <section class="panel marks form">
        <div class="form-main">
          <div style="display:flex;justify-content:space-between"><span class="docno">FORM 4X-01 · 潜行許可申請</span><span class="tag">CLASSIFIED · B</span></div>
          <div class="logo">DREAM 4X<sup>β</sup></div>
          <div class="small" style="margin-top:8px;color:var(--ink-2);letter-spacing:.12em">夢の戦場で、陣営を率いよ。 — 多チーム制リアルタイム作戦卓</div>
          <div style="margin-top:18px"><div style="display:flex;justify-content:space-between"><span class="eyebrow ink">CALLSIGN / コールサイン</span><span class="eyebrow">最大12文字</span></div>
            <label class="input"><input maxlength="12" value="${UX.state.name}" placeholder="GUEST-nnn"><span class="cnt">0 / 12</span></label></div>
          <div style="margin-top:12px;display:flex;gap:8px">
            <button class="cta go" style="flex:1;min-width:0;height:50px"><div><div class="cta-main" style="font-size:18px">ゲストで潜行</div><div class="cta-sub">空欄なら GUEST-nnn を自動発行</div></div><div class="cta-go">→</div></button>
          </div>
          <button class="small dim" style="margin-top:8px;text-decoration:underline" data-go="login">アカウントでログイン(初回・引き継ぎ)</button>
        </div>
        <aside class="side">
          <div><span class="eyebrow">APPLICANT</span><b>GUEST · 未登録</b></div>
          <div><span class="eyebrow">SERVER</span><b style="display:flex;align-items:center;gap:6px"><i style="width:7px;height:7px;border-radius:50%;background:var(--ok)"></i>TOKYO-01 · 28ms</b></div>
          <div><span class="eyebrow">BUILD</span><b>0.5.2 · M5</b></div>
          <div style="margin-top:auto"><span class="stamp" style="color:var(--ink-2)">受理待ち</span></div>
        </aside>
        <div class="footer-stripe"><div class="hz"></div><span>横持ち推奨 / 本申請は夢の中でのみ有効</span><span style="margin-left:auto" class="mono">REV.2026-10</span></div>
      </section>
      <svg class="crayon-svg" style="left:690px;top:250px" width="180" height="120" viewBox="0 0 180 120"><path d="M6 20 C 50 4, 70 60, 110 40 S 170 70, 150 110" stroke-width="3"/><path d="M130 92 l18 18 M148 92 l-18 18" stroke-width="3"/></svg>
    </div>`,
    mount(el) {
      const input = el.querySelector("input"), cnt = el.querySelector(".cnt");
      const upd = () => (cnt.textContent = `${input.value.length} / 12`);
      input.addEventListener("input", upd); upd();
      const go = () => {
        UX.state.name = input.value.trim() || `GUEST-${String(Math.floor(Math.random() * 900) + 100)}`;
        el.querySelector(".stamp").textContent = "受理"; el.querySelector(".stamp").classList.add("ok");
        UX.after(350, () => UX.go("connecting", {}, { transition: "fade" }));
      };
      el.querySelector(".go").addEventListener("click", go);
      input.addEventListener("keydown", (e) => e.key === "Enter" && go());
    },
  });

  // ───────── S02 再接続中 ─────────
  UX.css(`
  [data-screen=connecting] .box { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); width: 420px; padding: 20px 22px; }
  [data-screen=connecting] .ring { width: 54px; height: 54px; border-radius: 50%; border: 3px solid var(--line); border-top-color: var(--ink); animation: ux-spin 1s linear infinite; }
  @keyframes ux-spin { to { transform: rotate(360deg); } }
  [data-screen=connecting] .st { display: grid; grid-template-columns: 16px 1fr auto; gap: 8px; align-items: center; padding: 5px 0; border-bottom: 1px solid var(--line); font-size: 10.5px; }
  [data-screen=connecting] .st i { width: 10px; height: 10px; border: 1.5px solid var(--faint); border-radius: 50%; }
  [data-screen=connecting] .st.done i { background: var(--ok); border-color: var(--ok); }
  [data-screen=connecting] .st.run i { border-color: var(--signal); border-top-color: transparent; animation: ux-spin .8s linear infinite; }
  [data-screen=connecting] .st span:last-child { font-family: var(--f-mono); font-size: 8.5px; color: var(--dim); }
  `);
  UX.screen("connecting", {
    title: "S02 再接続中", group: "起動", transition: "fade",
    render: () => `<div class="screen grid-bg"><section class="panel marks box">
      <div style="display:flex;gap:14px;align-items:center"><div class="ring"></div><div><div class="eyebrow">CONNECTING</div><div class="h1" style="font-size:22px">${UX.state.name}</div><div class="small dim">サーバーに接続しています</div></div></div>
      <div style="margin-top:12px">
        <div class="st run" data-k="0"><i></i><span>回線の確立</span><span>WS</span></div>
        <div class="st" data-k="1"><i></i><span>潜行許可の照合</span><span>AUTH</span></div>
        <div class="st" data-k="2"><i></i><span>プロフィールの取得</span><span>PROFILE</span></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px"><span class="tiny dim">失敗時は 0.5〜8 秒の間隔で自動再試行</span><button class="btn sm ghost" data-go="title" data-tr="fade">別の名前で入る</button></div>
    </section></div>`,
    mount(el) {
      const st = [...el.querySelectorAll(".st")];
      [450, 900, 1350].forEach((t, i) => UX.after(t, () => { st[i].classList.remove("run"); st[i].classList.add("done"); st[i + 1]?.classList.add("run"); }));
      UX.after(1700, () => UX.reset("home"));
    },
  });

  // ───────── S09 ホーム ─────────
  UX.css(`
  [data-screen=home] .home-bg { position: absolute; inset: 0; overflow: hidden; transition: background .4s; }
  [data-screen=home] .bg-art { position: absolute; inset: 0; transition: opacity .35s; background: var(--hatch), radial-gradient(70% 90% at 28% 60%, color-mix(in srgb, var(--cc) 42%, #fff), transparent 72%), linear-gradient(115deg, color-mix(in srgb, var(--cc) 14%, #eef1f4) 0%, #e9edf1 55%, #dfe4e9 100%); }
  [data-screen=home] .civ-word { position: absolute; left: 30px; bottom: -34px; font-family: var(--f-display); font-weight: 700; font-size: 230px; line-height: 1; letter-spacing: -0.06em; color: transparent; -webkit-text-stroke: 1px color-mix(in srgb, var(--cc) 55%, transparent); opacity: .6; }
  [data-screen=home] .fade { position: absolute; right: 0; top: 0; bottom: 0; width: 46%; background: linear-gradient(90deg, transparent, rgba(240,243,246,.92) 32%); }
  [data-screen=home] .topbar { background: linear-gradient(180deg, rgba(255,255,255,.7), transparent); border-bottom: 0; backdrop-filter: none; }
  [data-screen=home] .leader { position: absolute; left: 70px; top: 18px; bottom: 0; width: 380px; z-index: 2; }
  [data-screen=home] .leader .ph { position: absolute; inset: 0; border-bottom: 0; background: var(--hatch), linear-gradient(180deg, color-mix(in srgb, var(--cc) 26%, rgba(255,255,255,.7)), rgba(255,255,255,.35)); }
  [data-screen=home] .leader.swap .ph { animation: ux-leader-in .45s cubic-bezier(.2,.8,.2,1); }
  @keyframes ux-leader-in { from { transform: translateX(-24px); opacity: 0; } }
  [data-screen=home] .plate { position: absolute; left: 56px; bottom: 72px; z-index: 3; }
  [data-screen=home] .plate .name { font-family: var(--f-display); font-size: 52px; font-weight: 700; letter-spacing: -0.04em; line-height: .9; }
  [data-screen=home] .plate .tag.solid { background: var(--cc); border-color: var(--cc); }
  [data-screen=home] .radio { position: absolute; left: 56px; bottom: 14px; width: 360px; z-index: 3; display: flex; gap: 8px; align-items: flex-start; padding: 8px 12px; background: rgba(14,22,30,.9); color: #fff; clip-path: var(--cut-sm); text-align: left; }
  [data-screen=home] .radio p { font-size: 10.5px; line-height: 1.5; flex: 1; }
  [data-screen=home] .radio .wave { display: flex; gap: 2px; align-items: center; height: 14px; }
  [data-screen=home] .radio .wave i { width: 2px; background: var(--signal); animation: ux-wave .7s ease-in-out infinite alternate; }
  [data-screen=home] .radio .wave i:nth-child(2) { animation-delay: .15s; } [data-screen=home] .radio .wave i:nth-child(3) { animation-delay: .3s; } [data-screen=home] .radio .wave i:nth-child(4) { animation-delay: .1s; }
  @keyframes ux-wave { from { height: 3px; } to { height: 14px; } }
  [data-screen=home] .civ-rail { position: absolute; left: 12px; top: 58px; z-index: 4; display: flex; flex-direction: column; gap: 4px; }
  [data-screen=home] .civ-rail button { width: 34px; height: 34px; font-family: var(--f-mono); font-size: 8px; font-weight: 700; background: rgba(255,255,255,.75); border: 1px solid var(--line); position: relative; }
  [data-screen=home] .civ-rail button::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: var(--c); }
  [data-screen=home] .civ-rail button.on { background: var(--ink); color: #fff; border-color: var(--ink); }
  [data-screen=home] .side { position: absolute; right: 16px; top: 54px; bottom: 14px; width: 352px; z-index: 4; display: flex; flex-direction: column; gap: 8px; }
  [data-screen=home] .case { display: grid; grid-template-columns: 96px 1fr; overflow: hidden; text-align: left; }
  [data-screen=home] .case .ph { border: 0; border-right: 1px dashed var(--line-2); }
  [data-screen=home] .mini { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  [data-screen=home] .mini .panel { padding: 7px 10px; min-width: 0; text-align: left; }
  [data-screen=home] .mini .t { font-size: 10px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  [data-screen=home] .nav { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; }
  [data-screen=home] .nav-item { height: 46px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; background: var(--surface); border: 1px solid var(--line); backdrop-filter: var(--glass-blur); position: relative; }
  [data-screen=home] .nav-item .ic { width: 18px; height: 18px; border: 1.5px solid var(--ink); display: grid; place-items: center; font-family: var(--f-mono); font-size: 8.5px; font-weight: 700; }
  [data-screen=home] .nav-item span { font-size: 8.5px; font-weight: 700; white-space: nowrap; }
  [data-screen=home] .nav-item .badge-dot { right: 3px; top: 3px; }
  [data-screen=home] .bg-label { padding-top: 6px; border-top: 1px dashed var(--line-2); text-align: right; font-size: 8.5px; color: var(--dim); }
  [data-screen=home] .deploy { display: flex; gap: 8px; margin-top: auto; }
  [data-screen=home] .mode-chip { display: flex; flex-direction: column; justify-content: center; padding: 0 12px; border: 1px solid var(--line-2); background: var(--surface-solid); text-align: left; }
  `);
  const MODES = { casual: ["カジュアル", "レート変動なし"], rank: ["ランク戦", "3陣営 · 30分"], event: ["案件戦", "中央水門 争奪"], practice: ["練習", "ボット相手"] };
  UX.screen("home", {
    title: "S09 ホーム", group: "ホーム", transition: "fade",
    render: () => {
      const c = CIVS[UX.state.homeCiv], m = MODES[UX.state.mode];
      return `<div class="screen" style="--cc:${c.c}">
      <div class="home-bg"><div class="bg-art"></div><div class="civ-word">${c.short}</div><div class="fade"></div></div>
      <header class="topbar">
        <div class="title"><span class="eyebrow">DREAM OPERATIONS</span><b>DREAM 4X</b></div>
        <div class="spacer"></div>
        <button data-go="profile" style="display:flex;align-items:center;gap:8px;padding:3px 10px 3px 3px;border:1px solid var(--line);background:var(--surface-solid);border-radius:16px">${D.phRound(24, "PF")}<div style="line-height:1.1;text-align:left"><b style="font-size:10.5px">${UX.state.name}</b><div class="tiny dim mono">LV 23 · 参事官 II</div></div></button>
        <button data-go="shop">${D.wallet()}</button>
        <button class="icon-btn" data-go="news">✉${UX.state.readNews ? "" : '<span class="badge-dot">3</span>'}</button>
        <button class="icon-btn" data-go="settings">⚙</button>
      </header>
      <nav class="civ-rail">${CIV_ORDER.map((id) => `<button data-civ="${id}" class="${id === c.id ? "on" : ""}" style="--c:${CIVS[id].c}">${CIVS[id].short}</button>`).join("")}</nav>
      <section class="leader"><div class="ph"><span class="ph-k">LEADER STANDING ART · LARGE</span><span class="ph-d">${c.en} 立ち絵(膝上〜全身)/ 衣装で差し替え</span></div></section>
      <div class="plate"><div class="eyebrow ink">ASSIGNED LEADER</div><div class="name">${c.en}</div><div style="display:flex;gap:6px;align-items:center;margin-top:6px"><span class="tag solid">${c.short}</span><span class="jp-sub">${c.name} · ${c.leader} · Lv.${c.lv}</span></div></div>
      <button class="radio"><div class="wave"><i></i><i></i><i></i><i></i></div><p>${c.line}</p><span class="mono tiny" style="color:rgba(255,255,255,.5)">VOICE ▸</span></button>
      <main class="side">
        <button class="panel marks case" data-go="event">
          <div class="ph"><span class="ph-k" style="font-size:7px">CASE ART</span></div>
          <div style="padding:8px 10px;display:flex;flex-direction:column;gap:3px;min-width:0">
            <div style="display:flex;gap:8px;align-items:center"><span class="docno">CASE NO. 4092-B</span><span class="tag violet">期間限定</span></div>
            <div style="font-size:13.5px;font-weight:900">中央水門 争奪案件</div>
            <div class="tiny dim">終盤に中央水門が開く特殊マップ。制圧で断章「水の底」</div>
            <div style="display:flex;gap:8px;align-items:center"><span class="num" style="font-size:13px">2<span class="tiny">d</span> 14<span class="tiny">h</span></span><div class="bar" style="flex:1"><i style="width:60%"></i></div><span class="mono tiny dim">3/5</span></div>
          </div>
        </button>
        <div class="mini">
          <button class="panel" data-go="news"><div class="eyebrow ink" style="display:flex;justify-content:space-between">BULLETIN${UX.state.readNews ? "" : '<span class="tag danger" style="height:14px">NEW 3</span>'}</div><div class="t" style="margin-top:3px">中央水門 争奪案件を開始</div><div class="t dim">S3 パス 追加段を公開</div></button>
          <button class="panel" data-go="rank"><div class="eyebrow ink">SEASON 03</div><div style="display:flex;align-items:baseline;gap:6px;margin-top:2px"><b style="font-size:13px">参事官 II</b><span class="mono tiny" style="color:var(--ok)">▲18</span></div><div class="bar" style="margin-top:4px"><i style="width:72%"></i></div><div class="tiny dim" style="margin-top:2px">RATING 1,642 · 次の段まで 58</div></button>
        </div>
        <nav class="nav">
          <button class="nav-item" data-go="civ_list"><div class="ic">R</div><span>文明研究</span><span class="badge-dot">!</span></button>
          <button class="nav-item" data-go="leader"><div class="ic">L</div><span>指導者</span></button>
          <button class="nav-item" data-go="armory"><div class="ic">A</div><span>装備庫</span></button>
          <button class="nav-item" data-go="pass"><div class="ic">P</div><span>パス</span><span class="badge-dot">2</span></button>
          <button class="nav-item" data-go="shop"><div class="ic">S</div><span>ショップ</span></button>
          <button class="nav-item" data-go="story"><div class="ic">N</div><span>物語</span></button>
        </nav>
        <div class="bg-label">HOME BG · ${c.short} / ${c.bg}</div>
        <div class="deploy">
          <button class="mode-chip" data-dialog="mode_select"><span class="eyebrow">MODE ▾</span><b style="font-size:11px">${m[0]}</b><span class="tiny dim">${m[1]}</span></button>
          <button class="cta" style="flex:1;min-width:0" data-go="matching"><div><div class="cta-main">DEPLOY</div><div class="cta-sub">潜行開始 · 推定 0:42</div></div><div class="cta-go">→</div></button>
        </div>
      </main>
    </div>`;
    },
    mount(el) {
      // 指導者の切替: 画面全体を描き直さず、該当部分だけ差し替えて立ち絵をアニメーションさせる
      for (const b of el.querySelectorAll(".civ-rail button")) b.addEventListener("click", () => {
        if (UX.state.homeCiv === b.dataset.civ) return;
        UX.state.homeCiv = b.dataset.civ;
        const fresh = UX.h(`<div>${UX.screens.home.render()}</div>`).firstElementChild;
        el.replaceChildren(fresh);
        fresh.querySelector(".leader").classList.add("swap");
        UX.screens.home.mount(el);
      });
      el.querySelector(".radio").addEventListener("click", () => UX.toast(`${CIVS[UX.state.homeCiv].leader} のボイスを再生`, "signal"));
    },
  });
  UX.dialogs.mode_select = {
    opts: { kind: "sheet" },
    render: () => `<div style="background:var(--surface-solid);padding:12px 16px 14px;box-shadow:0 -20px 40px -20px rgba(14,22,30,.4)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div><div class="eyebrow">MODE · D28</div><b style="font-size:13px">モードを選ぶ</b></div><button class="btn sm ghost" data-close>閉じる</button></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${Object.entries(MODES).map(([k, [n, d]]) => `<button class="card ${k === UX.state.mode ? "sel" : ""}" data-mode="${k}" style="padding:10px;text-align:left"><b style="font-size:12px">${n}</b><div class="tiny dim">${d}</div><div class="tiny" style="margin-top:6px;color:var(--ink-2)">${k === "rank" ? "使い切りは2枠まで" : k === "event" ? "持ち込み制限なし" : k === "practice" ? "報酬なし" : "使い切りの消費なし"}</div></button>`).join("")}</div>
    </div>`,
    mount(body, dlg) {
      for (const b of body.querySelectorAll("[data-mode]")) b.addEventListener("click", () => {
        UX.state.mode = b.dataset.mode; dlg.close();
        UX.go("home", {}, { replace: true, transition: "none" });
        UX.toast(`モード: ${MODES[b.dataset.mode][0]}`);
      });
    },
  };

  // ───────── S10 マッチング ─────────
  UX.css(`
  [data-screen=matching] .wrap { position: absolute; inset: 44px 0 0 0; display: grid; grid-template-columns: 1fr 330px; gap: 12px; padding: 12px 16px; }
  [data-screen=matching] .modes { display: flex; flex-direction: column; gap: 4px; }
  [data-screen=matching] .mode { display: grid; grid-template-columns: 1fr auto; padding: 8px 12px; background: var(--surface-solid); border: 1px solid var(--line); text-align: left; }
  [data-screen=matching] .mode.on { box-shadow: 0 0 0 2px var(--ink); }
  [data-screen=matching] .party { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; }
  [data-screen=matching] .party > div { height: 54px; display: flex; align-items: center; gap: 8px; padding: 0 10px; border: 1px dashed var(--line-2); font-size: 10px; }
  [data-screen=matching] .party > div.me { border: 1px solid var(--line); background: var(--surface-solid); }
  [data-screen=matching] .radar { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; background: var(--ink); color: #fff; clip-path: var(--cut); }
  [data-screen=matching] .scope { position: relative; width: 150px; height: 150px; border-radius: 50%; border: 1px solid rgba(255,255,255,.2); background: repeating-radial-gradient(circle, transparent 0 24px, rgba(255,255,255,.08) 24px 25px); overflow: hidden; }
  [data-screen=matching] .scope::after { content: ""; position: absolute; inset: 0; background: conic-gradient(from 0deg, rgba(0,180,224,.5), transparent 25%); animation: ux-spin 2.2s linear infinite; border-radius: 50%; }
  [data-screen=matching] .blip { position: absolute; width: 8px; height: 8px; transform: rotate(45deg); opacity: 0; transition: opacity .3s; z-index: 2; }
  [data-screen=matching] .blip.on { opacity: 1; }
  [data-screen=matching] .elapsed { font-family: var(--f-display); font-weight: 700; font-size: 30px; line-height: 1; }
  `);
  UX.screen("matching", {
    title: "S10 マッチング", group: "ホーム",
    render: () => `<div class="screen grid-bg">${D.topbar("MATCHMAKING", "マッチング")}
      <div class="wrap">
        <section>
          <div class="eyebrow ink" style="margin-bottom:6px">MODE</div>
          <div class="modes">${Object.entries(MODES).map(([k, [n, d]]) => `<button class="mode ${k === UX.state.mode ? "on" : ""}" data-mode="${k}"><div><b style="font-size:12px">${n}</b><div class="tiny dim">${d}</div></div><span class="mono tiny dim" style="align-self:center">${k === "rank" ? "推定 0:42" : k === "event" ? "推定 1:10" : k === "casual" ? "推定 0:25" : "即時"}</span></button>`).join("")}</div>
          <div class="eyebrow ink" style="margin-top:10px">PARTY · 1 / 3</div>
          <div class="party"><div class="me">${D.phRound(30)}<div><b>${UX.state.name}</b><div class="tiny dim">リーダー</div></div></div><div data-toast="フレンド招待(モック)">＋ 招待</div><div data-toast="フレンド招待(モック)">＋ 招待</div></div>
        </section>
        <section class="radar">
          <div class="scope"><i class="blip" style="left:40px;top:50px;background:var(--team-b)"></i><i class="blip" style="left:100px;top:90px;background:var(--team-c)"></i></div>
          <div class="eyebrow" style="color:rgba(255,255,255,.6)">SEARCHING · <span class="found">1</span> / 3 陣営</div>
          <div class="elapsed">0:00</div>
          <button class="btn light sm" data-back>キャンセル</button>
        </section>
      </div></div>`,
    mount(el) {
      let t = 0;
      const elapsed = el.querySelector(".elapsed"), found = el.querySelector(".found"), blips = el.querySelectorAll(".blip");
      UX.every(1000, () => { t++; elapsed.textContent = D.mmss(t); });
      UX.after(1600, () => { blips[0].classList.add("on"); found.textContent = 2; });
      UX.after(3000, () => { blips[1].classList.add("on"); found.textContent = 3; });
      UX.after(3600, () => UX.openDialog("match_found"));
      UX.after(5600, () => { UX.state.pickLeft = 45; UX.go("pick_civ", {}, { transition: "up" }); });
      for (const b of el.querySelectorAll("[data-mode]")) b.addEventListener("click", () => { UX.state.mode = b.dataset.mode; for (const x of el.querySelectorAll("[data-mode]")) x.classList.toggle("on", x === b); });
    },
  });
  UX.dialogs.match_found = {
    opts: { kind: "modal", dark: true, dismiss: false },
    render: () => `<div class="dark" style="width:460px;padding:18px 22px;background:#0e161e;clip-path:var(--cut);text-align:center">
      <div class="eyebrow" style="color:var(--warn)">MATCH FOUND · CASE NO. DR-09F9DB4F</div>
      <div class="display" style="font-size:40px;margin:6px 0 12px">案件成立</div>
      <div style="display:flex;justify-content:center;gap:10px">${["a", "b", "c"].map((k) => `<div class="t-${k}" style="display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid rgba(255,255,255,.15)"><span class="sym ${D.TEAMS[k].sym}"></span><b class="mono" style="font-size:11px">TEAM ${D.TEAMS[k].key}</b>${k === "a" ? '<span class="tag" style="color:#fff;border-color:rgba(255,255,255,.4)">YOU</span>' : ""}</div>`).join("")}</div>
      <div class="tiny" style="color:rgba(255,255,255,.5);margin-top:12px">所属と装備の選択へ移ります</div>
    </div>`,
  };

  // ───────── S04 選択(1/2 所属、2/2 装備)共通 ─────────
  UX.css(`
  .pick .teambadge { display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; background: var(--team-a); color: #fff; font-family: var(--f-mono); font-weight: 700; font-size: 10px; letter-spacing: .12em; clip-path: var(--cut-sm); }
  .pick .teambadge .sym { background: #fff; }
  .pick .steps { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: var(--faint); }
  .pick .steps .on, .pick .steps .done { color: var(--ink); }
  .pick .steps .n { display: inline-grid; place-items: center; width: 16px; height: 16px; border: 1.5px solid currentColor; font-family: var(--f-mono); font-size: 8.5px; margin-right: 4px; }
  .pick .steps .on .n { background: var(--ink); color: #fff; border-color: var(--ink); }
  .pick .steps .line { width: 24px; height: 1px; background: var(--line-2); }
  .pick .clock { display: flex; align-items: baseline; gap: 6px; }
  .pick .clock .num { font-size: 24px; line-height: 1; font-variant-numeric: tabular-nums; }
  .pick .clock.low .num { color: var(--danger); }
  .pick .clock .bar { width: 90px; align-self: center; }
  .pick .clock .bar > i { background: var(--warn); transition: width 1s linear; }
  [data-screen=pick_civ] .stage { position: absolute; inset: 44px 0 0 0; overflow: hidden; transition: background .3s; background: var(--hatch), radial-gradient(60% 90% at 42% 70%, color-mix(in srgb, var(--cc) 40%, #fff), transparent 72%), linear-gradient(115deg, #eef1f4, #dfe4e9); }
  [data-screen=pick_civ] .stage .word { position: absolute; left: 190px; bottom: -40px; font-family: var(--f-display); font-weight: 700; font-size: 220px; line-height: 1; letter-spacing: -0.06em; color: transparent; -webkit-text-stroke: 1px color-mix(in srgb, var(--cc) 60%, transparent); }
  [data-screen=pick_civ] .civ-list { position: absolute; left: 12px; top: 56px; bottom: 12px; width: 170px; display: flex; flex-direction: column; gap: 4px; z-index: 3; }
  [data-screen=pick_civ] .civ { position: relative; flex: 1; display: grid; grid-template-columns: 30px 1fr auto; align-items: center; gap: 8px; padding: 0 10px 0 12px; background: rgba(255,255,255,.82); border: 1px solid var(--line); text-align: left; transition: transform .15s, background .15s; }
  [data-screen=pick_civ] .civ::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--c); }
  [data-screen=pick_civ] .civ .ab { font-family: var(--f-mono); font-size: 9.5px; font-weight: 700; line-height: 1.1; }
  [data-screen=pick_civ] .civ .nm { font-size: 9px; color: var(--ink-2); white-space: nowrap; }
  [data-screen=pick_civ] .civ .lv { font-family: var(--f-display); font-weight: 700; font-size: 13px; }
  [data-screen=pick_civ] .civ.on { background: var(--ink); color: #fff; border-color: var(--ink); transform: translateX(6px); }
  [data-screen=pick_civ] .civ.on .nm { color: rgba(255,255,255,.6); }
  [data-screen=pick_civ] .leader { position: absolute; left: 210px; top: 52px; bottom: 0; width: 330px; z-index: 2; }
  [data-screen=pick_civ] .leader .ph { position: absolute; inset: 0; border-bottom: 0; background: var(--hatch), linear-gradient(180deg, color-mix(in srgb, var(--cc) 24%, rgba(255,255,255,.75)), rgba(255,255,255,.3)); animation: ux-leader-in .4s cubic-bezier(.2,.8,.2,1); }
  [data-screen=pick_civ] .quote { position: absolute; left: 232px; bottom: 14px; width: 290px; z-index: 3; padding: 7px 10px; background: rgba(14,22,30,.9); color: #fff; font-size: 10px; clip-path: var(--cut-sm); }
  [data-screen=pick_civ] .info { position: absolute; right: 14px; top: 56px; bottom: 12px; width: 330px; z-index: 3; display: flex; flex-direction: column; gap: 8px; }
  [data-screen=pick_civ] .info .name { font-family: var(--f-display); font-size: 40px; font-weight: 700; letter-spacing: -0.04em; line-height: .95; }
  [data-screen=pick_civ] .info .tag.solid { background: var(--cc); border-color: var(--cc); }
  [data-screen=pick_civ] .coef { display: grid; grid-template-columns: repeat(4, 1fr); }
  [data-screen=pick_civ] .coef > div { padding: 6px 8px; border-right: 1px solid var(--line); }
  [data-screen=pick_civ] .coef .v { font-family: var(--f-display); font-weight: 700; font-size: 15px; line-height: 1.1; }
  [data-screen=pick_addon] .side { position: absolute; left: 0; top: 44px; bottom: 0; width: 230px; overflow: hidden; background: var(--hatch), radial-gradient(90% 70% at 50% 80%, color-mix(in srgb, var(--cc) 40%, #fff), transparent 75%), #e6eaee; border-right: 1px solid var(--line); }
  [data-screen=pick_addon] .side .ph { position: absolute; left: 20px; right: 20px; top: 14px; bottom: 0; border-bottom: 0; }
  [data-screen=pick_addon] .side .plate { position: absolute; left: 12px; right: 12px; bottom: 12px; padding: 8px 10px; background: rgba(255,255,255,.9); }
  [data-screen=pick_addon] .main { position: absolute; left: 244px; right: 14px; top: 54px; bottom: 12px; display: flex; flex-direction: column; gap: 8px; }
  [data-screen=pick_addon] .aslots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  [data-screen=pick_addon] .aslot { height: 40px; border: 1px dashed var(--line-2); display: flex; align-items: center; gap: 8px; padding: 0 10px; background: rgba(255,255,255,.4); text-align: left; }
  [data-screen=pick_addon] .aslot .k { font-family: var(--f-display); font-weight: 700; font-size: 15px; color: var(--faint); }
  [data-screen=pick_addon] .aslot.on { border: 0; background: var(--ink); color: #fff; animation: ux-pop .2s ease; }
  [data-screen=pick_addon] .aslot.on.cons { box-shadow: inset 0 3px 0 var(--crayon); }
  [data-screen=pick_addon] .aslot .x { margin-left: auto; font-family: var(--f-mono); opacity: .5; }
  @keyframes ux-pop { from { transform: scale(.94); } }
  [data-screen=pick_addon] .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; flex: 1; min-height: 0; }
  [data-screen=pick_addon] .ad { padding: 8px 10px; text-align: left; display: flex; flex-direction: column; gap: 2px; position: relative; transition: background .12s; }
  [data-screen=pick_addon] .ad b { font-size: 11.5px; }
  [data-screen=pick_addon] .ad .ds { font-size: 9.5px; color: var(--ink-2); line-height: 1.35; }
  [data-screen=pick_addon] .ad .kd { margin-top: auto; display: flex; justify-content: space-between; font-family: var(--f-mono); font-size: 8.5px; color: var(--dim); }
  [data-screen=pick_addon] .ad.cons { border-top: 2px solid var(--crayon); }
  [data-screen=pick_addon] .ad.on { background: var(--ink); color: #fff; border-color: var(--ink); }
  [data-screen=pick_addon] .ad.on .ds, [data-screen=pick_addon] .ad.on .kd { color: rgba(255,255,255,.65); }
  [data-screen=pick_addon] .ad.on::after { content: "✓"; position: absolute; right: 8px; top: 6px; font-size: 12px; }
  [data-screen=pick_addon] .ad.locked { opacity: .45; background: repeating-linear-gradient(135deg, #fff 0 5px, var(--surface-sunk) 5px 10px); }
  [data-screen=pick_addon] .ad.hide { display: none; }
  [data-screen=pick_addon] .done-veil { position: absolute; inset: 44px 0 0 0; z-index: 20; display: grid; place-items: center; background: rgba(233,237,241,.7); backdrop-filter: blur(3px); }
  `);
  const clock = () => `<div class="clock"><span class="eyebrow">LOCK IN</span><span class="num">${D.mmss(UX.state.pickLeft ?? 45)}</span><div class="bar"><i style="width:${((UX.state.pickLeft ?? 45) / 45) * 100}%"></i></div></div>`;
  const tickClock = (el, onZero) => UX.every(1000, () => {
    UX.state.pickLeft = Math.max(0, (UX.state.pickLeft ?? 45) - 1);
    const c = el.querySelector(".clock");
    c.querySelector(".num").textContent = D.mmss(UX.state.pickLeft);
    c.querySelector(".bar i").style.width = (UX.state.pickLeft / 45) * 100 + "%";
    c.classList.toggle("low", UX.state.pickLeft <= 10);
    if (UX.state.pickLeft === 0) onZero();
  });
  const lockIn = (el) => {
    el.querySelector(".screen").insertAdjacentHTML("beforeend", `<div class="done-veil" style="position:absolute;inset:44px 0 0 0;z-index:20;display:grid;place-items:center;background:rgba(233,237,241,.7);backdrop-filter:blur(3px)"><div style="text-align:center"><div class="stamp" style="color:var(--ok);font-size:14px">決定済み</div><div class="small dim" style="margin-top:8px">他の陣営の選択を待っています…</div></div></div>`);
    UX.after(1500, () => UX.go("match", {}, { transition: "dive" }));
  };

  UX.screen("pick_civ", {
    title: "S04 選択 1/2 所属", group: "試合前", transition: "up",
    render: () => {
      const c = CIVS[UX.state.civ];
      const last = UX.state.lastAddons.map((id) => D.addon(id).name).join(" · ");
      return `<div class="screen pick" style="--cc:${c.c}">
      <div class="stage"><div class="word">${c.short}</div></div>
      <header class="topbar"><div class="title"><span class="eyebrow">SELECTION 1 / 2</span><b>所属を選ぶ</b></div><div class="teambadge"><span class="sym diamond"></span>TEAM A</div>
        <div class="steps"><span class="on"><span class="n">1</span>所属</span><span class="line"></span><span><span class="n">2</span>装備</span></div><div class="spacer"></div>${clock()}</header>
      <nav class="civ-list">${CIV_ORDER.map((id) => { const x = CIVS[id]; return `<button class="civ ${id === c.id ? "on" : ""}" data-civ="${id}" style="--c:${x.c}">${D.phRound(30)}<div><div class="ab">${x.short}</div><div class="nm">${x.name}</div></div><div class="lv"><small class="mono" style="font-size:7px;opacity:.6">LV</small>${x.lv}</div></button>`; }).join("")}</nav>
      <section class="leader"><div class="ph"><span class="ph-k">LEADER STANDING ART · LARGE</span><span class="ph-d">${c.leader} 立ち絵(膝上)/ 選択中の衣装</span></div></section>
      <div class="quote">「${c.line}」</div>
      <aside class="info">
        <div><div class="eyebrow ink">LEADER · ${c.leader}</div><div class="name">${c.en}</div><div style="font-size:15px;font-weight:900;margin-top:2px">${c.name}</div><div style="display:flex;gap:6px;align-items:center;margin-top:4px"><span class="tag solid">${c.short}</span><span class="jp-sub">${c.tagline}</span></div></div>
        <div class="panel coef">${c.coef.map(([k, v, cl]) => `<div><div class="eyebrow">${k}</div><div class="v" style="color:var(--${cl === "dim" ? "dim" : cl})">${v}</div></div>`).join("")}</div>
        <div class="panel" style="display:flex;gap:8px;align-items:center;padding:7px 10px"><div style="width:26px;height:26px;background:var(--ink);color:#fff;display:grid;place-items:center;font-family:var(--f-mono);font-size:9px;clip-path:var(--cut-sm)">OP</div><div><div class="eyebrow">LEADER ORDER</div><b style="font-size:11px">${c.order}</b><span class="tiny dim"> · ${c.orderDesc}</span></div></div>
        <div style="margin-top:auto;display:flex;flex-direction:column;gap:6px">
          <button class="btn ghost block quick" style="height:30px">前回の装備で決定(${last})</button>
          <button class="cta" style="min-width:0;height:50px" data-go="pick_addon"><div><div class="cta-main" style="font-size:19px">次へ: 装備</div><div class="cta-sub">所属を確定してアドオンを選ぶ</div></div><div class="cta-go">→</div></button>
        </div>
      </aside></div>`;
    },
    mount(el) {
      tickClock(el, () => { UX.toast("時間切れ: 選択中の所属と前回の装備で決定", "danger"); lockIn(el); });
      for (const b of el.querySelectorAll("[data-civ]")) b.addEventListener("click", () => {
        UX.state.civ = b.dataset.civ;
        UX.go("pick_civ", {}, { replace: true, transition: "none" });
      });
      el.querySelector(".quick").addEventListener("click", () => { UX.state.addons = [...UX.state.lastAddons]; lockIn(el); });
    },
  });

  UX.screen("pick_addon", {
    title: "S04b 選択 2/2 装備", group: "試合前",
    render: () => {
      const c = CIVS[UX.state.civ];
      return `<div class="screen pick grid-bg" style="--cc:${c.c}">
      <header class="topbar"><div class="title"><span class="eyebrow">SELECTION 2 / 2</span><b>装備を選ぶ</b></div><div class="teambadge"><span class="sym diamond"></span>TEAM A</div>
        <div class="steps"><span class="done"><span class="n">✓</span>所属</span><span class="line" style="background:var(--ink)"></span><span class="on"><span class="n">2</span>装備</span></div><div class="spacer"></div>${clock()}</header>
      <aside class="side">${D.ph("LEADER · BUST", `${c.leader} 腰上 縦長`, "tinted", `--tc:${c.c}`)}
        <button class="btn sm light" style="position:absolute;left:12px;top:12px;z-index:2" data-back>← 所属</button>
        <div class="plate"><div class="eyebrow">${c.short} · LV ${c.lv}</div><div style="font-family:var(--f-display);font-size:22px;font-weight:700;letter-spacing:-.03em;line-height:1">${c.en}</div><div class="tiny dim" style="margin-top:2px">${c.coef.slice(0, 3).map((x) => x[0] + " " + x[1]).join(" · ")}</div></div></aside>
      <main class="main">
        <div class="aslots"></div>
        <div style="display:flex;align-items:center;gap:8px"><div class="seg filter"><span class="on" data-f="all">すべて 8</span><span data-f="perm">永続 5</span><span data-f="cons">使い切り 3</span></div><span class="tiny dim">使い切りは2枠まで(ランク戦)· 在庫は装備庫と共通</span></div>
        <div class="grid">${D.ADDONS.map((a) => {
          const locked = (a.lockLv && a.lockLv > c.lv) || (a.kind === "cons" && a.stock === 0);
          return `<button class="card ad ${a.kind === "cons" ? "cons" : ""} ${locked ? "locked" : ""}" data-ad="${a.id}" data-kind="${a.kind}">${D.ph("IC", "", "", "width:26px;height:26px;margin-bottom:4px")}<b>${a.name}</b><span class="ds">${a.desc}</span><span class="kd"><span ${a.kind === "cons" && !locked ? 'style="color:var(--crayon)"' : ""}>${a.lockLv && a.lockLv > c.lv ? `LOCK · Lv.${a.lockLv}` : a.kind === "cons" ? (a.stock ? `使い切り · 在庫 ${a.stock}` : "在庫なし") : "永続"}</span><span>${"★".repeat(a.rare)}</span></span></button>`;
        }).join("")}</div>
        <div style="display:flex;gap:8px;align-items:center"><span class="small" style="flex:1;color:var(--ink-2)">時間切れのときは、今の選択(空き枠はそのまま)で自動的に決定します。</span>
          <button class="cta decide" style="min-width:220px;height:48px"><div><div class="cta-main" style="font-size:19px">決定</div><div class="cta-sub">決定後は変更できません</div></div><div class="cta-go">→</div></button></div>
      </main></div>`;
    },
    mount(el) {
      const c = CIVS[UX.state.civ];
      const sel = UX.state.addons;
      const draw = () => {
        el.querySelector(".aslots").innerHTML = [0, 1, 2, 3].map((i) => { const a = sel[i] && D.addon(sel[i]); return a ? `<button class="aslot on ${a.kind === "cons" ? "cons" : ""}" data-rm="${a.id}"><span class="k">${i + 1}</span><b style="font-size:11px">${a.name}</b><span class="x">×</span></button>` : `<div class="aslot"><span class="k">${i + 1}</span><span class="dim small">空き · カードをタップ</span></div>`; }).join("");
        for (const b of el.querySelectorAll(".ad")) b.classList.toggle("on", sel.includes(b.dataset.ad));
        for (const b of el.querySelectorAll("[data-rm]")) b.addEventListener("click", () => { sel.splice(sel.indexOf(b.dataset.rm), 1); draw(); });
      };
      for (const b of el.querySelectorAll(".ad")) b.addEventListener("click", () => {
        const a = D.addon(b.dataset.ad);
        if (b.classList.contains("locked")) return UX.toast(a.lockLv && a.lockLv > c.lv ? `${a.name}: 文明 Lv.${a.lockLv} で開放` : `${a.name}: 在庫がありません(装備庫で確認)`, "danger");
        if (sel.includes(a.id)) sel.splice(sel.indexOf(a.id), 1);
        else if (sel.length >= 4) return UX.toast("装備枠は4つまで。上の枠をタップで外せます", "danger");
        else if (a.kind === "cons" && sel.filter((x) => D.addon(x).kind === "cons").length >= 2) return UX.toast("使い切りは2枠まで(ランク戦)", "danger");
        else sel.push(a.id);
        draw();
      });
      for (const f of el.querySelectorAll(".filter span")) f.addEventListener("click", () => {
        for (const x of el.querySelectorAll(".filter span")) x.classList.toggle("on", x === f);
        for (const b of el.querySelectorAll(".ad")) b.classList.toggle("hide", f.dataset.f !== "all" && b.dataset.kind !== f.dataset.f);
      });
      el.querySelector(".decide").addEventListener("click", () => { UX.state.lastAddons = [...sel]; lockIn(el); });
      tickClock(el, () => { UX.toast("時間切れ: 今の選択で決定", "danger"); lockIn(el); });
      draw();
    },
  });
})();

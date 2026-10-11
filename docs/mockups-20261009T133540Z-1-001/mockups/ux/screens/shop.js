// ショップ・購入の確認・ガチャ・提供割合
(function () {
  const css = (id, text) => UX.css(text.replaceAll("&", `[data-screen=${id}]`));

  // ───────── S15 ショップ ─────────
  css("shop", `
  & .cats { position: absolute; left: 0; top: 44px; bottom: 0; width: 130px; padding: 10px 0; border-right: 1px solid var(--line); background: rgba(255,255,255,.5); }
  & .cat { display: flex; justify-content: space-between; width: 100%; padding: 9px 14px; font-size: 12px; font-weight: 700; color: var(--dim); text-align: left; }
  & .cat.on { color: var(--ink); background: #fff; box-shadow: inset 3px 0 0 var(--ink); }
  & .cat span { font-family: var(--f-mono); font-size: 8.5px; font-weight: 400; }
  & .main { position: absolute; left: 142px; right: 14px; top: 54px; bottom: 34px; display: grid; grid-template-columns: 300px 1fr; gap: 10px; }
  & .pick { position: relative; display: flex; flex-direction: column; overflow: hidden; }
  & .pick .ph { flex: 1; border: 0; }
  & .pick .lim { position: absolute; left: 10px; top: 10px; z-index: 2; }
  & .pick .foot { background: var(--ink); color: #fff; padding: 10px 12px; }
  & .items { display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-rows: 1fr; gap: 8px; }
  & .it { position: relative; display: flex; flex-direction: column; text-align: left; background: var(--surface-solid); border: 1px solid var(--line); box-shadow: var(--shadow-sm); transition: transform .12s; animation: ux-in-up .25s both; }
  & .it:hover { transform: translateY(-2px); }
  & .it .ph { flex: 1; border: 0; border-bottom: 1px dashed var(--line-2); }
  & .it .b { padding: 6px 9px; }
  & .it b { font-size: 10.5px; display: block; }
  & .it .pr { font-family: var(--f-mono); font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 4px; }
  & .it .pr i { width: 10px; height: 10px; border-radius: 50%; background: var(--crayon); }
  & .it .badge { position: absolute; right: 6px; top: 6px; z-index: 2; }
  & .it.owned { opacity: .5; }
  & .legal { position: absolute; left: 142px; right: 14px; bottom: 8px; display: flex; gap: 14px; align-items: center; font-size: 9.5px; }
  & .legal a { text-decoration: underline; cursor: pointer; }
  `);
  const CATS = {
    leader: ["指導者", "NEW", [["現実の制服 — ホルム", "COSTUME", "衣装 1:1", 480, "dream", "★★★"], ["夜間迷彩 — ガルシア", "COSTUME", "衣装 1:1", 480, "dream", "★★★"], ["ボイス追加 — クロウ", "VOICE", "ボイス 12種", 120, "dream", ""]]],
    civ: ["文明", "1", [["情報機関 INT 確定購入", "CIV KEY", "文明紋章 1:1", 3000, "coin", "文明"], ["研究財団 FND XP ブースト", "BOOST", "7日間 XP ×1.5", 200, "dream", ""], ["文明 Lv 引き継ぎ券", "TICKET", "券 1:1", 1500, "coin", ""]]],
    pass: ["パス", "S03", [["バトルパス 上位 S03", "PASS", "シーズン紋 1:1", 980, "yen", "PASS"], ["段 +10", "TIER", "段の束", 300, "dream", ""], ["スタンダード → プレミアム(ドロップ)", "DROP", "1日の上限 +3", 480, "yen", ""]]],
    cosmetic: ["見た目", "24", [["床デザイン「青焼き」", "BOARD SKIN", "盤面の床 16:9", 160, "dream", ""], ["プレート「白磁」", "TOKEN SKIN", "部隊プレート 1:1", 120, "dream", ""], ["合図「承認」スタンプ", "STAMP", "合図スタンプ 1:1", 0, "owned", "所持"]]],
    currency: ["通貨", "D", [["D 60", "CURRENCY", "通貨の束", 120, "yen", ""], ["D 330", "CURRENCY", "通貨の束", 610, "yen", "人気"], ["D 1,100", "CURRENCY", "通貨の束", 1840, "yen", "お得"]]],
  };
  const price = (p, cur) => cur === "yen" ? `¥ ${p.toLocaleString()}` : cur === "coin" ? `<span style="color:var(--ink)">C</span> ${p.toLocaleString()}` : cur === "owned" ? "—" : `<i></i>${p.toLocaleString()}`;
  UX.screen("shop", {
    title: "S15 ショップ", group: "ショップ・パス",
    render: (p) => {
      const cat = p.cat || "leader", [, , items] = CATS[cat];
      return `<div class="screen grid-bg">${D.topbar("PROCUREMENT", "ショップ", D.wallet())}
      <nav class="cats"><div class="eyebrow" style="padding:0 14px 6px">CATEGORY</div>${Object.entries(CATS).map(([k, [n, s]]) => `<button class="cat ${k === cat ? "on" : ""}" data-cat="${k}">${n}<span>${s}</span></button>`).join("")}</nav>
      <main class="main">
        <section class="panel pick"><span class="tag solid lim">残り 6日 12:40</span>${D.ph("FEATURED LEADER ART", "指導者 夢の姿 横長 4:3", "tinted t-d")}
          <div class="foot"><div class="eyebrow" style="color:rgba(255,255,255,.5)">PICK UP · 指導者の見た目</div><b style="font-size:16px">夢の姿 — ガルシア</b><div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><a class="tiny rates" style="color:rgba(255,255,255,.6);text-decoration:underline;cursor:pointer">★3 提供割合 1.5% · 80回で確定</a><div style="display:flex;gap:4px"><button class="btn sm light g1">1回 D 30</button><button class="btn sm violet g10">10回 D 300</button></div></div></div></section>
        <section class="items">${items.map(([n, k, d, pr, cur, badge], i) => `<button class="it ${cur === "owned" ? "owned" : ""}" data-i="${i}" style="animation-delay:${i * 40}ms">${badge ? `<span class="tag badge ${badge === "所持" ? "ok" : "violet"}">${badge}</span>` : ""}${D.ph(k, d)}<div class="b"><b>${n}</b><span class="pr">${price(pr, cur)}</span></div></button>`).join("")}</section>
      </main>
      <div class="legal"><a class="rates">提供割合の表示</a><a data-toast="特定商取引法に基づく表記(モック)">特定商取引法に基づく表記</a><a data-toast="資金決済法に基づく表示(モック)">資金決済法に基づく表示</a><div style="flex:1"></div><span class="dim">未成年の月間上限</span><div class="bar" style="width:120px"><i style="width:36%"></i></div><span class="mono">¥1,800 / ¥5,000</span></div>
    </div>`;
    },
    mount(el, p) {
      const cat = p.cat || "leader";
      for (const b of el.querySelectorAll("[data-cat]")) b.addEventListener("click", () => UX.go("shop", { cat: b.dataset.cat }, { replace: true, transition: "none" }));
      for (const b of el.querySelectorAll("[data-i]")) b.addEventListener("click", () => {
        const [n, , , pr, cur] = CATS[cat][2][b.dataset.i];
        if (cur === "owned") return UX.toast("所持しています");
        UX.openDialog("purchase", { name: n, price: pr, cur });
      });
      for (const r of el.querySelectorAll(".rates")) r.addEventListener("click", () => UX.openDialog("rates"));
      el.querySelector(".g1").addEventListener("click", () => UX.openDialog("purchase", { name: "ピックアップ 1回", price: 30, cur: "dream", gacha: 1 }));
      el.querySelector(".g10").addEventListener("click", () => UX.openDialog("purchase", { name: "ピックアップ 10回", price: 300, cur: "dream", gacha: 10 }));
    },
  });

  // ───────── D33 購入の確認 ─────────
  UX.dialogs.purchase = {
    opts: { kind: "modal" },
    render: (o) => {
      const cur = o.cur || "dream", have = cur === "coin" ? UX.state.coins : UX.state.dreams;
      const lack = cur !== "yen" && have < o.price;
      const unit = cur === "yen" ? "¥" : cur === "coin" ? "C" : "D";
      return `<div class="dlg" style="width:400px"><div class="dlg-head"><div class="eyebrow">D33 · CONFIRM PURCHASE</div><b style="font-size:14px">${o.name}</b></div>
      <div class="dlg-body">
        <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--line)"><span>価格</span><b class="mono">${unit} ${Number(o.price).toLocaleString()}</b></div>
        ${cur !== "yen" ? `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--line)"><span>支払い後の残高</span><b class="mono" style="color:${lack ? "var(--danger)" : "inherit"}">${unit} ${(have - o.price).toLocaleString()}</b></div>` : `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--line)"><span>未成年の月間上限</span><b class="mono">¥2,780 / ¥5,000(購入後)</b></div>`}
        ${o.gacha ? `<div class="tiny dim" style="margin-top:6px">★3 提供割合 1.5% · 確定まで残り 62 回 · <a class="rates" style="text-decoration:underline;cursor:pointer">提供割合</a></div>` : ""}
        ${lack ? `<div class="small" style="margin-top:8px;color:var(--danger)">${unit} が足りません。通貨のタブで購入できます。</div>` : ""}
      </div>
      <div class="dlg-foot"><button class="btn ghost sm" data-close>やめる</button><button class="btn sm ${o.gacha ? "violet" : ""} buy ${lack ? "disabled" : ""}">${o.gacha ? "引く" : "購入する"}</button></div></div>`;
    },
    mount(body, dlg, o) {
      body.querySelector(".rates")?.addEventListener("click", () => UX.openDialog("rates"));
      body.querySelector(".buy").addEventListener("click", (e) => {
        if (e.currentTarget.classList.contains("disabled")) return UX.go("shop", { cat: "currency" }, { replace: true, transition: "none" }), dlg.close();
        if (o.cur === "coin") UX.state.coins -= o.price; else if (o.cur !== "yen") UX.state.dreams -= o.price;
        if (/上位 S03/.test(o.name)) UX.state.premiumPass = true;
        dlg.close();
        if (o.gacha) return UX.go("gacha", { n: o.gacha }, { transition: "fade" });
        UX.toast(`購入しました: ${o.name}`, "ok");
        const cur = UX.current; if (cur) UX.go(cur.id, cur.params, { replace: true, transition: "none" });
      });
    },
  };

  // ───────── 提供割合 ─────────
  UX.dialogs.rates = {
    opts: { kind: "modal" },
    render: () => `<div class="dlg" style="width:380px"><div class="dlg-head"><div class="eyebrow">RATES · 提供割合</div><b style="font-size:14px">ピックアップ「夢の姿 — ガルシア」</b></div>
      <div class="dlg-body">${[["★3", "4.5%", "うちピックアップ 1.5%"], ["★2", "25.5%", ""], ["★1", "70.0%", ""]].map(([r, p, s]) => `<div style="display:grid;grid-template-columns:40px 70px 1fr;padding:6px 0;border-bottom:1px solid var(--line)"><b style="color:var(--gold)">${r}</b><b class="mono">${p}</b><span class="tiny dim">${s}</span></div>`).join("")}<div class="tiny dim" style="margin-top:8px">80回引くと★3ピックアップが確定します。重複した見た目は通貨 D に変換されます。</div></div>
      <div class="dlg-foot"><button class="btn sm" data-close>閉じる</button></div></div>`,
  };

  // ───────── S16 ガチャ結果 ─────────
  css("gacha", `
  & .screen { background: radial-gradient(70% 90% at 50% 40%, #241a3a, #0b0f15 75%); }
  & .grid { position: absolute; left: 50%; top: 58px; transform: translateX(-50%); display: grid; grid-template-columns: repeat(5, 120px); gap: 10px; perspective: 800px; }
  & .gc { position: relative; height: 136px; transform-style: preserve-3d; transition: transform .45s cubic-bezier(.2,.8,.2,1); cursor: pointer; }
  & .gc.flip { transform: rotateY(180deg); }
  & .face { position: absolute; inset: 0; backface-visibility: hidden; display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,.15); }
  & .back { background: repeating-linear-gradient(135deg, #1c2430 0 6px, #161c26 6px 12px); display: grid; place-items: center; font-family: var(--f-mono); font-size: 10px; letter-spacing: .2em; color: rgba(255,255,255,.4); }
  & .front { transform: rotateY(180deg); background: #121b24; color: #fff; padding: 5px; }
  & .front .ph { flex: 1; }
  & .front b { font-size: 9.5px; margin-top: 4px; }
  & .front .r { font-size: 9px; color: var(--gold); }
  & .gc.r3 .front { box-shadow: 0 0 0 1.5px var(--crayon), 0 0 30px rgba(123,44,255,.6); }
  & .gc.r3.flip .crayon-svg path { stroke-dasharray: 400; stroke-dashoffset: 400; animation: ux-draw .8s .35s ease forwards; }
  & .gc .tg { position: absolute; right: 5px; top: 5px; z-index: 2; font-family: var(--f-mono); font-size: 8px; padding: 1px 4px; background: var(--ok); color: #fff; }
  & .gc .tg.dup { background: rgba(255,255,255,.2); }
  & .foot { position: absolute; left: 0; right: 0; bottom: 14px; display: flex; justify-content: center; gap: 10px; align-items: center; color: rgba(255,255,255,.7); font-size: 10.5px; }
  & .head { position: absolute; left: 16px; top: 14px; color: #fff; }
  `);
  const POOL = [["夢の姿 — ガルシア", 3, "NEW"], ["合図スタンプ「了解」", 1, "NEW"], ["プレート「鉄灰」", 2, "NEW"], ["D 10", 1, "DUP"], ["床「方眼」", 1, "DUP"], ["ボイス — ホルム", 2, "NEW"], ["D 10", 1, "DUP"], ["プレート「白磁」", 2, "DUP"], ["スタンプ「否認」", 1, "NEW"], ["C 300", 1, "NEW"]];
  UX.screen("gacha", {
    title: "S16 ガチャ結果", group: "ショップ・パス", transition: "fade",
    render: (p) => {
      const n = p.n || 10;
      const res = n === 1 ? [POOL[2]] : POOL;
      return `<div class="screen dark">
      <div class="head"><div class="eyebrow" style="color:rgba(255,255,255,.5)">PICK UP · ${n} 回</div><b style="font-size:15px">潜行記録の照会結果</b></div>
      <div class="grid" style="${n === 1 ? "grid-template-columns:120px" : ""}">${res.map(([nm, r, tg], i) => `<div class="gc ${r === 3 ? "r3" : ""}" data-i="${i}"><div class="face back">DREAM</div><div class="face front">${tg === "NEW" ? '<span class="tg">NEW</span>' : '<span class="tg dup">重複 → D 5</span>'}${D.ph(r === 3 ? "★3 COSTUME" : "ITEM", "")}<b>${nm}</b><span class="r">${"★".repeat(r)}</span>${r === 3 ? `<svg class="crayon-svg" style="left:-10px;top:-10px;z-index:3" width="140" height="156" viewBox="0 0 140 156"><path d="M70 6 C 130 10, 136 120, 72 148 S 2 110, 12 50 C 18 22, 50 4, 86 12" stroke-width="3"/></svg>` : ""}</div></div>`).join("")}</div>
      <div class="foot"><span class="gmsg">カードをタップしてめくる</span><button class="btn sm light all">すべてめくる</button><button class="btn sm violet" data-back="shop">閉じる</button></div></div>`;
    },
    mount(el) {
      const cards = [...el.querySelectorAll(".gc")];
      const check = () => { if (cards.every((c) => c.classList.contains("flip"))) el.querySelector(".gmsg").textContent = `NEW ${cards.filter((c) => c.querySelector(".tg:not(.dup)")).length} · 重複は D に変換しました`; };
      const flip = (c) => { if (c.classList.contains("flip")) return; c.classList.add("flip"); if (c.classList.contains("r3")) UX.after(500, () => UX.toast("★3「夢の姿 — ガルシア」", "violet")); check(); };
      for (const c of cards) c.addEventListener("click", () => flip(c));
      el.querySelector(".all").addEventListener("click", () => cards.forEach((c, i) => UX.after(i * 120, () => flip(c))));
    },
  });
})();

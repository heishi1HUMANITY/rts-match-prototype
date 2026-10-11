// プロトタイプ用の固定データと、プレースホルダなどの小さな部品
(function () {
  const D = {};
  D.CIVS = {
    pmc:  { id: "pmc",  c: "#ff6a1a", short: "PMC",  name: "民間潜行会社",     leader: "ガルシア", en: "Garcia",    lv: 7, tagline: "兵站と火力",   order: "砲撃支援",   orderDesc: "指定地点に3回着弾、再使用 4:00", coef: [["ATK", "+12%", "ok"], ["PROD", "+5%", "ok"], ["UPKEEP", "+10%", "danger"], ["VISION", "±0", "dim"]], bg: "前線キャンプ: コンテナ、仮設照明、ヘリパッド",       line: "契約どおりだ。次の案件は川沿いの発電所、橋を押さえた方が勝つ。" },
    corp: { id: "corp", c: "#3b6cff", short: "CORP", name: "大企業潜行部門",   leader: "ミヤシロ", en: "Miyashiro", lv: 4, tagline: "生産と経済",   order: "緊急増産",   orderDesc: "30秒間 生産速度 ×2、再使用 5:00",   coef: [["ATK", "±0", "dim"], ["PROD", "+15%", "ok"], ["UPKEEP", "−5%", "ok"], ["VISION", "−5%", "danger"]],      bg: "本社の無人工場: 白い生産ラインとガラスの会議室",     line: "本社に報告は後だ。今期の目標は拠点3つ、生産ラインを先に立てる。" },
    soc:  { id: "soc",  c: "#2a2a2a", short: "SOC",  name: "秘密結社",         leader: "ヴェイル", en: "Veil",      lv: 2, tagline: "霧と奇襲",     order: "煙幕",       orderDesc: "指定地点を40秒間 視界から隠す",       coef: [["ATK", "+5%", "ok"], ["PROD", "±0", "dim"], ["UPKEEP", "±0", "dim"], ["VISION", "+10%", "ok"]],           bg: "霧の地下回廊: 打ちっぱなしの柱と低い照明",           line: "夢が開いた。静かに、深く潜る。霧の中なら、誰もこちらを数えられない。" },
    ipa:  { id: "ipa",  c: "#9aa7b2", short: "IPA",  name: "国際機関直属部隊", leader: "ホルム",   en: "Holm",      lv: 5, tagline: "防御と規律",   order: "鉄壁",       orderDesc: "首都と周囲の部隊 被ダメージ −50%",   coef: [["ATK", "−5%", "danger"], ["PROD", "±0", "dim"], ["UPKEEP", "±0", "dim"], ["DEF", "+15%", "ok"]],       bg: "国際機関の管制室: マットホワイトの壁と大型スクリーン", line: "規定どおりに進める。全部隊、整列。案件番号を確認してから出る。" },
    fnd:  { id: "fnd",  c: "#12a874", short: "FND",  name: "研究財団",         leader: "セレス",   en: "Ceres",     lv: 1, tagline: "研究で先行する", order: "全域観測", orderDesc: "15秒間 マップ全体を見る",             coef: [["ATK", "±0", "dim"], ["RES", "+20%", "ok"], ["UPKEEP", "+5%", "danger"], ["VISION", "±0", "dim"]],      bg: "観測ドーム: 計測機器と白い実験台",                   line: "観測開始。データは嘘をつかない。次の試合で仮説を確かめましょう。" },
    int:  { id: "int",  c: "#c99a2e", short: "INT",  name: "情報機関",         leader: "クロウ",   en: "Crow",      lv: 3, tagline: "偵察と攪乱",   order: "電波妨害",   orderDesc: "指定チームの視界を20秒間 半減",       coef: [["ATK", "±0", "dim"], ["PROD", "−5%", "danger"], ["UPKEEP", "±0", "dim"], ["VISION", "+15%", "ok"]],  bg: "分析室: モニターの壁と地図を貼ったボード",           line: "相手の所属を先に暴く。情報が戦場を決める。照会の準備はできている。" },
  };
  D.CIV_ORDER = ["pmc", "corp", "soc", "ipa", "fnd", "int"];
  D.ADDONS = [
    { id: "forward",   name: "前方集積", desc: "開始補給 +150",               kind: "perm", rare: 1 },
    { id: "scout",     name: "先遣斥候", desc: "開始時に斥候1部隊を追加",     kind: "perm", rare: 1 },
    { id: "armor",     name: "複合装甲", desc: "部隊HP +10%",                 kind: "perm", rare: 1 },
    { id: "optics",    name: "広域光学", desc: "視界 +15%",                   kind: "perm", rare: 1 },
    { id: "satellite", name: "衛星照会", desc: "10秒間マップ全体を見る",      kind: "perm", rare: 2, lockLv: 9 },
    { id: "airlift",   name: "緊急空輸", desc: "補給 +250(1回)",            kind: "cons", rare: 2, stock: 4 },
    { id: "regroup",   name: "再集結",   desc: "全部隊のHPを40%回復",         kind: "cons", rare: 2, stock: 0 },
    { id: "nemawashi", name: "根回し",   desc: "指定チームのチケット減少 ×2", kind: "cons", rare: 3, stock: 1 },
  ];
  D.addon = (id) => D.ADDONS.find((a) => a.id === id);
  D.TEAMS = {
    a: { key: "A", c: "var(--team-a)", sym: "diamond" },
    b: { key: "B", c: "var(--team-b)", sym: "square" },
    c: { key: "C", c: "var(--team-c)", sym: "hex" },
  };

  // プレースホルダ(画像の位置)
  D.ph = (key, desc = "", cls = "", style = "") => `<div class="ph ${cls}" style="${style}"><span class="ph-k">${key}</span>${desc ? `<span class="ph-d">${desc}</span>` : ""}</div>`;
  D.phRound = (size, key = "PT", style = "") => `<div class="ph round" style="width:${size}px;height:${size}px;${style}"><span class="ph-k" style="font-size:6px;padding:0">${key}</span></div>`;
  D.crayonFilter = (seed = 3) => `<svg width="0" height="0" style="position:absolute"><filter id="crayon-rough"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="2.4"/></filter></svg>`;
  D.mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.max(0, Math.floor(sec % 60))).padStart(2, "0")}`;
  D.topbar = (eyebrow, title, right = "", backTo = "") => `<header class="topbar">
      <button class="back" ${backTo ? `data-go="${backTo}"` : "data-back"}>←</button>
      <div class="title"><span class="eyebrow">${eyebrow}</span><b>${title}</b></div>
      <div class="spacer"></div>${right}</header>`;
  D.wallet = () => `<div class="wallet"><div class="coin"><i>C</i>${UX.state.coins.toLocaleString()}<span class="plus">+</span></div><div class="coin c-violet"><i>D</i>${UX.state.dreams}<span class="plus">+</span></div></div>`;
  window.D = D;
})();

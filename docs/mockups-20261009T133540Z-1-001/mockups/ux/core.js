// dream4x UX プロトタイプの土台: 画面遷移・ダイアログ・トースト・タイマー・状態
// ゲームとしては動かない。操作の流れと画面の出し方を確かめるためのもの。
// file:// で開けるよう ES modules を使わず、グローバル UX に各画面を登録する。
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  const UX = {
    $, $$, h,
    screens: {},
    dialogs: {},
    history: [],
    current: null,
    timers: new Set(),
    state: {
      name: "ONISHI",
      homeCiv: "pmc",      // ホームに表示する指導者
      civ: "pmc",          // 試合で選んだ文明
      addons: ["forward", "armor", "nemawashi"],
      lastAddons: ["forward", "armor", "nemawashi"],
      mode: "rank",
      coins: 12480, dreams: 360,
      team: "a",
      readNews: false,
    },

    css(text) { const s = document.createElement("style"); s.textContent = text; document.head.appendChild(s); },

    // ── 画面 ──
    screen(id, def) { UX.screens[id] = { id, ...def }; },
    go(id, params = {}, opts = {}) {
      const def = UX.screens[id];
      if (!def) { UX.toast(`未作成の画面: ${id}`, "danger"); return; }
      const stage = $("#stage");
      const prev = UX.current;
      if (prev && !opts.replace && !opts.noHistory) UX.history.push({ id: prev.id, params: prev.params });
      UX.closeAllDialogs();
      UX.clearTimers();
      if (prev?.cleanup) try { prev.cleanup(); } catch (e) { console.error(e); }
      const el = h(`<div class="ux-layer" data-screen="${id}">${def.render(params)}</div>`);
      stage.appendChild(el);
      const tr = opts.transition ?? def.transition ?? "slide";
      const dir = opts.back ? "back" : "fwd";
      el.classList.add(`in-${tr}`, `dir-${dir}`);
      if (prev?.el) {
        const old = prev.el;
        old.classList.add(`out-${tr}`, `dir-${dir}`);
        old.style.pointerEvents = "none";
        setTimeout(() => old.remove(), 380);
      }
      UX.current = { id, params, el, cleanup: null };
      const cleanup = def.mount?.(el, params);
      UX.current.cleanup = typeof cleanup === "function" ? cleanup : null;
      UX.updateMap();
    },
    back(fallback = "home") {
      const prev = UX.history.pop();
      if (prev) UX.go(prev.id, prev.params, { noHistory: true, back: true });
      else UX.go(fallback, {}, { noHistory: true, back: true });
    },
    reset(id, params) { UX.history = []; UX.go(id, params, { noHistory: true, transition: "fade" }); },

    // ── タイマー(画面を離れると止まる) ──
    after(ms, fn) { const t = setTimeout(() => { UX.timers.delete(t); fn(); }, ms); UX.timers.add(t); return t; },
    every(ms, fn) { const t = setInterval(fn, ms); UX.timers.add(t); return t; },
    clearTimers() { for (const t of UX.timers) { clearTimeout(t); clearInterval(t); } UX.timers.clear(); },

    // ── ダイアログ ──
    // kind: "modal"(中央・暗幕)/ "sheet"(下から)/ "pop"(指定位置の吹き出し・暗幕なし)/ "full"(全面・暗幕なし)
    dialog(content, opts = {}) {
      const kind = opts.kind ?? "modal";
      const host = $("#dialogs");
      const wrap = h(`<div class="ux-dlg ux-${kind} ${opts.dark ? "is-dark" : ""}" ${opts.id ? `data-dlg="${opts.id}"` : ""}>
        ${kind === "modal" || kind === "sheet" ? `<div class="ux-scrim"></div>` : ""}
        <div class="ux-dlg-body"></div></div>`);
      const body = wrap.querySelector(".ux-dlg-body");
      body.innerHTML = typeof content === "string" ? content : content.render(opts);
      if (kind === "pop") {
        const { x = 450, y = 210, anchor = "above" } = opts;
        body.style.left = x + "px"; body.style.top = y + "px";
        body.classList.add(`anchor-${anchor}`);
      }
      host.appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.add("open"));
      const handle = {
        el: wrap, body,
        close() {
          if (!wrap.isConnected) return;
          wrap.classList.remove("open"); wrap.classList.add("closing");
          setTimeout(() => wrap.remove(), 200);
          opts.onClose?.();
        },
      };
      wrap._handle = handle;
      if (opts.dismiss !== false) {
        wrap.querySelector(".ux-scrim")?.addEventListener("click", () => handle.close());
        if (kind === "pop") setTimeout(() => {
          const off = (e) => { if (!body.contains(e.target)) { handle.close(); document.removeEventListener("pointerdown", off, true); } };
          document.addEventListener("pointerdown", off, true);
        }, 0);
      }
      if (opts.auto) setTimeout(() => handle.close(), opts.auto);
      if (typeof content !== "string") content.mount?.(body, handle, opts);
      opts.mount?.(body, handle);
      return handle;
    },
    openDialog(id, opts = {}) {
      const d = UX.dialogs[id];
      if (!d) { UX.toast(`未作成のダイアログ: ${id}`, "danger"); return; }
      return UX.dialog(d, { ...d.opts, ...opts, id });
    },
    closeTop() { const all = $$("#dialogs .ux-dlg:not(.closing)"); all.at(-1)?._handle?.close(); },
    closeAllDialogs() { for (const d of $$("#dialogs .ux-dlg")) d.remove(); },

    // ── トースト ──
    toast(text, kind = "") {
      const host = $("#toasts");
      const el = h(`<div class="ux-toast ${kind}">${text}</div>`);
      host.appendChild(el);
      requestAnimationFrame(() => el.classList.add("open"));
      setTimeout(() => { el.classList.remove("open"); setTimeout(() => el.remove(), 250); }, 2200);
    },

    // ── 画面一覧(右上の MAP) ──
    updateMap() {
      for (const b of $$("#ux-map [data-go]")) b.classList.toggle("on", b.dataset.go === UX.current?.id);
    },
  };

  // data 属性による操作の配線(各画面は data-go / data-back / data-dialog / data-close / data-toast を書くだけでよい)
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-go],[data-back],[data-dialog],[data-close],[data-toast],[data-reset]");
    if (!t) return;
    if (t.dataset.toast !== undefined) UX.toast(t.dataset.toast, t.dataset.toastKind || "");
    if (t.dataset.close !== undefined) { const d = t.closest(".ux-dlg"); d?._handle ? d._handle.close() : UX.closeTop(); }
    if (t.dataset.dialog) UX.openDialog(t.dataset.dialog, t.dataset.params ? JSON.parse(t.dataset.params) : {});
    if (t.dataset.back !== undefined) UX.back(t.dataset.back || "home");
    if (t.dataset.reset) UX.reset(t.dataset.reset);
    if (t.dataset.go) {
      const p = t.dataset.params ? JSON.parse(t.dataset.params) : {};
      if (t.closest("#ux-map")) { UX.history = []; UX.go(t.dataset.go, p, { noHistory: true, transition: "fade" }); $("#ux-map").classList.remove("open"); }
      else UX.go(t.dataset.go, p, t.dataset.tr ? { transition: t.dataset.tr } : {});
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") UX.closeTop(); });

  // 900×420 の端末枠をウィンドウに合わせて拡大縮小する
  function fit() {
    const dev = $("#device");
    const s = Math.min(innerWidth / 900, innerHeight / 420);
    dev.style.transform = `translate(-50%, -50%) scale(${s})`;
    document.documentElement.style.setProperty("--ux-scale", s);
  }
  addEventListener("resize", fit);

  UX.start = function () {
    fit();
    const map = $("#ux-map .list");
    const groups = {};
    for (const s of Object.values(UX.screens)) if (s.title) (groups[s.group ?? "その他"] ??= []).push(s);
    map.innerHTML = Object.entries(groups).map(([g, ss]) => `<div class="g"><div class="eyebrow">${g}</div>${ss.map((s) => `<button data-go="${s.id}">${s.title}</button>`).join("")}</div>`).join("");
    $("#ux-map-btn").addEventListener("click", () => $("#ux-map").classList.toggle("open"));
    const q = new URLSearchParams(location.search);
    if (q.has("shot")) $("#ux-map-btn").style.display = "none";
    UX.go(q.get("s") || "title", q.get("p") ? JSON.parse(q.get("p")) : {}, { noHistory: true, transition: "fade" });
  };

  window.UX = UX;
})();

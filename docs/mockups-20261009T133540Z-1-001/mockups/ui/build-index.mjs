// mockups/ui の各画面を縮小 iframe で並べた index.html を生成する
// 使い方: node mockups/ui/build-index.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const DIR = dirname(fileURLToPath(import.meta.url));
const GROUPS = [
  ["起動・導入", ["s01", "s02", "s07", "s08", "s28", "d12", "d42"]],
  ["ホーム・試合前", ["s09", "s09b", "s09c", "s10", "s04", "s04b"]],
  ["試合", ["s05", "s05a", "s05b", "s05c", "s05d", "s05e", "s05f", "s05g", "s05h"]],
  ["試合後", ["s11", "s06", "d35"]],
  ["育成・収集", ["s13", "s13b", "s14", "s29", "s20"]],
  ["ショップ・パス", ["s15", "d33", "s16", "s17", "s19"]],
  ["ドラマ", ["s30", "s30b", "s30c", "s30d", "s30e", "s30f"]],
  ["記録・その他", ["s12", "s21", "s22", "s26", "s27", "s25", "s23", "s24"]],
];
const files = readdirSync(DIR).filter((f) => /^[sd]\d.*\.html$/.test(f)).sort();
const key = (f) => f.split("_")[0];
const title = (f) => readFileSync(join(DIR, f), "utf8").match(/<title>(.*?)<\/title>/)?.[1] ?? f;
const used = new Set();
const section = (name, keys) => {
  const fs = files.filter((f) => keys.includes(key(f)));
  fs.forEach((f) => used.add(f));
  if (!fs.length) return "";
  return `<h2>${name}<span>${fs.length}</span></h2><div class="grid">${fs.map((f) => `<a class="item" href="${f}" target="_blank"><div class="frame"><iframe src="${f}" loading="lazy" tabindex="-1"></iframe></div><div class="cap"><b>${key(f).toUpperCase()}</b>${title(f).replace(/^[SD]\d+\w*\s*/, "")}</div></a>`).join("")}</div>`;
};
let body = GROUPS.map(([n, k]) => section(n, k)).join("");
const rest = files.filter((f) => !used.has(f));
if (rest.length) body += section("その他", rest.map(key));
writeFileSync(join(DIR, "index.html"), `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>dream4x UI モック</title>
<link rel="stylesheet" href="shared.css">
<style>
  html, body { overflow: auto; height: auto; }
  body { padding: 28px 24px 60px; background: var(--paper); font-size: 12px; }
  header { display: flex; align-items: end; gap: 16px; margin-bottom: 8px; }
  header p { color: var(--dim); max-width: 640px; }
  h2 { font-size: 13px; margin: 28px 0 10px; display: flex; gap: 8px; align-items: center; }
  h2 span { font-family: var(--f-mono); font-size: 10px; color: var(--dim); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; }
  .item { display: block; color: inherit; text-decoration: none; }
  .frame { position: relative; aspect-ratio: 900 / 420; overflow: hidden; border: 1px solid var(--line-2); background: #fff; box-shadow: var(--shadow-sm); }
  .frame iframe { position: absolute; left: 0; top: 0; width: 900px; height: 420px; border: 0; transform-origin: 0 0; pointer-events: none; }
  .cap { display: flex; gap: 8px; margin-top: 6px; font-size: 11px; }
  .cap b { font-family: var(--f-mono); font-size: 10px; }
</style>
<script>addEventListener("load",()=>{for(const f of document.querySelectorAll(".frame")){const s=f.clientWidth/900;f.querySelector("iframe").style.transform="scale("+s+")";}});</script>
</head><body>
<header><div><div class="eyebrow">DREAM OPERATIONS · UI MOCKUP</div><div class="h1">dream4x 画面モック</div></div>
<p>スマホ横持ち 900×420 基準の静的モック(ゲームとしては動かない)。キャラクター・模型・バナー等の画像はすべてプレースホルダ。各サムネイルをクリックで原寸表示。</p></header>
${body}
</body></html>
`);
console.log("index.html:", files.length, "screens");

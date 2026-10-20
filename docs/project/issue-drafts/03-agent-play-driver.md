# 03 [ツール] エージェント試遊ドライバーと調整ループの道具

- タイトル: `[ツール] エージェント試遊ドライバーと調整ループの道具`
- ラベル: `enhancement`, `flow:implementing`, `gate:auto`
- ブランチ: `claude/agent-play-driver`（01 を土台に 02 を merge 済み、実装済み・PR未作成）

## 本文

### 目的

陣営Aを1tickずつ明示的に進めて操作できるようにし、エージェントにプレイ感の事前検証（抜け道・破綻・情報不足・システム要望）をさせる。体感そのものはCPのプレイ検査で確かめる。

### 実装範囲（実装済み）

- `npm run agent`: new/view/map/rules/cmd/step/replay。観測は陣営Aの FactionView のみ、命令はブラウザと同じ検証。操作上限 `--budget=秒:回数`（同じ目標へのまとめ命令は1操作）。replay で状態の一致を検証。
- ブラウザ `?agent=1`: 実時間で進めず `window.__rts.step/dispatch/view/map` で操作。
- `--rules=patch.json`: 部分マスタを new・`npm run audit:match-length`・`npm run probe` に渡す。
- `npm run probe -- --strategy=npc|heli-raid`: 戦法を固定したAとNPCの勝率比較。
- 試遊の指示書 `scripts/agent-playtest.md`（数値とシステム面の要望を決まった形式で返す）。

### 受入条件

- [x] ステップを明示しない限り試合が進まない（ユニット・`e2e/agent-mode.spec.ts`）。
- [x] セッションの命令履歴から replay した状態が一致する（`agent-session.test.ts`）。
- [x] 操作上限はまとめ命令を1操作と数え、上限超過は履歴に残さない（同上）。
- [ ] CI（Windows/Linux check、e2e）を最終headで通す。

### ユーザー検査

不要 — 試合ルールを変えない開発用の道具（`?agent=1` 以外の画面は不変）。

### CP

CP14。依存: 01・02（このブランチに含む。01・02 のマージ後に差分が道具だけになる）。

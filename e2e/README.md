# Playwright シナリオ検証

視界マスクは `fog-visibility.spec.ts` で画面の隅の暗さと自部隊付近の明るさを実描画ピクセルから確認する。寸法の違うGPU領域への部分更新を、DOMの表示確認だけで合格にしない。`strategy-dock.spec.ts` は操作タブの常設・切替・再選択・閉じた後の入口・盤面との非重複をPC/900×420で確認する。

Node.js 24.x / npm 11〜12で実行します。

```sh
npm ci
npx playwright install chromium
npm run build
npm run test:e2e
```

`playwright.config.ts` がビルド済み `dist` のpreviewサーバーを自動起動します。既存URLを調べるときは `E2E_BASE_URL` 環境変数を設定します。PC（1440×900）と横持ち（900×420）のChromiumで同じ検査を実行します。実機タッチや他ブラウザは未検証です。

## 対応済みの範囲

IDの出典は [G1_SCENARIOS.md](../docs/project/inspection/G1_SCENARIOS.md) です。現行の通常設定を使用し、過去のG1専用配置・部隊数を前提にしません。

| ID    | e2eで自動判定する部分                                   | 未対応の部分                         |
| ----- | ------------------------------------------------------- | ------------------------------------ |
| G1-07 | 一時停止でtick不変、再開でrunningへ戻る                 | 移動中の位置・経路維持               |
| G1-09 | リセットでREADY/tick0へ戻る                             | 移動・カメラ・選択の復元と10回の反復 |
| G1-10 | 有効seedの適用で設定変更                                | 未適用入力と停止/再開の組み合わせ    |
| G1-11 | 負数seedの拒否と理由表示                                | 小数・上限超過                       |
| G1-12 | 診断JSONにseed/scenario/command履歴を含む               | 移動・拒否履歴を含むケース           |
| G1-13 | PC/横持ちの起動・開始・停止・リセット、盤面領域と横溢れ | 選択・移動・全パネルの重なり確認     |

その他のG1、G2/G3、F01〜F21シナリオの全面e2e化は未対応です。スモーク成功を全機能の受入条件成功やCPプレイ検査済みとは扱いません。各実装PRで対象のシナリオIDをテスト名に記載し、自動判定できる期待結果を追加します。

## 成果物と失敗診断

`playwright-report/` にHTMLレポート、`test-results/` にスクリーンショット・失敗時trace/videoを保存します。失敗時fixtureは既存の診断JSONエクスポーターを呼び、seed/scenario/command履歴・状態・ビルド情報を `diagnostic.json` に保存します。ページが起動できない等でエクスポートできない場合は、取得エラーを添付します。fixture付きの `test` は `./fixtures` からimportしてください。

CIは成功・失敗にかかわらずレポートと診断成果物を14日保存します。PRのdist artifactは既存のWindows/Linux checksで保存し、main pushでは両OSのchecksとe2e成功後に同じLinuxビルドをGitHub Pagesへ配備します。PR preview URLは未導入です。

NPC-R01修正のシナリオは [NPC_R01_SCENARIOS.md](../docs/project/inspection/NPC_R01_SCENARIOS.md) を参照。`npc-pacing.spec.ts` は標準マスタ復元、通常B/Cの生産・研究・行軍、診断snapshot/replayエクスポート、一時停止・再開・リセットを両viewportで検証する。厳密な判断tick、命令上限、公平巡回、現地勢力周期、旧AI診断拒否はruntime/AIユニットテストで検証し、遊びやすさはCP0プレイで判定する。

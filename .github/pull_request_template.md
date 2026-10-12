## 変更と目的

実装を完了するIssue: Closes #（kind:decisionにはClosesを使わない）
部分対応・修正の場合も同期対象の実装IssueをClosesで指定する。decisionは関連リンクだけを記載する。
CP / gate:auto または gate:play:
ユーザーに見える結果と、変更理由:

## 受入条件とシナリオ

| 受入条件ID・自動判定できる文 | SCENARIOS項目ID | Playwrightテスト |
| ---------------------------- | --------------- | ---------------- |
|                              |                 |                  |

機能PRでは「シナリオ文→e2e追加」を必須にする。非該当の場合は理由:

## DoD

- [ ] npm run check（Windows / Linux CI）
- [ ] npm run references:check（原本変更時の理由・ハッシュ更新を含む）
- [ ] 該当シナリオのPlaywright e2eがCIで成功
- [ ] 別会話・読み取り専用レビューモデルの結果を下表へ貼付し、最終headの全受入条件がOK
- [ ] UI変更のPC / 900×420確認、実機/エミュレーションと未検査の範囲を記載
- [ ] gate:playはマージ後status:unverifiedを付け、CP検査票へ自動収載

ユーザー合格はマージ条件にしない。修正は最大2巡。NGが残ればflow:reviewのまま停止する。

## レビューモデル照合結果

対象head:
モデル / 別会話識別子:
修正巡数（0〜2）:

| 受入条件ID | OK / NG | 根拠（ファイル:行、テスト結果） |
| ---------- | ------- | ------------------------------- |
|            |         |                                 |

## 検証と配備

CI / e2e結果:
PR artifact / preview URL（提供可能な場合）:
実ブラウザ・画面サイズ・入力方法:
失敗時診断JSON（seed / scenario / command履歴）のartifact:
CP結果記録用Issue:

## 制約・未解決事項

仕様の仮定、暫定値、未実装・未検証、既知の問題:

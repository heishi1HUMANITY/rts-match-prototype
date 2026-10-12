# CP単位の開発とプレイ検査

ユーザーはチェックポイント（CP）ごとに通常設定で1試合プレイする。機能PRは自動検証と別会話のレビューモデル照合でマージし、操作感・表示・時間/強さの差し戻しはCP検査で受け付ける。ユーザーにコードやPR差分の技術レビューを要求しない。

## 開始指示と進捗

「#30を進めて」のようなIssue番号だけで、[Issue作業手順](ISSUE_AGENT_RUNBOOK.md)と[実装ガイド](ISSUE_IMPLEMENTATION_GUIDE.md)を読み、[役割と引き継ぎ契約](ROLE_HANDOFF.md)に従い、設計担当が詳細設計と引き継ぎを完成させ、GPT-6 luna実装担当が依頼範囲内の実装・検証・PR・DoDを満たすマージまで進める。設計担当は引き継ぎ完成で停止し、実装を代行しない。内部タスクや機能ごとのユーザー合格待ちは作らない。「CP1 OK」「CP1 NG、#39の出撃操作が分かりにくい」のような通常の言葉を親が記録する。

進捗の唯一の正は [全体Issue #12](https://github.com/heishi1HUMANITY/rts-match-prototype/issues/12) の機能表。「マージ済み」と「プレイ検証済み」を独立したチェック列にする。各Issue/PRは根拠・依存・修正履歴を保持し、ローカル文書に進捗表を複製しない。自動検証成功からプレイ検証済みを推測しない。

## ラベルとIssue本文

Issueの状態と種類は次のラベルで表す。gateラベルは実装Issue専用とする。依存関係と着手に足りない契約は本文へ書く。

| ラベル            | 意味                                                      |
| ----------------- | --------------------------------------------------------- |
| flow:ready        | 作業前。依存待ちは本文に明記                              |
| flow:implementing | 実装・テスト・レビュー指摘修正中                          |
| flow:review       | レビューモデルとの受入条件照合中。2巡後の未解決停止もここ |
| flow:merged       | 実装がmainへマージ済み                                    |
| gate:auto         | 自動検証とモデルレビューで閉じてよい                      |
| gate:play         | CPでユーザーのプレイ検査が必要                            |
| status:unverified | gate:playのマージ後、CPプレイ未検証                       |
| kind:decision     | 実装なし。ユーザーの採否判断が必要                        |

flowは一つ、実装Issueのgateは一方だけを必須とする。kind:decision / kind:checkpointにはgateラベルを付けない。flow:backlogおよび旧user-review/accepted/changes-requestedは使わない。decisionは判断結果を記録して閉じる。実装を伴わないdecisionにはflow:mergedを付けず、閉じた状態と判断記録を根拠にする。モデルレビューをユーザーの採否判断の代わりにしない。

Issue本文は「目的／実装範囲／先に決める設計事項／依存・受入条件」を維持する。加えて「ユーザー検査: 要 / 不要」と理由1行、「検査シナリオID」「CP」を必須にする。操作・表示・時間/強さに触るなら検査は要（gate:play）。受入条件は「拠点にドロップした部隊が拠点セル到達でstopする」のように自動判定可能な文にし、docs/project/inspection/F0x_SCENARIOS.mdの項目番号とe2eを対応させる。

## PRのDoDとレビュー

1. npm run checkがWindows/Linux CIで成功する。npm run references:checkも成功する。
2. 該当シナリオのPlaywright e2eがCIで成功する。lunaの各機能PRでは「シナリオ文→テスト追加」を必須にする。文書・CIのみなど非該当は理由をPRへ書く。空の基盤だけで機能の受入を満たしたことにしない。
3. 別会話・読み取り専用レビューモデルがPRの固定headをIssueの受入条件と照合し、受入条件ごとにOK/NGと根拠行を返す。親が結果をPR本文へ貼る。修正は最大2巡、最終headを再照合し、NGが残ればflow:reviewのまま停止する。
4. DoDを満たしたPRをマージする。ユーザー合格はマージ条件から外す。gate:autoは閉じてよい。gate:playも実装Issueを閉じてよいが、status:unverifiedを残し、Milestone所属のCP検査結果Issueへ自動収載する。

PR本文の照合表は「受入条件ID / OK・NG / ファイル:行・テスト結果の根拠」を含む。レビュー対象head、モデル、会話識別子、修正巡数を添える。実装担当による自己評価を別会話レビューと呼ばない。マージまでに内容が変われば必要なCIと照合を更新する。DoD確認とマージ判断は担当エージェントの責務で、同期workflowが未達PRを承認するものではない。

## CPの割当と検査

MilestoneにCP0、CP1、CP2…を作る。1CPは3〜5 Issue、またはgate:playが一つ入った時点で締める。CP内の依存は各本文に置く。検査票は [CP_TEMPLATE.md](inspection/CP_TEMPLATE.md) を使い、1CPにつき1枚、「通常設定で1試合」「確認3点」「既知の未検証」だけにする。機能別の操作手順・境界条件はSCENARIOSとe2eへ移す。

Milestone自体にコメント欄がないため、各Milestoneに検査結果記録用Issueを一つ所属させ、そこでOK / NG(#番号)を記録する。これが「Milestoneコメント」の代替。自動収載対象は同じMilestoneのgate:playかつstatus:unverifiedのIssueで、閉じたIssueも含む。CP票を再生成しても人間の結果を上書きしない。

同期失敗・短時間の連続マージによるイベント取りこぼしは、Checkpoint syncのworkflow_dispatchで未処理のPR番号を指定し、まずapply=falseの計画を確認してからapply=trueで復旧する。通常の初回同期はPR番号を空にする。処理済みPRのreplayはプレイ合格を取り消すため行わない。実装Issueのgate判定とユーザー検査の要/不要の一致は、設計モデルが着手前に確認する。

通常設定のPages URLと検査対象のbuild情報を結果Issueに記録する。CP票にcommit SHA一覧や詳細操作を詰め込まない。PRのartifactとローカル起動も利用できるようにし、URLへ接続できることを推測しない。PC/900×420、実機/エミュレーションの自動検証範囲はPRへ記録する。

OKなら対象のプレイ検証を#12へ記録しstatus:unverifiedを外す。NGなら元Issueに紐づく修正Issue/PRへ整理し、未検証を維持する。修正も同じDoDでマージし、次のCP検査へ戻す。ユーザーが確認していない範囲は未検証のままにする。新規マージでgate:playの実装が変わったときは、そのIssueのプレイ検証列を未チェックへ戻す。

## 導入順序と既存Issue

1. Pages配備とPlaywright基盤を先に入れる。main pushでdist配備、PRはartifactを保存し、可能な環境ならpreview URLを添える。e2e失敗時はseed/scenario/command履歴を含む診断JSONをartifact保存する。
2. ラベル、テンプレート、#12の2列を整える。
3. [CP0](inspection/CP0.md)としてF03/F04/F05/F06/F08/F10/F17を通常1試合で検査し、結果だけ#12へ反映する。CP0完了前に次のFの本実装へ進まない。
4. #19 F07の徘徊NPC採否、#28 F16の試合時間・フェーズ・脱落・再建採否をkind:decisionへ分割し、ユーザーの明示判断を記録して閉じる。実装部分は別Issueに残す。
5. CP1以降を通常運用する。

既存割当はgate:auto: #40 F19、#45 F21、#30 F17系派生とマスタ/スキーマ/診断一般。gate:play: #39 F18、#42 F20、#23 F11、#24 F12、#25 F13、#26 F14、#27 F15、#5 G4。F19/F21級の小変更はF17子タスクへ畳める。実際に操作・表示・時間/強さを変える派生はその影響を理由にgate:playへ見直す。

## 役割

- 設計モデル: Issue本文、受入条件、シナリオ草案、gate判定、CP割当。
- GPT-6 luna（`gpt-6-luna`）: 実装、ユニットテスト、シナリオのe2e化、PR作成、レビュー指摘修正。機能ごとの合格依頼はしない。
- レビューモデル: 別会話で読み取り専用照合、構造化OK/NGと根拠。最大2修正巡。
- ユーザー: CPごとの1試合、kind:decision採否、差し戻し。

実装側の親（GPT-6 luna）は担当範囲・編集可能ファイルを定め、結果を検証・統合する。設計担当は契約変更の判断を担当し、実装修正や検証実行を引き取らない。担当者が変わってもモデル別の役割と引き継ぎ条件を維持する。通常の技術判断は停止せず進める。未決定の採否、未実装、暫定値、自動検証、ユーザープレイ済みを区別する。

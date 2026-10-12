# 開発手順

進め方は [WORKFLOW](docs/project/WORKFLOW.md)、機能契約は [TASKS](docs/project/TASKS.md)、進捗の唯一の正は [Issue #12](https://github.com/heishi1HUMANITY/rts-match-prototype/issues/12)。ユーザーのプレイ検査はCP単位とし、機能PRのマージにユーザー合格を要求しない。

## モデル別の担当

[役割と引き継ぎ契約](docs/project/ROLE_HANDOFF.md)を開始時と担当交代時に確認する。設計担当は設計・Issue・引き継ぎまで、GPT-6 luna（`gpt-6-luna`）は実装・テスト・実行検証・PR対応を担当する。上位モデルや親モデルを継承した子による実装代行はしない。明示依頼された運用文書の改定は設計担当が文書範囲でPR対応できる。

## 作業開始

1. README / AGENTS と docs/project のスコープ・構成・判断を読む。
2. Issue本文の目的、実装範囲、先に決める設計事項、依存・自動判定できる受入条件を照合する。
3. 実装Issueにはユーザー検査の要/不要と理由、gate:auto/play、シナリオID、CP Milestoneを記録する。kind:decision / kind:checkpointにgateラベルは付けない。
4. mainから短命ブランチを作り、npm ciでlockfileと同じ依存を入れる。

ゲーム処理、描画、UIを分け、小さい縦切りで接続する。ルールの採用理由・暫定性はDECISIONSへ残し、seed付きテストを追加する。lunaの各機能PRでSCENARIOSの項目をPlaywright e2eにし、シナリオIDをテスト名へ含める。

## PRのDoD

- Windows/Linux CIのnpm run check成功。
- npm run references:check成功。原本変更は理由とハッシュ更新を記載。
- 該当シナリオのPlaywright e2eがCI成功。文書/CIなど非該当は理由を記載。
- 別会話・読み取り専用レビューモデルによる受入条件別OK/NGとファイル:行・テストの根拠をPR本文へ貼る。固定head、モデル/会話識別子、修正巡数を記録する。
- 修正は最大2巡。NGが残る場合はflow:reviewのまま停止する。
- UI変更は実ブラウザPC/900×420を確認し、タッチ実機/エミュレーションの範囲と未検査を記録する。
- gate:playはマージ後status:unverifiedを付け、CP検査票へ自動収載する。

マージ後はflow:mergedとし、#12のマージ済み列を更新する。プレイ検証済みはCP結果によってのみ更新する。CPは3〜5 Issueまたはgate:play一つで締め、通常設定1試合・確認3点・既知未検証の票を使う。CP結果はMilestone所属の検査結果IssueコメントへOK / NG(#番号)で記録する。CP0完了が次のF実装の前提。

## GitHubと配備

main pushでdistをGitHub Pagesへ配備し、PRはビルドartifactを保存する。preview URLは提供できる環境で添える。e2e失敗はseed/scenario/command履歴の診断JSONも保存する。配信対象はdistだけとし、原本docs/artworkを含めない。

リポジトリ公開範囲は変更しない。CODEOWNERSやライセンスを推測して追加しない。秘密はコミットしない。kind:decisionの採否はユーザー判断を記録して閉じ、実装は別Issueで扱う。

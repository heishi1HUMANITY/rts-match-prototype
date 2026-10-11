# 継承資料と参照方針

2026-10-11、旧作業フォルダ D:/git/rts の docs と artwork を同名ディレクトリにコピー。
Git履歴は継承せず、旧packages / scripts / tools / node_modules、旧ルート文書は含めない。
新規cloneは旧フォルダに依存しない。

docs/projectが現行仕様。その他docsは旧仕様、旧進捗、デザイン案、世界観等を含む参照スナップショット。
継承文書中のリンクやスクリプトは旧プロジェクト前提の場合がある。旧実装を指すリンクを成立させるための移植は行わない。
アセットの「了承」「実装済み」も、新規側で統合・検証済みという意味ではない。

## UIの主な参照

基点: ../mockups-20261009T133540Z-1-001/mockups/

- [試合HUD](../mockups-20261009T133540Z-1-001/mockups/ui/s05_match_hud.html)
- [研究](../mockups-20261009T133540Z-1-001/mockups/ui/s05a_research.html)
- [拠点ポップ](../mockups-20261009T133540Z-1-001/mockups/ui/s05b_base_popup.html)
- [部隊ポップ](../mockups-20261009T133540Z-1-001/mockups/ui/s05c_squad_popup.html)
- [生産パネル](../mockups-20261009T133540Z-1-001/mockups/ui/s05d_base_panel.html)
- [リザルト](../mockups-20261009T133540Z-1-001/mockups/ui/s06_result.html)
- [共通トークン](../mockups-20261009T133540Z-1-001/mockups/ui/shared.css) / [HUD配置](../mockups-20261009T133540Z-1-001/mockups/ui/hud.css)
- [検討メモ](../mockups-20261009T133540Z-1-001/mockups/UIモック検討メモ.md)
- [3D試作の記録](../mockups-20261009T133540Z-1-001/mockups/3d/進捗.md)

白と明灰の面、細い罫線、黒い主ボタン、色と記号の3陣営表示を参考にする。
物語台詞・指導者・所属・報酬は初期UIへ移さない。
ux側の時間やチケットは疑似処理。ゲームルールとして採用しない。
旧mockは外部フォントやCDNを使う場合があるが、新規起動ページはそれらに依存しない。

## 整合性と容量

reference-manifest.jsonにGit管理する継承ファイルの相対パス・サイズ・SHA-256を記録。
npm run references:check は変更・削除・未登録ファイルを検出する。
意図的な資料更新時は理由・出所を記録し、該当エントリーを更新する。

コピーしたdocs/videoの過去録画はローカルにのみ残し、Gitに含めない。
Zone.Identifier名の補助ファイルもGitに含めない。それ以外のdocs/artworkは継承する。
public/assetsへ移した採用素材だけを配信する。素材の権利や公開ライセンスは推測しない。

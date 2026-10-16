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

## 2026-10-11 研究仕様の更新

ユーザーの「選択した研究へポイントを充填し、未指定時はバンクする」「拠点なしでも少量の研究収入」「仕様書側も修正」の依頼に基づき、継承資料の次の4件を更新した。

- `docs/機能仕様書.md`
- `docs/計算モデル.md`
- `docs/画面とダイアログ一覧.md`
- `docs/design/UIデザイン方針.md`

研究の一括支払い・固定研究時間・予約列を現行仕様から外し、研究別進捗の保持、即時完了と余剰バンク、基本0.2ポイント/秒と所有拠点ごと1ポイント/秒を反映した。旧文明・全ツリー・画面モックの履歴は参考として区別する。G2採用範囲はG2設計を正とし、上記4件のみmanifestのサイズとSHA-256を更新した。

## 2026-10-16 3D試作「装甲強襲」v3

ユーザーの「レールガン戦車のモチーフはそのままに、もう少し戦車っぽいディテールを足す」の依頼に基づき、継承資料の3D試作を更新した。

- `docs/mockups-20261009T133540Z-1-001/mockups/3d/tank.js`(装備の追加、`check()` の追加)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/viewer.html`(説明文)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/進捗.md`、`docs/mockups-20261009T133540Z-1-001/mockups/UIモック検討メモ.md`(9.1 に v3 の記録)
- `docs/mockups-20261009T133540Z-1-001/mockups/screens/3d_tank_v3_*.png`(新規 11 枚。同日に発射演出の強化も同じ依頼の続きとして反映)

出所は本リポジトリでの作業(ヘッドレスChromiumでの撮影)。上記のみmanifestのサイズとSHA-256を更新・追加した。

## 2026-10-16 3D試作「攻撃ヘリ」v2

ユーザーの「装甲強襲と同じ方向でディテールを増して現実的な兵器的に。攻撃はミサイルと機関砲の2パターン」の依頼に基づき、継承資料の3D試作を更新した。

- `docs/mockups-20261009T133540Z-1-001/mockups/3d/heli.js`(装備の追加、機関砲の射撃、`check()`)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/viewer.html`(説明文、機関砲のボタン)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/進捗.md`、`docs/mockups-20261009T133540Z-1-001/mockups/UIモック検討メモ.md`(9.2 に v2 の記録。レールガンのガトリングを採らない理由を含む)
- `docs/mockups-20261009T133540Z-1-001/mockups/screens/3d_heli_v2_*.png`(新規 8 枚)

出所は本リポジトリでの作業(ヘッドレスChromiumでの撮影)。上記のみmanifestのサイズとSHA-256を更新・追加した。

## 2026-10-16 3D試作「自走砲」

ユーザーの「装甲強襲・攻撃ヘリと同じ方向性で自走砲・対空砲・哨戒艇を1つずつ」の依頼の1つ目として、継承資料の3D試作を追加した。

- `docs/mockups-20261009T133540Z-1-001/mockups/3d/spg.js`(新規)、`docs/mockups-20261009T133540Z-1-001/mockups/3d/chassis.js`(新規。装軌の足回りの共通部品)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/viewer.html`(登録)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/進捗.md`、`docs/mockups-20261009T133540Z-1-001/mockups/UIモック検討メモ.md`(9.18)
- `docs/mockups-20261009T133540Z-1-001/mockups/screens/3d_spg_*.png`(新規 7 枚)

出所は本リポジトリでの作業(ヘッドレスChromiumでの撮影)。上記のみmanifestに追加・更新した。

## 2026-10-16 3D試作「哨戒艇」

同じ依頼の3つ目として、継承資料の3D試作を追加した。あわせて装甲強襲の主砲の継ぎ目のちらつきを直した。

- `docs/mockups-20261009T133540Z-1-001/mockups/3d/boat.js`(新規)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/tank.js`(継ぎ目のちらつき修正)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/viewer.html`(登録)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/進捗.md`、`docs/mockups-20261009T133540Z-1-001/mockups/UIモック検討メモ.md`(9.19、9.1 の追記)
- `docs/mockups-20261009T133540Z-1-001/mockups/screens/3d_boat_*.png`(新規 6 枚)

出所は本リポジトリでの作業(ヘッドレスChromiumでの撮影)。上記のみmanifestに追加・更新した。

## 2026-10-16 3D試作「装甲強襲」発射演出のリアル版

ユーザーの「装甲強襲のエフェクトを限りなくリアルに寄せられるか(発砲炎・煙)。既存のものは残して」の依頼に基づき、継承資料の3D試作にリアル版の発射演出を切替式で追加した。

- `docs/mockups-20261009T133540Z-1-001/mockups/3d/tank.js`(リアル版の発射演出 `setFxStyle`)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/common.js`(粒子のテクスチャ `U.puffTexture` / `U.glowTexture`、`U.stats` がスプライトを数える)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/viewer.html`(切替ボタン、説明文)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/進捗.md`、`docs/mockups-20261009T133540Z-1-001/mockups/UIモック検討メモ.md`(9.1 に追記)
- `docs/mockups-20261009T133540Z-1-001/mockups/screens/3d_tank_v3_fire_real_*.png`(新規 5 枚)

出所は本リポジトリでの作業(ヘッドレスChromiumでの撮影)。上記のみmanifestに追加・更新した。同時点で作業中だった対空車両・哨戒艇のファイルは対象外のまま。

## 2026-10-16 3D試作「移動線(クレヨン)」

ユーザーの「Entity の移動線をベースプレートみたいなクレヨンの線で描けるか試してほしい」の依頼に基づき、継承資料の3D試作を追加した。

- `docs/mockups-20261009T133540Z-1-001/mockups/3d/moveline.js`(新規)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/plate.js`(クレヨンの描画関数を `DreamAssets.crayon` として公開。描画は変えていない)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/viewer.html`(登録)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/進捗.md`、`docs/mockups-20261009T133540Z-1-001/mockups/UIモック検討メモ.md`(9.21)
- `docs/mockups-20261009T133540Z-1-001/mockups/screens/3d_moveline_*.png`(新規 14 枚。同日の追加依頼「ドラッグで引く、迂回路とマップ設定、▶ の矢じり」で同じファイル群を更新して撮り直し、さらに「動いているとき味気ない」への対応で動き・履帯跡・砂塵を足して 5 枚、「超信地旋回に」への対応で 4 枚追加)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/tank.js`(履帯と転輪の回る速さを外から変える `setSpeed`、左右別の `setTrackSpeeds`。既定の見え方は同じ)

出所は本リポジトリでの作業(ヘッドレスChromiumでの撮影)。上記のみmanifestに追加・更新した。

## 2026-10-16 3D試作ビューア「空気遠近法」(試して廃止)

ユーザーの「空気遠近法的な表現はあってもいい」で試作ビューアに表示切替を足したが、探索状態の霧の表現と重なるため同日に廃止した。コードとキャプチャは取り除き、検討の記録だけを残す。

- `docs/mockups-20261009T133540Z-1-001/mockups/3d/viewer.html`(追加して取り消し)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/進捗.md`、`docs/mockups-20261009T133540Z-1-001/mockups/UIモック検討メモ.md`(9.22 に記録)

出所は本リポジトリでの作業。上記のみmanifestを更新した。

## 2026-10-16 3D試作の最適化

ユーザーの「追加したものと mock/3d の差分全体を最適化」の依頼に基づき、見た目を変えずに描画呼び出しを減らした(メモ 9.23)。

- `docs/mockups-20261009T133540Z-1-001/mockups/3d/common.js`(`U.billboards`)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/tank.js`、`chassis.js`、`spg.js`、`aa.js`(足回りと砲身のインスタンス化)、`moveline.js`(砂塵・履帯跡・帯)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/進捗.md`、`docs/mockups-20261009T133540Z-1-001/mockups/UIモック検討メモ.md`

出所は本リポジトリでの作業。上記のみmanifestを更新した(aa.js は未登録だったので追加。対空車両・哨戒艇のキャプチャと boat.js は別の作業中のため対象外のまま)。

## 2026-10-16 3D試作 発射演出のリアル版(全戦闘アセット)

ユーザーの「その他の戦闘 Entity のエフェクトもリアル版を作れるか」の依頼に基づき、継承資料の3D試作に切替式のリアル版発射演出を足した(メモ 9.24)。

- `docs/mockups-20261009T133540Z-1-001/mockups/3d/common.js`(共通のエミッタ `U.muzzleFx`)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/tank.js`(エミッタへ移行)、`spg.js`、`aa.js`、`boat.js`、`heli.js`(リアル版の追加)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/viewer.html`(切替ボタン)
- `docs/mockups-20261009T133540Z-1-001/mockups/3d/進捗.md`、`docs/mockups-20261009T133540Z-1-001/mockups/UIモック検討メモ.md`(9.24)
- `docs/mockups-20261009T133540Z-1-001/mockups/screens/3d_{spg,aa,boat,heli}_*_real*.png`(新規 11 枚)

出所は本リポジトリでの作業(ヘッドレスChromiumでの撮影)。上記のみmanifestに追加・更新した(boat.js は以前の作業で不一致のままだったが、今回の変更で登録し直した)。

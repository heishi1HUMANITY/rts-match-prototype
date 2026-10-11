---
name: 3d-asset
description: dream4x の 3D アセット試作(mockups/3d/ の Three.js コード生成モデル)を 1 体作る・直すときの手順。新しい拠点・部隊・NPC・地形・演出のモデルを作る、ユーザーのレビュー指摘で作り直す、ビューアに登録する、キャプチャを撮って報告する、といった作業で使う。
---

# 3D アセット制作の手順

`mockups/3d/` の 3D アセットは、画像を使わず Three.js のコードで組み立てる試作モデル。1 体ずつ作り、ユーザーのレビューを受けて直す。進捗とやることは `mockups/3d/進捗.md`、検討と決定の記録は `mockups/UIモック検討メモ.md` の 9 章にある。

## 0. 始める前に

1. `mockups/3d/進捗.md` を読み、今どこまで進んでいるか、次に何を作るか、保留のものは何かを確かめる
2. 作るアセットの行を `docs/アセット一覧.md`(8.4〜8.7)で読む。数・状態・使う画面・優先度
3. 関係する仕様を確かめる(大きさは `packages/shared/src/config.ts` の制圧圏の半径など、ゲーム側の数値に合わせる)
4. 似たアセットの既存ファイルと、メモ 9 章の該当節の「修正(ユーザー指摘)」を読み、同じ指摘を受けないようにする
5. 保留中のもの(首都、文明別の部隊トークン)は作らない。組織の設定が固まるまで待つ

## 1. デザインの決まりごと(過去のレビューで決まったこと)

すべて守る。迷ったら作る前にユーザーに確かめる。

**全体**
- 既存のイラスト画像(`mockups/3d/*.jpg`、`packages/client/public/art/` など)はデザインの元にしない
- 建築模型の方針: 白・明灰・暗の Lambert、輪郭線(`U.adder`)で図面風にする。チーム色はアクセントだけ。中立の NPC にはチーム色を使わない
- 前方 = +z、上 = +y。ゲームの部隊は表示倍率 2.0、施設(拠点)は 3.0(現行の倍)、渡河点は断面を 2 倍
- 高さ(霧の平面を突き抜ける、ラベルにかかる)は当面気にしない

**リアリティ**
- 動きは「現実のどの設備・兵器の動作か」を説明できるものだけにする。説明できない動き、中途半端な動き(質の低い出荷車両、取って付けた斜路など)は足さない。動かさない方がよい
- 動きの代わりに灯を点滅させて誤魔化さない。実在の設備が動作中に回す回転灯・警告灯(クレーンが動いている間、水門の開閉中、警報)と灯台は可。常時の灯(航空障害灯など)は点滅させず常灯にする(2026-10-09 決定)。意味の分からない半透明ガラスの飾りを付けない
- 部品どうしを貫通させない。回転・移動する部品は動く範囲全体で隙間を計算し、`check()` で数値を返す
- 屋外の組立ライン、地面へ潜る昇降台、壁を突き抜けるシャッターのような構造は不可

**機械・兵器**
- 多脚は使わない。移動は履帯かタイヤ
- バリエーションは大きさ違いにしない。等級ごとに武装や車両そのものを変える
- 実在の兵器を下敷きにして、外観は SF 寄り(角ばったパネルと継ぎ目)
- 回るアンテナ、レーザーの照準線、皿形レーダー、光る赤い目は使わない。センサーは箱形の覆いのレーダーと、光らない電子光学の窓(暗いガラス)
- 現地勢力は民間の車両(観光バス、電動ピックアップ、電動 SUV)に大径のオフロードタイヤを履かせ、無理やり武装した寄せ集め

**共通の見え方**
- 水は必ず `U.waterMaterial`(中央水門と同じ半透明のシアンと白い流れの線)。独自の水のシェーダーは作らない
- 同じ要素はアセット間で見え方をそろえる。新しい共通の見え方を作ったら `common.js` に置く

## 2. ファイルの作り方

1 アセット = `mockups/3d/<key>.js` 1 ファイル。既存のファイル(例: `lab.js`、`guard.js`)と同じ形にする。

```js
// <アセット名>の詳細版モデル(試作)。<方針を 2〜4 行。何を下敷きにしたか、何をしないか>
//
//   const a = DreamAssets.<key>(THREE, { ... });
//   scene.add(a.group); a.setTeam(0xff6a1a); a.setState("..."); a.update(dt)
(function () {
  const P = { body: 0xfbfcfd, light: 0xe9edf1, mid: 0xc9d0d7, dark: 0x3b4752, neutral: 0x8f98a3 };

  function <key>(THREE, opts = {}) {
    const U = DreamAssets.util;
    const lambert = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const M = { body: lambert(P.body), /* … */ edge: new THREE.LineBasicMaterial({ color: P.dark, transparent: true, opacity: 0.5 }) };
    const group = new THREE.Group(); group.name = "<key>";
    const add = U.adder(THREE, M.edge, 25);
    // ── 部品ごとに「// ── 名前 ──」で区切って組む ──
    let state = "idle";
    function update(dt) { /* 動き */ }
    function setTeam(c) { /* チーム色のマテリアルだけ色を変える。中立は何もしない */ }
    U.bake(THREE, group, { dynamic: [/* 動く Group */], live: [M.accent] });   // 最後に焼く
    return {
      group, update, setTeam, stats: () => U.stats(group), parts: { /* ビューアの表示切替で使う部品(制圧圏など) */ },
      setState(s) { state = s; }, get state() { return state; },
      check: () => ({ /* 隙間・最低高さなどの確認値 */ }),
    };
  }

  (window.DreamAssets ??= {}).<key> = <key>;
})();
```

`common.js` の `DreamAssets.util` にある部品を使う:

| 関数 | 用途 |
| --- | --- |
| `U.adder(THREE, edgeMat, threshold)` | 輪郭線つきで部品を足す関数を作る(`add(geo, mat, parent, {x, y, z, rx, ry, rz, edges, s})`) |
| `U.loft(THREE, sections)` / `U.sym(half)` | 断面の列をつないだ多面体(車体・胴体)。左右対称の断面 |
| `U.edgeStrip(...)` | 断面の頂点に沿う光る線(浮かないように折れ線で沿わせる) |
| `U.merge(THREE, parts)` | 同じマテリアルの部品を 1 つにまとめて描画呼び出しを減らす |
| `U.slab` / `U.zone` | 角を落とした台座 / 制圧圏の点線リングと円盤 |
| `U.waterMaterial(THREE, {opacity, repeat})` / `U.WATER_TILE` | 共通の水面(線 1 枚 = 36 × 72) |
| `U.rng(seed)` | 決まった乱数(配置を毎回同じにする) |
| `U.reach` / `U.stats` | 原点からいちばん遠い頂点 / 三角形・描画呼び出し・マテリアルの数 |
| `U.bake(THREE, root, { dynamic, live, also, instanced })` | 動かない部品を「頂点色 Lambert 1 メッシュ + 輪郭線 1 本」に焼く(最後に必ず呼ぶ。下の決まり) |

性能の目安: 同じ部品が並ぶものは `InstancedMesh`(履板、係留柱、煙の粒)。組み立ての最後に `U.bake` を呼んで動かない部品を焼く。焼いたあとの描画呼び出しは **施設 10〜50、部隊・NPC 10 前後**を目安にし、超えるときは報告に書く。

`U.bake` の決まり(見た目を変えずに焼くための条件):
- `dynamic` に入れるもの: `update` で位置・回転・scale を変える Group / Mesh、`visible` を切り替える Group、`getWorldPosition` など位置を参照する Mesh。ここを境に別々に焼かれる(中身は所有者ごとに 1 メッシュ)
- `live` に入れるもの: `setTeam` や塗りで色を書き換えるマテリアル(accent など)。マテリアルごとに 1 メッシュになり、色の変更が効く
- そのままになるもの: 非表示の部分(発射炎・弾)、InstancedMesh、Basic(灯・光。まとめたいものは `also`)、透明、テクスチャ付き、`userData.keep`
- `instanced`: 同じ中身のグループの列(車輪)。InstancedMesh 1 つになり、グループは空で残る。回したら `update` で `baked.sync()` を呼ぶ。縁の線が回しても同じ(タイヤ)なら `staticEdges: true`
- `build()` で作り直すアセットは、作り直す Group(`built` など)を root にして焼く(外の group に焼くと古いものが残る)
- ビューアの「部品の焼き込み」を外すと焼かずに作り直せる。焼く前と後を同じ条件で撮って比べる(メモ 9.17 対応 1)

## 3. ビューアに登録する

`mockups/3d/viewer.html` の 2 か所に足す。

1. `<script src="<key>.js"></script>` を `common.js` の後に足す
2. `ASSETS` に項目を足す(既存の項目をまねる):
   - `kind` / `title` / `desc`(何を下敷きにし、何を変えたか)/ `info`(ファイル、大きさ、構成、動作など 4 行)
   - `scale`(表示倍率)、`dist` / `target`(カメラの距離と注視点の高さ)、`tokenAt`(比較用トークンの位置。模型と重ならない所)
   - `make`、`actLabel`、`actions(a)`(`[ラベル, 押したとき, 点灯の条件]` の列)、`caption`、`ringParts`

左上のボタンはこの `ASSETS` から作られる。`viewer.html?asset=<key>` で直接開ける。

## 4. 確かめる(ヘッドレスでキャプチャ)

リポジトリのルートで静的サーバーを立て、`tools/capture/cdp.mjs` で状態を切り替えながら撮る。必ず `timeout` を付ける(無限ループで止まることがある)。

```bash
cd /home/y-onishi/repo/tmp4x3
(python3 -m http.server 8765 --bind 127.0.0.1 >/dev/null 2>&1 &)
S=mockups/screens
STEPS='[{"js":"__views.game()","wait":1500,"shot":"'$S'/3d_<key>.png"},
 {"js":"__asset().setState(\"engaged\")","wait":1200,"shot":"'$S'/3d_<key>_engaged.png"},
 {"js":"__asset().update=()=>{}; __views.side()","wait":800,"shot":"'$S'/3d_<key>_side.png"},
 {"js":"JSON.stringify(__asset().check?.())"}]'
CDP_W=900 CDP_H=600 timeout 90 node tools/capture/cdp.mjs "http://127.0.0.1:8765/mockups/3d/viewer.html?asset=<key>" "$STEPS"
```

- 使えるもの: `__asset()`(今のアセット)、`__load(key)`、`__views.game/quarter/front/side/top()`、`__camera`、`__controls`(自由な位置は `__camera.position.set(...)`、`__controls.target.set(...)`、`__controls.update()`)
- 動きを止めて撮るときは `__asset().update=()=>{}`
- `[page]` や `ERR` の行が出たらコンソールのエラー。全部の状態・バリエーションを順に切り替え、エラーが出ないことを確かめる
- 撮った画像は自分で見て確かめる。貫通、浮き、ちらつき(面が重なった z-fighting)、比較トークンとの大きさの釣り合い
- 画像は `mockups/screens/3d_<key>_<内容>.png`。全体(ゲーム視点)、細部の寄り、状態ごと、横からを最低限そろえる
- 終わったらサーバーを止める(`pkill -f "http.server 8765"`)

## 5. 記録する

- `mockups/UIモック検討メモ.md` の 9 章に節を足す(`### 9.N <種類>アセット「名前」(日付)`)。書くこと: ファイルとビューアの URL、大きさ、部品、状態と動き、規模(三角形・描画呼び出し・マテリアル)、画像、課題(ゲームに入れるときの注意、未定のこと)
- レビューで直したときは、同じ節に「修正(ユーザー指摘)」を `| 指摘 | 対応 |` の表か箇条書きで足す。何度も作り直したものは「経緯」を 1 行で残す
- 9.4 の制作キューの表の状態を更新する
- `mockups/3d/進捗.md` の一覧・やること・保留を更新する
- 検討・決定は `docs/` ではなくこのメモに書く(`docs/アセット一覧.md` は一覧の元で、編集しない)

## 6. 報告してレビューを待つ

- 報告は日本語で、キャプチャの画像を必ず付ける。何を下敷きにしたか、状態と動き、気になる点(性能、未定のこと)を短く書く
- 1 体ごとに止めてレビューを受ける。指摘を受けたら 1 → 4 → 5 の順で直し、また報告する
- トークンは 5 時間枠の 8 割を超えないようにする。区切りのよいところで止めて報告する
- 新しいデザインの方針が出たら、1 章の決まりごとに足す(このファイルを更新する)

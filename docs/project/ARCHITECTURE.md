# 構成と設計

## 基盤

TypeScript strict + Vite の単一Webアプリ。Node.js 24.x、npm lockfile、Vitest、Prettier。
Three.js の斜め見下ろし盤面とDOM HUDを実装方針とするが、描画依存は実装時に追加する。
サーバー・monorepo・通信同期・物理エンジンは当面不要。

## 依存方向

ui / render / ai → simulation。simulation は他の層をimportしない。

- simulation: JSON化可能な状態、固定tick、seed、commandsと検証、資源・移動・戦闘・制圧・決着。
- ai: 渡された可視情報を読み、人間と共通のcommandを生成。状態を直接改変しない。
- render: Three.jsのscene、camera、mesh、補間、raycast、resize、dispose、context loss。
- ui: 開始、HUD、研究、生産、結果、ガイド。入力をcommandへ変換。
- assets: 安定キーのmanifest。artwork原本と配信ファイルを分離。

G1の盤面・状態契約は [G1_IMPLEMENTATION_DESIGN.md](G1_IMPLEMENTATION_DESIGN.md) と [DECISIONS.md](DECISIONS.md) のD015以降を参照する。createMatch(seed)はschemaVersion=2のready状態、seed付き盤面、3陣営6部隊を生成する。

commands、tick、NPC方針、rendererはこれから追加する。

## 進行と再現性

ゲーム時間は整数tickで表し、ブラウザの描画頻度に合わせてルールを変更しない。
初期案は100ms/tick（旧資料準拠）。採用時にDECISIONSへ確定内容を記録する。
乱数はseedを注入し、壁時計とMath.randomをルールから排除する。
バックグラウンド、停止、再開、最大catch-up量は進行ループ実装時に決定する。
同じseedとcommand列から同じ結果を得られることを検証する。

保存・リプレイは初期必須ではないが、状態はJSON化可能に保つ。
現在のMatchStateはschemaVersion=2。v1からの読込みは提供しない。以後スキーマを変更するときも互換性の扱いを明示する。

## 入力とカメラ

斜め見下ろし、パン・ズームを想定。回転の要否は盤面段階で判断する。
意味上のaction（select、move、cancel、pause、open-research等）と物理入力を分離する。
マウス/タッチの対応と、HUDを操作したとき盤面命令が発火しない境界を定義する。

## UIと検証

900×420のスマホ横持ちを基準とし、PCでも操作可能にする。
mockの配置・トークンを参考にするが、指導者窓・通信台詞・世界観装飾は初期版から省く。
色＋記号、押せない理由、選択対象、結果と再戦を優先する。

ルールはVitestのNode環境で検査、UIは実ブラウザで操作を検証する。
性能予算や対象ブラウザの確定は盤面導入時に行う。Chrome / Edgeを最初の検証対象とする。

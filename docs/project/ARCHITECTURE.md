# 構成と設計

## 基盤

TypeScript strict + Vite の単一Webアプリ。Node.js 24.x、npm lockfile、Vitest、Prettier。
Three.js の斜め見下ろし盤面とDOM HUDを使用する。
サーバー・monorepo・通信同期・物理エンジンは当面不要。

## 依存方向

ui / render / ai → simulation。simulation は他の層をimportしない。

- simulation: JSON化可能な状態、固定tick、seed、commandsと検証、資源・移動・戦闘・制圧・決着。
- ai: 渡された可視情報を読み、人間と共通のcommandを生成。状態を直接改変しない。
- render: Three.jsのscene、camera、mesh、補間、raycast、resize、dispose、context loss。
- ui: 開始、HUD、研究、生産、結果、ガイド。入力をcommandへ変換。
- assets: 安定キーのmanifest。artwork原本と配信ファイルを分離。

G1の移動を維持し、G2の状態・視界・戦略ループ契約は [G2_DESIGN.md](preparation/G2_DESIGN.md) と [DECISIONS.md](DECISIONS.md) のD025以降を参照する。createMatch(seed,{scenarioId})はschemaVersion=6のready状態、seed付き盤面、3陣営・首都・中立拠点と陣営別知識を生成する。

simulationの共通commandと固定tickをruntimeが進め、通常のonChange/onFrameは自軍FactionViewだけをHUD/renderへ渡す。経路プレビューはruntime.previewMoveの純粋照会、全MatchState取得は明示された開発用診断とテストの経路に限定する。NPC方針と勝敗は [G3_DESIGN.md](preparation/G3_DESIGN.md) に従う。runtime/advanceが陣営別viewからNPC commandを生成し、simulationへ適用する。診断replayも同じadvanceを使い、人間履歴とNPCの自動再生成を二重適用しない。

## 進行と再現性

ゲーム時間は整数tickで表し、ブラウザの描画頻度に合わせてルールを変更しない。
100ms/tickを採用し、G2の移動・同時交戦・制圧・経済/研究充填・生産・チケット・脱落/決着・視界の順を固定する。
乱数はseedを注入し、壁時計とMath.randomをルールから排除する。
バックグラウンド時は停止し、復帰後の明示再開を要求する。最大catch-upは5tick/500ms。
同じseedとcommand列から同じ結果を得られることを検証する。

保存・リプレイは初期必須ではないが、状態はJSON化可能に保つ。
現在のMatchStateはschemaVersion=6、rules f02-v1。v1/v2/v3/v4/v5からの読込みは提供せず、診断リプレイは同じschema/rules/scenarioを要求する。以後スキーマを変更するときも互換性の扱いを明示する。

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

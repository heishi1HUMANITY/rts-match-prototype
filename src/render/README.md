# 描画アダプター

将来の Three.js 盤面・カメラ・選択表示を置く。現在は未実装。

simulation の読み取り可能なスナップショットから表示を更新し、入力は command に変換する。
Mesh・Scene・Vector3 を simulation へ渡さない。resize、context loss、dispose はここで管理する。
Three.js は盤面実装時に依存として追加する。現時点では描画依存を先行導入しない。

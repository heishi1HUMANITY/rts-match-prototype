# エージェントへの引き継ぎ

## 次の入口

- repository: `heishi1HUMANITY/rts-match-prototype`。`git remote -v` で作業場所を照合する。
- 進捗の唯一の正は [全体Issue #12](https://github.com/heishi1HUMANITY/rts-match-prototype/issues/12) の「マージ済み」「プレイ検証済み」。状態やcommit SHAを文書に複製しない。
- [WORKFLOW](WORKFLOW.md) → [Issue作業手順](ISSUE_AGENT_RUNBOOK.md) → 対象Issueの最新本文・コメント・関連PR・mainを確認する。
- 次のCPと依存順は#12と対象Issueの最新本文で確認する。CP0のユーザー結果が出るまで次のF実装を開始しない。
- localhostのプロセス存続を推測せず、必要なら `npm ci` → `npm run build` → `npm run preview` で起動する。

## 合意事項

- ユーザーはCPごとに通常設定で1試合と確認3点を検査する。機能ごとの合格要求はしない。自動検証と独立モデルレビューを通したPRはユーザー合格前にマージできる。
- `gate:play` はマージ後も `status:unverified` としてCPへ載せる。CIやモデルのOKをユーザープレイ合格へ読み替えない。
- gateは実装Issue専用。decisionとcheckpointには付けない。CPが閉じるたび、NG機能と次CPのIssueだけ計画を見直す。
- 現在のグリッド/簡易記号は仮表示。各機能の操作UIと不可理由は実装時に必要。
- 研究は充填式、未指定はバンク、切替後も研究別進捗保持、必要量で即完了、基本0.2pt/秒＋所有稼働拠点ごと1pt/秒。
- 部隊操作はドラッグ、複数選択/全選択/一括移動・停止を維持する。
- 対象追跡は可視敵追跡、不可視では最終確認位置で保留、再発見で再開。拠点進軍と固定地点移動を区別する。
- 旧資料の試合時間/段階イベント/再建/徘徊NPCは自動採用しない。F07/F16の `kind:decision` に具体案とユーザーの判断を記録してから実装する。

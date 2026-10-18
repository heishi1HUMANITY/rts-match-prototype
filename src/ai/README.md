# NPCの意思決定

`strategy.ts` の方針は陣営別FactionViewとJSON化可能な自陣営policy memoryだけを読み、共通commandと次のmemoryを返す純粋関数。人間と同じ資源・視界・生産時間・部隊上限・研究条件を共有し、入力stateを直接変更しない。

runtime/advanceが `rules.npc.decisionIntervalTicks` ごとにB/Cの判断とmemoryを同じsnapshotから作り、両方を保存した後に共通validatorへ適用する。標準とG3検査で稼働し、機能別の手動検査では停止する。memoryは公開首位・通知と自視界から得た標的判断だけを持ち、診断replayも同じadvanceから再生成する。

1回の命令数は `rules.npc.maxCommandsPerDecision` で制限する。生産・研究・拠点強化・ID順の各部隊に固定の判断枠を設け、経過tickから開始枠を毎回1つ進める。低い命令上限でも経済行動だけで枠を使い切らず、各部隊へ順番に指示が回る。進行中の研究は完了まで継続し、移動・追跡中の同じ命令は再発行しない。

F02では可視敵と戦略拠点に共通march commandを使う。同じ対象への追跡・保留を継続し、新しい可視脅威があれば切り替える。視界喪失時に隠れた敵位置を検索しない。

最小方針は強襲中心の生産、戦力I→II、未所有拠点の探索/制圧、近くの可視敵への防衛、拠点獲得後の敵首都への進軍。難易度や無料資源補正は加えない。契約は `docs/project/preparation/G3_DESIGN.md` を参照。

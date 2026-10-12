# NPCの意思決定

`strategy.ts` の `decideBotCommands(view)` は陣営別FactionViewだけを読み、共通commandを返す純粋関数。人間と同じ資源・視界・生産時間・部隊上限・研究条件を共有し、stateを直接変更しない。

runtime/advanceが毎10tickにB/Cの判断を同じsnapshotから作り、共通validatorへ適用する。標準とG3検査で稼働し、G2とF02の手動検査は停止。永続内部状態・壁時計・非可視敵の情報を持たず、診断replayも同じadvanceから再生成する。

F02では可視敵と戦略拠点に共通march commandを使う。同じ対象への追跡・保留を継続し、新しい可視脅威があれば切り替える。視界喪失時に隠れた敵位置を検索しない。

最小方針は強襲中心の生産、戦力I→II、未所有拠点の探索/制圧、近くの可視敵への防衛、拠点獲得後の敵首都への進軍。難易度や無料資源補正は加えない。契約は `docs/project/preparation/G3_DESIGN.md` を参照。

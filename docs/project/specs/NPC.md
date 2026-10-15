# 対戦NPC・現地勢力

## 対戦B/C

- 人間と同じ資源・視界・研究・生産・command検証を使う。選択方針は `ai`、ルールは `simulation`。不可視敵位置・敵資源・敵研究・敵キューを判断入力へ渡さない。
- `npc.decisionIntervalTicks` ごとにB/C両方を同じ命令適用前snapshotの陣営別viewから判断。`maxCommandsPerDecision` を上限に共通commandで実行する。
- 防衛、領土確保、研究、生産、建設、強化、駐留、作戦指令を判断する。検査scenarioではNPCを停止する場合がある。難度は判断頻度・命令数・各兵種の性能に依存する。

## 中立守備・現地勢力

- 中立守備は拠点の防衛HPプール。[拠点・守備・施設](BASES.md) を参照する。独立して生産・侵攻しない。
- 現地勢力は `local` combatant。本拠 `LOCAL-HQ`、初期拠点 `OUT-02`、部隊、補給、周期生産、侵攻を持つ。A/B/CのFactionId・順位・チケットには追加しない。
- 現在の標準マスタは `localFaction.enabled = false`。機能自体は存在し、有効時に指定tickで出現する。旧資料の「標準で30秒出現」をそのまま現行体験と扱わない。
- 追加部隊は専用補給を支払い、上限と周期を守る。視界を考慮して侵攻先を決め、完成済み渡河経路を兵種制約に従い利用する。成長率は出現後の経過分に応じた生成部隊の性能へ反映する。
- 現地勢力からの拠点奪還報酬は拠点ごとに一回、本拠討伐報酬も一回。同率討伐に報酬を与えない。
- 現地勢力の命令判断間隔はruntimeで10tick固定。マスタ画面で出現・生産・成長・報酬等を編集できる。現地勢力だけの兵種別性能と編成AIの編集は提供しない。
- 徘徊NPCの別出現ループはない。独立して移動・侵攻するNPCは、現在は上記の現地勢力のみ。

数値: `npc`、`localFaction`。実装: [strategy.ts](../../../src/ai/strategy.ts)、[local-faction.ts](../../../src/ai/local-faction.ts)、[現地勢力ルール](../../../src/simulation/local-faction.ts)、[advance.ts](../../../src/runtime/advance.ts)。検証: [strategy.test.ts](../../../src/ai/strategy.test.ts)、[local-faction.test.ts](../../../src/simulation/local-faction.test.ts)、[npc-pacing.test.ts](../../../src/runtime/npc-pacing.test.ts)。

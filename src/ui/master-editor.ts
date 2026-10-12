import type { MasterEnvelope, RulesMaster } from '../simulation/rules';
import {
  cloneRules,
  DEFAULT_RULES,
  MASTER_SCHEMA_VERSION,
} from '../simulation/rules';
import { validateRules } from '../simulation/rules-validation';
import type { ValidationIssue } from '../simulation/rules-validation';
import { rulesContentId } from '../runtime/diagnostics';
import { parseMasterJson } from '../runtime/master-store';

export interface MasterEditorOptions {
  readonly onSave: (rules: RulesMaster) =>
    | { readonly ok: true; readonly envelope: MasterEnvelope }
    | {
        readonly ok: false;
        readonly message: string;
        readonly issues?: readonly ValidationIssue[];
      };
  readonly onReset: () =>
    | { readonly ok: true; readonly envelope: MasterEnvelope }
    | {
        readonly ok: false;
        readonly message: string;
        readonly issues?: readonly ValidationIssue[];
      };
  readonly onStart: (rules: RulesMaster) => void;
  readonly saved: () => MasterEnvelope;
  readonly active: () => RulesMaster;
  readonly onClose?: () => void;
}

interface FieldMeta {
  readonly label: string;
  readonly unit: string;
  readonly help: string;
}
const FIELD_META: Readonly<Record<string, FieldMeta>> = {
  respawnEnabled: {
    label: '守備NPCの復活',
    unit: '',
    help: '無効にすると、撃破された守備NPCは復活しません。',
  },
  appearanceTick: {
    label: '出現時刻',
    unit: 'tick (0.1秒)',
    help: '通常試合の開始から現地勢力が出現するまでの時間です。',
  },
  initialUnits: {
    label: '初期部隊数',
    unit: '部隊',
    help: '出現時に配置する強襲・偵察部隊の数です。',
  },
  spawnIntervalTicks: {
    label: '増援間隔',
    unit: 'tick (0.1秒)',
    help: '現地勢力が部隊を追加する間隔です。',
  },
  maxUnits: {
    label: '部隊上限',
    unit: '部隊',
    help: '現地勢力が同時に保有できる部隊数です。',
  },
  startingSupplyCenti: {
    label: '開始時の補給',
    unit: '補給 ×100',
    help: '現地勢力の初期補給です。',
  },
  unitCostCenti: {
    label: '増援コスト',
    unit: '補給 ×100',
    help: '増援1部隊の生産に必要な補給です。',
  },
  growthPercentPerMinute: {
    label: '部隊成長率',
    unit: '%/分',
    help: '出現後1分ごとに追加される部隊HP・攻撃力の成長率です。',
  },
  rescueRadius: {
    label: '救援判断距離',
    unit: 'セル',
    help: '自軍拠点の近くにいる敵を救援対象とする距離です。',
  },
  captureRewardSupplyCenti: {
    label: '拠点奪還報酬（補給）',
    unit: '補給 ×100',
    help: 'local所有拠点を初めて奪還した陣営への報酬です。',
  },
  captureRewardResearchCenti: {
    label: '拠点奪還報酬（研究）',
    unit: '研究 pt ×100',
    help: 'local所有拠点を初めて奪還した陣営への報酬です。',
  },
  strongholdRewardSupplyCenti: {
    label: '本拠討伐報酬（補給）',
    unit: '補給 ×100',
    help: '現地勢力の本拠を破壊した陣営への報酬です。',
  },
  strongholdRewardResearchCenti: {
    label: '本拠討伐報酬（研究）',
    unit: '研究 pt ×100',
    help: '現地勢力の本拠を破壊した陣営への報酬です。',
  },
  maxHp: {
    label: '最大HP',
    unit: 'HP',
    help: '新規作成される部隊・拠点・守備に適用します。',
  },
  damageVsLand: {
    label: '対陸damage',
    unit: 'damage/tick',
    help: '陸上兵種へ与える1tickごとのdamageです。0は攻撃不可。',
  },
  damageVsAir: {
    label: '対空damage',
    unit: 'damage/tick',
    help: '航空兵種へ与える1tickごとのdamageです。0は攻撃不可。',
  },
  damageVsWater: {
    label: '対艦damage',
    unit: 'damage/tick',
    help: '水上兵種へ与える1tickごとのdamageです。0は攻撃不可。',
  },
  damageVsStructure: {
    label: '対構造物damage',
    unit: 'damage/tick',
    help: '守備・拠点・渡河設備・現地本拠へ与えるdamageです。0は攻撃不可。',
  },
  attackTargets: {
    label: '攻撃できる対象',
    unit: '',
    help: '対象を選択します。damageが0の対象は選択しても攻撃しません。',
  },
  canCaptureBase: {
    label: '拠点を制圧できる',
    unit: '',
    help: '無効な部隊は拠点の所有を変更できません。',
  },
  captureEfficiencyPercent: {
    label: '制圧効率',
    unit: '%',
    help: '制圧可能兵種の1部隊あたりの進捗速度です。100%が標準、複数部隊の進捗は加算されます。',
  },
  lossTicketsCenti: {
    label: '損失ticket',
    unit: 'ticket ×100',
    help: 'この兵種を失った陣営のticket減少量です。',
  },
  range: { label: '攻撃射程', unit: 'セル', help: '円形の攻撃範囲です。' },
  vision: { label: '視界', unit: 'セル', help: '円形の視界範囲です。' },
  costCenti: {
    label: '生産/研究コスト',
    unit: '補給・研究 pt ×100',
    help: '内部値は1/100単位の整数です。',
  },
  buildTicks: {
    label: '生産時間',
    unit: 'tick (0.1秒)',
    help: '完了後に部隊を配置します。',
  },
  upkeepCentiPerTick: {
    label: '維持費',
    unit: '補給 ×100/tick',
    help: '毎tickの維持費です。',
  },
  moveTicksPerCell: {
    label: '移動時間',
    unit: 'tick/セル',
    help: '1セル移動に必要な固定tick数です。',
  },
  supplyIncomeCentiPerTick: {
    label: '補給収入',
    unit: '補給 ×100/tick',
    help: '稼働中の所有拠点から得る収入です。',
  },
  researchIncomeCentiPerTick: {
    label: '研究収入',
    unit: '研究 pt ×100/tick',
    help: '稼働中の所有拠点から得る収入です。',
  },
  ticketWeight: {
    label: 'チケット重み',
    unit: '重み',
    help: '一定間隔の所有拠点差によるチケット圧力に使います。',
  },
  damageBonus: {
    label: '攻撃力上昇',
    unit: 'damage/tick',
    help: '研究完了時に部隊の攻撃へ加算します。',
  },
  unlocksCrossing: {
    label: '渡河設備解放',
    unit: '機能ID',
    help: 'F04で実装済みの橋・索道の級だけを解放します。',
  },
  dismantleTicks: {
    label: '解体時間',
    unit: 'tick (0.1秒)',
    help: '所有設備の解体に必要な時間です。',
  },
  regenerationPerTick: {
    label: '耐久回復',
    unit: 'HP/tick',
    help: '最後の被弾から1秒経過後の回復量です。',
  },
  recoveryPerTick: {
    label: '拠点回復量',
    unit: 'HP/tick',
    help: '被弾停止時間が過ぎた所有拠点の回復量です。',
  },
  recoveryDelayTicks: {
    label: '被弾後の回復停止',
    unit: 'tick (0.1秒)',
    help: '最後の被弾から回復を再開するまでの時間です。',
  },
  maxHpPercent: {
    label: '最大HP倍率',
    unit: '%',
    help: '強化完了後の最大HPをLv1と比べた割合です。',
  },
  supplyIncomePercent: {
    label: '補給収入倍率',
    unit: '%',
    help: '強化完了後の補給収入をLv1と比べた割合です。',
  },
  researchIncomePercent: {
    label: '研究収入倍率',
    unit: '%',
    help: '強化完了後の研究収入をLv1と比べた割合です。',
  },
  turretDamage: {
    label: '砲座damage',
    unit: 'HP/射撃',
    help: '射撃間隔ごとに最も近い敵部隊へ与えるdamageです。航空部隊には半分になります。',
  },
  turretRange: {
    label: '砲座射程',
    unit: 'セル',
    help: '拠点中心から敵部隊を攻撃できる距離です。',
  },
  turretIntervalTicks: {
    label: '砲座射撃間隔',
    unit: 'tick (0.1秒)',
    help: '同じ部隊を連続して撃つ間隔です。',
  },
  prerequisite: {
    label: '前提研究',
    unit: '研究ID',
    help: '前提なし、または対応済みの研究を選びます。',
  },
  timeLimitTicks: {
    label: '試合時間',
    unit: 'tick (0.1秒)',
    help: '通常設定の制限時間です。',
  },
  initialSupplyCenti: {
    label: '開始補給',
    unit: '補給 ×100',
    help: '各陣営の開始時補給です。',
  },
  initialResearchCenti: {
    label: '開始研究バンク',
    unit: '研究 pt ×100',
    help: '各陣営の開始時研究です。',
  },
  initialTicketsCenti: {
    label: '開始チケット',
    unit: 'チケット ×100',
    help: '各陣営の開始時チケットです。',
  },
  unitLossTicketsCenti: {
    label: '部隊損失',
    unit: 'チケット ×100',
    help: '部隊撃破時のチケット減少量です。',
  },
  hqLossTicketsCenti: {
    label: '首都損失',
    unit: 'チケット ×100',
    help: '首都破壊時のチケット減少量です。',
  },
  unitsPerFaction: {
    label: '部隊上限',
    unit: '部隊',
    help: '生産予約中の部隊も数えます。',
  },
  productionQueue: {
    label: '生産キュー上限',
    unit: '件',
    help: '進行中の生産も数えます。',
  },
  requiredTicks: {
    label: '制圧時間',
    unit: 'tick (0.1秒)',
    help: '単独の陣営だけが範囲にいる必要時間です。',
  },
  radius: {
    label: '制圧半径',
    unit: 'セル',
    help: '拠点を制圧できる範囲です。',
  },
  respawnTicks: {
    label: '守備復活時間',
    unit: 'tick (0.1秒)',
    help: '制圧可能な部隊が範囲にいない間、守備撃破後に復活するまでの時間です。',
  },
  updateIntervalTicks: {
    label: '更新間隔',
    unit: 'tick (0.1秒)',
    help: '拠点重みのチケット圧力を更新する間隔です。',
  },
  penaltyPerWeightCenti: {
    label: '重みあたり減少',
    unit: 'チケット ×100',
    help: '拠点差の重み1ごとに減る量です。',
  },
  maximumPenaltyWeight: {
    label: '減少重み上限',
    unit: '重み',
    help: '1回の更新で適用する減少重みの上限です。',
  },
  decisionIntervalTicks: {
    label: '判断間隔',
    unit: 'tick (0.1秒)',
    help: 'NPCが判断して命令を作る間隔です。',
  },
  defenseAttentionRadius: {
    label: '防衛判断距離',
    unit: 'セル',
    help: '味方付近の敵を防衛目標とする距離です。',
  },
  maxCommandsPerDecision: {
    label: '判断あたり命令上限',
    unit: '命令',
    help: 'NPCが1回に出せる命令数の上限です。',
  },
  baseIncomeCentiPerTick: {
    label: '基礎研究収入',
    unit: '研究 pt ×100/tick',
    help: '各陣営が拠点とは別に得る研究収入です。',
  },
};

function getPath(source: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (value, key) => (value as Record<string, unknown>)[key],
      source,
    );
}
function setPath(
  source: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split('.');
  let cursor = source;
  for (const key of parts.slice(0, -1))
    cursor = cursor[key] as Record<string, unknown>;
  cursor[parts.at(-1)!] = value;
}

function fieldsFor(rules: RulesMaster): {
  readonly group: string;
  readonly path: string;
  readonly value: unknown;
}[] {
  const labels: Record<string, string> = {
    baseUpgrades: '拠点強化',
    units: '兵種',
    bases: '拠点',
    defenses: '中立守備',
    'research.definitions': '研究',
    'research.baseIncomeCentiPerTick': '研究',
    crossings: '渡河設備',
    match: '試合',
    limits: '上限',
    capture: '制圧',
    tickets: 'チケット',
    npc: 'NPC',
    localFaction: '現地勢力',
  };
  const result: { group: string; path: string; value: unknown }[] = [];
  const visit = (value: unknown, path: string, group: string): void => {
    if (Array.isArray(value)) {
      if (path.endsWith('.attackTargets')) {
        result.push({ group, path, value });
        return;
      }
      if (path.endsWith('.prerequisites') || path.endsWith('.exclusiveWith'))
        return;
      value.forEach((child, index) => visit(child, `${path}.${index}`, group));
      return;
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      const key = path.split('.').at(-1)!;
      if (path.startsWith('units.') && key === 'baseDamage') return;
      if (
        [
          'domain',
          'stage',
          'prerequisites',
          'exclusiveWith',
          'id',
          'crossingTier',
          'movementDomain',
          'unlockResearchId',
          'unitKind',
          'level2ResearchId',
          'level3ResearchId',
        ].includes(key)
      )
        return;
      const unlockValue = path.match(
        /^research\.definitions\.([^.]+)\.effects\.(\d+)\.value$/,
      );
      if (
        unlockValue &&
        ['crossing-unlock', 'unit-unlock'].includes(
          String(
            getPath(
              rules,
              `research.definitions.${unlockValue[1]}.effects.${unlockValue[2]}.id`,
            ),
          ),
        )
      )
        return;
      result.push({ group, path, value });
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      const next = path ? `${path}.${key}` : key;
      const nextGroup = labels[next] ?? group;
      visit(child, next, nextGroup);
    }
  };
  visit(rules, '', '');
  return result;
}

function fieldLabel(path: string): string {
  const part = path.split('.').at(-1)!;
  const base = FIELD_META[part]?.label ?? part;
  const ids: Record<string, string> = {
    assault: '強襲',
    scout: '偵察',
    artillery: '自走砲',
    antiAir: '対空車両',
    helicopter: '攻撃ヘリ',
    patrolBoat: '哨戒艇',
    hq: '首都',
    outpost: '小拠点',
    medium: '中拠点',
    large: '大拠点',
    'firepower-1': '戦力研究 I',
    'firepower-2': '戦力研究 II',
    'supply-lines-1': '兵站・供給路 I',
    'maintenance-1': '兵站・維持 I',
    'survey-1': '情報・測量 I',
    'survey-2': '情報・測量 II',
    'artillery-1': '自走砲',
    'air-defense-1': '対空車両',
    'aircraft-1': '攻撃ヘリ',
    'naval-1': '哨戒艇',
    'base-development-1': '拠点整備',
    'base-development-2': '要塞化',
    level2: 'Lv2',
    level3: 'Lv3',
    stronghold: '本拠',
  };
  const parent = path.split('.').at(-2);
  const effectMatch = path.match(
    /^research\.definitions\.([^.]+)\.effects\.(\d+)\.value$/,
  );
  if (effectMatch) {
    const researchId = effectMatch[1]!;
    const def = DEFAULT_RULES.research.definitions[researchId];
    const effect = def?.effects[Number(effectMatch[2])];
    const effectNames: Record<string, string> = {
      'damage-bonus': '攻撃上昇',
      'vision-bonus': '視界上昇',
      'supply-income-bonus': '拠点補給収入',
      'upkeep-reduction': '維持費減額',
      'crossing-unlock': '渡河解放（数値なし）',
      'unit-unlock': '兵種解放（数値なし）',
      'base-upgrade-max': '強化上限レベル',
    };
    return `${ids[researchId] ?? researchId} · ${effectNames[effect?.id ?? ''] ?? '効果値'}`;
  }
  const upgradePath = path.match(
    /^baseUpgrades\.kinds\.(hq|outpost|medium|large)\.(level2|level3)\.(.+)$/,
  );
  if (upgradePath)
    return `${ids[upgradePath[1]!] ?? upgradePath[1]} ${ids[upgradePath[2]!] ?? upgradePath[2]} · ${FIELD_META[upgradePath[3] ?? '']?.label ?? upgradePath[3]}`;
  return `${ids[parent ?? ''] ? `${ids[parent!]} · ` : ''}${base}`;
}

export function createMasterEditor(
  root: HTMLElement,
  options: MasterEditorOptions,
): {
  open(): void;
  close(): void;
} {
  const dialog = document.createElement('dialog');
  dialog.className = 'master-dialog';
  dialog.setAttribute('aria-labelledby', 'master-title');
  dialog.innerHTML = `<form method="dialog" class="master-editor"><header><div><h1 id="master-title">マスタ管理</h1><p data-master-state></p></div><button value="close" data-master-close>閉じる</button></header><div class="master-active"></div><div class="master-fields"></div><section class="master-json"><label for="master-json-input">JSON読込</label><input id="master-file" type="file" accept="application/json,.json"><textarea id="master-json-input" rows="3" placeholder="JSONを貼り付けても読み込めます"></textarea><button type="button" data-master-import>JSONを検証して読込</button><button type="button" data-master-export>JSONを書き出す</button></section><div class="master-error" role="alert" aria-live="polite"></div><footer><button type="button" data-master-reset>標準値へ戻す</button><span></span><button type="button" data-master-save>保存する</button><button type="button" class="primary" data-master-start>保存値で新しく開始</button></footer></form>`;
  root.append(dialog);
  const fieldHost = dialog.querySelector<HTMLElement>('.master-fields')!;
  const state = dialog.querySelector<HTMLElement>('[data-master-state]')!;
  const active = dialog.querySelector<HTMLElement>('.master-active')!;
  const errorHost = dialog.querySelector<HTMLElement>('.master-error')!;
  let savedEnvelope = options.saved();
  let draft = cloneRules(savedEnvelope.rules);
  let importedFile: string | null = null;
  let draftDirty = false;

  const showValidation = (issues: readonly ValidationIssue[]): void => {
    const lines = issues.map(
      (issue) => `${issue.key || 'master'}：${issue.message}`,
    );
    errorHost.textContent = lines.join('\n');
    for (const input of fieldHost.querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >('[data-master-path]')) {
      const fieldPath = input.dataset.masterPath!;
      const issue = issues.find((entry) => entry.key === fieldPath);
      input.setAttribute('aria-invalid', String(issue !== undefined));
      const detail = input
        .closest('.master-field')
        ?.querySelector<HTMLElement>('.master-field-error');
      if (detail) detail.textContent = issue?.message ?? '';
    }
  };
  const render = (): void => {
    fieldHost.replaceChildren();
    let groupHost: HTMLElement | null = null;
    let groupName = '';
    for (const field of fieldsFor(draft)) {
      if (field.group !== groupName) {
        groupName = field.group;
        groupHost = document.createElement('section');
        groupHost.className = 'master-group';
        const title = document.createElement('h2');
        title.textContent = groupName;
        groupHost.append(title);
        fieldHost.append(groupHost);
      }
      const meta = FIELD_META[field.path.split('.').at(-1)!] ?? {
        unit: '',
        help: '試合の新しい設定に適用されます。',
        label: '',
      };
      const label = document.createElement('label');
      label.className = 'master-field';
      const name = document.createElement('strong');
      name.textContent = fieldLabel(field.path);
      const detail = document.createElement('small');
      const standardValue = getPath(DEFAULT_RULES, field.path);
      const standardLabel =
        typeof standardValue === 'boolean'
          ? standardValue
            ? '有効'
            : '無効'
          : String(standardValue);
      detail.textContent = `${meta.unit}${meta.unit ? ' · ' : ''}${meta.help} 標準値: ${standardLabel}`;
      if (Array.isArray(field.value) && field.path.endsWith('.attackTargets')) {
        const choices = [
          ['unit', '部隊'],
          ['defender', '中立守備'],
          ['base', '拠点'],
          ['crossing', '渡河設備'],
          ['stronghold', '現地勢力本拠'],
        ] as const;
        const container = document.createElement('div');
        container.className = 'master-field master-targets';
        container.dataset.masterPath = field.path;
        const name = document.createElement('strong');
        name.textContent = fieldLabel(field.path);
        const help = document.createElement('small');
        help.textContent = meta.help;
        container.append(name, help);
        for (const [value, text] of choices) {
          const option = document.createElement('label');
          option.className = 'master-target-option';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = field.value.includes(value);
          checkbox.dataset.masterPath = field.path;
          checkbox.dataset.masterArrayOption = value;
          option.append(checkbox, text);
          container.append(option);
        }
        const fieldError = document.createElement('small');
        fieldError.className = 'master-field-error';
        container.append(fieldError);
        groupHost!.append(container);
        continue;
      }
      const input =
        field.path.endsWith('.prerequisite') ||
        field.path.endsWith('.unlocksCrossing')
          ? document.createElement('select')
          : document.createElement('input');
      input.dataset.masterPath = field.path;
      if (input instanceof HTMLInputElement) {
        if (typeof field.value === 'boolean') {
          input.type = 'checkbox';
          input.checked = field.value;
        } else {
          input.type = 'number';
          input.step = '1';
          if (field.path.endsWith('.captureEfficiencyPercent')) {
            input.min = '0';
            input.max = '1000';
          }
          input.value = String(field.value);
          input.inputMode = 'numeric';
        }
      } else {
        input.innerHTML = field.path.endsWith('.unlocksCrossing')
          ? '<option value="">なし</option><option value="bridge-2">橋 II</option><option value="bridge-3">橋 III</option><option value="ropeway-1">索道 I</option><option value="ropeway-2">索道 II</option>'
          : '<option value="">前提なし</option><option value="firepower-1">戦力研究 I</option><option value="firepower-2">戦力研究 II</option><option value="bridge-2">架橋 II</option><option value="bridge-3">架橋 III</option><option value="ropeway-1">索道 I</option><option value="ropeway-2">索道 II</option>';
        input.value = field.value === null ? '' : String(field.value);
      }
      const fieldError = document.createElement('small');
      fieldError.className = 'master-field-error';
      label.append(name, detail, input, fieldError);
      groupHost!.append(label);
    }
    active.textContent = `現在の試合: ${rulesContentId(options.active())} · 保存後も進行中の値は変わりません。`;
    state.textContent = `保存済み revision ${savedEnvelope.revision} · ${draftDirty ? '未保存の変更あり' : '保存値と一致'} · 保存後は次の新規試合に適用`;
  };
  const collect = ():
    | { readonly ok: true; readonly rules: RulesMaster }
    | { readonly ok: false; readonly issues: readonly ValidationIssue[] } => {
    const next = cloneRules(draft) as unknown as Record<string, unknown>;
    for (const input of fieldHost.querySelectorAll<
      HTMLInputElement | HTMLSelectElement
    >('[data-master-path]')) {
      const path = input.dataset.masterPath!;
      if (input.dataset.masterArrayOption) {
        const options = Array.from(
          fieldHost.querySelectorAll<HTMLInputElement>(
            '[data-master-array-option]',
          ),
        ).filter((entry) => entry.dataset.masterPath === path);
        if (options[0] !== input) continue;
        setPath(
          next,
          path,
          options
            .filter((entry) => entry.checked)
            .map((entry) => entry.dataset.masterArrayOption!),
        );
        continue;
      }
      const value =
        input instanceof HTMLInputElement
          ? input.type === 'checkbox'
            ? input.checked
            : input.value === ''
              ? ''
              : Number(input.value)
          : input.value || null;
      setPath(next, path, value);
    }
    const result = validateRules(next);
    if (!result.ok) showValidation(result.issues);
    return result;
  };
  const commitSave = (): MasterEnvelope | null => {
    const result = collect();
    if (!result.ok) return null;
    const saved = options.onSave(result.rules);
    if (!saved.ok) {
      errorHost.textContent = saved.message;
      if (saved.issues) showValidation(saved.issues);
      return null;
    }
    savedEnvelope = saved.envelope;
    draft = cloneRules(saved.envelope.rules);
    draftDirty = false;
    render();
    errorHost.textContent = '保存しました。現在の試合は変更されていません。';
    return saved.envelope;
  };
  dialog.addEventListener('input', (event) => {
    const target = event.target;
    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLSelectElement)
    )
      return;
    if (!target.dataset.masterPath) return;
    draftDirty = true;
    state.textContent = `保存済み revision ${savedEnvelope.revision} · 未保存の変更あり · 保存後は次の新規試合に適用`;
    const check = collect();
    if (check.ok) {
      draft = cloneRules(check.rules);
      showValidation([]);
    }
  });
  dialog.addEventListener('change', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === 'file') {
      const file = target.files?.[0];
      if (!file) return;
      void file.text().then((text) => {
        importedFile = text;
        dialog.querySelector<HTMLTextAreaElement>('#master-json-input')!.value =
          text;
      });
    }
  });
  dialog.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-master-close]')) {
      event.preventDefault();
      dialog.close();
      options.onClose?.();
    }
    if (target.closest('[data-master-save]')) {
      event.preventDefault();
      commitSave();
    }
    if (target.closest('[data-master-start]')) {
      event.preventDefault();
      const envelope = commitSave();
      if (envelope) {
        dialog.close();
        options.onClose?.();
        options.onStart(envelope.rules);
      }
    }
    if (target.closest('[data-master-reset]')) {
      event.preventDefault();
      const reset = options.onReset();
      if (!reset.ok) {
        errorHost.textContent = reset.message;
        return;
      }
      savedEnvelope = reset.envelope;
      draft = cloneRules(reset.envelope.rules);
      draftDirty = false;
      render();
      errorHost.textContent = '標準値を保存しました。';
    }
    if (target.closest('[data-master-import]')) {
      event.preventDefault();
      const json =
        importedFile ??
        dialog.querySelector<HTMLTextAreaElement>('#master-json-input')!.value;
      try {
        const parsed = parseMasterJson(json);
        if (!parsed.ok) {
          errorHost.textContent = parsed.error.message;
          if (parsed.error.issues) showValidation(parsed.error.issues);
          return;
        }
        draft = cloneRules(parsed.envelope.rules);
        draftDirty = true;
        render();
        errorHost.textContent =
          '読込値を検証しました。保存するまでは保存値・試合へ反映されません。';
      } catch {
        errorHost.textContent = 'JSONを解析できません。';
      }
    }
    if (target.closest('[data-master-export]')) {
      event.preventDefault();
      const valid = collect();
      if (!valid.ok) return;
      const json = JSON.stringify(
        {
          masterSchemaVersion: MASTER_SCHEMA_VERSION,
          revision: savedEnvelope.revision,
          rules: valid.rules,
        },
        null,
        2,
      );
      const url = URL.createObjectURL(
        new Blob([`${json}\n`], { type: 'application/json' }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'rts-match-master.json';
      anchor.click();
      URL.revokeObjectURL(url);
    }
  });
  dialog.addEventListener('close', () => options.onClose?.());
  render();
  return {
    open() {
      savedEnvelope = options.saved();
      draft = cloneRules(savedEnvelope.rules);
      draftDirty = false;
      render();
      errorHost.textContent = '';
      if (!dialog.open) dialog.showModal();
    },
    close() {
      if (dialog.open) dialog.close();
    },
  };
}

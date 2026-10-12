import { DEFAULT_RULES, MASTER_SCHEMA_VERSION } from './rules';
import type { MasterEnvelope, RulesMaster } from './rules';

export interface ValidationIssue {
  readonly key: string;
  readonly message: string;
}

export type ValidationResult =
  | { readonly ok: true; readonly rules: RulesMaster }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string,
  issues: ValidationIssue[],
): void {
  for (const key of keys)
    if (!(key in value))
      issues.push({ key: `${path}.${key}`, message: '必須項目です' });
  for (const key of Object.keys(value))
    if (!keys.includes(key))
      issues.push({ key: `${path}.${key}`, message: '未対応の項目です' });
}

function numberField(
  value: unknown,
  min: number,
  max: number,
  positive = false,
): number | undefined {
  if (
    !isInteger(value) ||
    value < min ||
    value > max ||
    (positive && value === 0)
  )
    return undefined;
  return value;
}

/** Validates untrusted import/storage data and returns a detached, complete rules object. */
export function validateRules(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input))
    return {
      ok: false,
      issues: [
        { key: '', message: 'マスタはJSONオブジェクトで指定してください' },
      ],
    };
  const rootKeys = [
    'units',
    'bases',
    'defenses',
    'research',
    'crossings',
    'match',
    'limits',
    'capture',
    'tickets',
    'npc',
    'localFaction',
  ] as const;
  exactKeys(input, rootKeys, 'rules', issues);
  const walk = (value: unknown, defaults: unknown, path: string): unknown => {
    if (!isRecord(value) || !isRecord(defaults)) {
      issues.push({ key: path, message: 'オブジェクト形式が必要です' });
      return defaults;
    }
    const keys = Object.keys(defaults);
    exactKeys(value, keys, path, issues);
    const output: Record<string, unknown> = {};
    for (const key of keys) {
      const expected = defaults[key];
      const actual = value[key];
      const fieldPath = `${path}.${key}`;
      if (isRecord(expected)) output[key] = walk(actual, expected, fieldPath);
      else if (typeof expected === 'boolean') {
        if (typeof actual !== 'boolean')
          issues.push({
            key: fieldPath,
            message: '有効/無効を指定してください',
          });
        output[key] = typeof actual === 'boolean' ? actual : expected;
      } else {
        const allowedNull = expected === null;
        if (allowedNull && (actual === null || typeof actual === 'string'))
          output[key] = actual;
        else if (!allowedNull && typeof expected === 'number') {
          const positive =
            !fieldPath.endsWith('initialResearchCenti') &&
            !fieldPath.endsWith('damageBonus') &&
            !fieldPath.endsWith('supplyIncomeCentiPerTick') &&
            !fieldPath.endsWith('researchIncomeCentiPerTick') &&
            !fieldPath.endsWith('baseIncomeCentiPerTick') &&
            !fieldPath.endsWith('upkeepCentiPerTick') &&
            !fieldPath.endsWith('penaltyPerWeightCenti') &&
            !fieldPath.endsWith('ticketWeight');
          const max = fieldPath.endsWith('timeLimitTicks')
            ? 100_000_000
            : fieldPath.endsWith('moveTicksPerCell') ||
                fieldPath.endsWith('decisionIntervalTicks') ||
                fieldPath.endsWith('updateIntervalTicks') ||
                fieldPath.endsWith('requiredTicks')
              ? 10_000
              : 1_000_000_000;
          const number = numberField(actual, 0, max, positive);
          if (number === undefined)
            issues.push({
              key: fieldPath,
              message: `整数で${positive ? '1以上' : '0以上'}${max}以下にしてください`,
            });
          output[key] = number ?? expected;
        } else if (typeof expected === 'string') {
          if (
            typeof actual !== 'string' ||
            (actual !== expected &&
              ![
                'firepower-1',
                'firepower-2',
                'bridge-2',
                'bridge-3',
                'ropeway-1',
                'ropeway-2',
              ].includes(actual))
          )
            issues.push({ key: fieldPath, message: '未対応のIDです' });
          output[key] = typeof actual === 'string' ? actual : expected;
        } else output[key] = actual;
      }
    }
    return output;
  };
  const rules = walk(input, DEFAULT_RULES, 'rules') as RulesMaster;
  for (const [id, def] of Object.entries(rules.research.definitions)) {
    if (
      def.unlocksCrossing !== null &&
      !['bridge-2', 'bridge-3', 'ropeway-1', 'ropeway-2'].includes(
        def.unlocksCrossing,
      )
    )
      issues.push({
        key: `rules.research.definitions.${id}.unlocksCrossing`,
        message: '未対応の渡河解放効果です',
      });
    if (
      def.prerequisite !== null &&
      !Object.hasOwn(rules.research.definitions, def.prerequisite)
    )
      issues.push({
        key: `rules.research.definitions.${id}.prerequisite`,
        message: '存在しない研究IDです',
      });
    if (def.prerequisite === id)
      issues.push({
        key: `rules.research.definitions.${id}.prerequisite`,
        message: '自分自身は前提にできません',
      });
    const seen = new Set<string>([id]);
    let next = def.prerequisite;
    while (next !== null) {
      if (seen.has(next)) {
        issues.push({
          key: `rules.research.definitions.${id}.prerequisite`,
          message: '研究前提に循環があります',
        });
        break;
      }
      seen.add(next);
      next = rules.research.definitions[next]?.prerequisite ?? null;
    }
  }
  if (rules.limits.unitsPerFaction < 2)
    issues.push({
      key: 'rules.limits.unitsPerFaction',
      message: '開始時の2部隊以上にしてください',
    });
  if (rules.localFaction.initialUnits > rules.localFaction.maxUnits)
    issues.push({
      key: 'rules.localFaction.initialUnits',
      message: '初期部隊数は現地勢力の部隊上限以下にしてください',
    });
  if (rules.localFaction.maxUnits > 64)
    issues.push({
      key: 'rules.localFaction.maxUnits',
      message: '現地勢力の部隊上限は64以下にしてください',
    });
  if (rules.localFaction.appearanceTick > rules.match.timeLimitTicks)
    issues.push({
      key: 'rules.localFaction.appearanceTick',
      message: '現地勢力の出現tickは試合時間内にしてください',
    });
  const growthAtMatchEnd =
    10_000 +
    Math.ceil(rules.match.timeLimitTicks / 600) *
      rules.localFaction.growthPercentPerMinute *
      100;
  for (const kind of ['assault', 'scout'] as const) {
    const grownHp = (rules.units[kind].maxHp * growthAtMatchEnd) / 10_000;
    const grownDamage =
      (rules.units[kind].baseDamage * growthAtMatchEnd) / 10_000;
    if (
      !Number.isSafeInteger(Math.round(grownHp)) ||
      !Number.isSafeInteger(Math.round(grownDamage))
    )
      issues.push({
        key: 'rules.localFaction.growthPercentPerMinute',
        message: '試合終了時の部隊成長値が安全な整数範囲を超えます',
      });
  }
  const product =
    rules.match.timeLimitTicks *
    (rules.research.baseIncomeCentiPerTick +
      Object.values(rules.bases).reduce(
        (sum, base) => sum + base.researchIncomeCentiPerTick,
        0,
      ));
  if (!Number.isSafeInteger(product))
    issues.push({
      key: 'rules.match.timeLimitTicks',
      message: '試合時間と研究収入の組み合わせが安全な整数範囲を超えます',
    });
  return issues.length > 0 ? { ok: false, issues } : { ok: true, rules };
}

export function validateEnvelope(
  input: unknown,
):
  | { readonly ok: true; readonly envelope: MasterEnvelope }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] } {
  if (
    !isRecord(input) ||
    Object.keys(input).length !== 3 ||
    Object.keys(input).some(
      (key) => !['masterSchemaVersion', 'revision', 'rules'].includes(key),
    ) ||
    !isInteger(input.revision) ||
    input.revision < 0 ||
    !('rules' in input) ||
    (input.masterSchemaVersion !== MASTER_SCHEMA_VERSION &&
      input.masterSchemaVersion !== 3 &&
      input.masterSchemaVersion !== 4 &&
      input.masterSchemaVersion !== 5)
  )
    return {
      ok: false,
      issues: [
        {
          key: 'masterSchemaVersion',
          message: '未対応または不正なマスタ形式です',
        },
      ],
    };
  let candidateRules = input.rules;
  if (input.masterSchemaVersion === 3) {
    if (!isRecord(input.rules) || Object.hasOwn(input.rules, 'defenses'))
      return {
        ok: false,
        issues: [
          {
            key: 'masterSchemaVersion',
            message: 'schema 3の設定形式として認識できません',
          },
        ],
      };
    candidateRules = { ...input.rules, defenses: DEFAULT_RULES.defenses };
  } else if (input.masterSchemaVersion === 4) {
    if (
      !isRecord(input.rules) ||
      !isRecord(input.rules.defenses) ||
      Object.hasOwn(input.rules.defenses, 'respawnEnabled')
    )
      return {
        ok: false,
        issues: [
          {
            key: 'masterSchemaVersion',
            message: 'schema 4の設定形式として認識できません',
          },
        ],
      };
    candidateRules = {
      ...input.rules,
      defenses: {
        ...input.rules.defenses,
        respawnEnabled: DEFAULT_RULES.defenses.respawnEnabled,
      },
    };
  }
  if (input.masterSchemaVersion !== MASTER_SCHEMA_VERSION) {
    if (!isRecord(candidateRules))
      return {
        ok: false,
        issues: [{ key: 'rules', message: '設定形式を認識できません' }],
      };
    if (!Object.hasOwn(candidateRules, 'localFaction'))
      candidateRules = {
        ...candidateRules,
        localFaction: DEFAULT_RULES.localFaction,
      };
  }
  const result = validateRules(candidateRules);
  return result.ok
    ? {
        ok: true,
        envelope: {
          masterSchemaVersion: MASTER_SCHEMA_VERSION,
          revision: input.revision,
          rules: result.rules,
        },
      }
    : result;
}

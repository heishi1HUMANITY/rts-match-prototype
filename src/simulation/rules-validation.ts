import { DEFAULT_RULES, MASTER_SCHEMA_VERSION } from './rules';
import type { MasterEnvelope, RulesMaster } from './rules';
import type { ResearchDefinition } from './config';
import type { CombatTargetKind, CrossingTierId, ResearchEffect } from './types';

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
    'baseUpgrades',
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
    if (Array.isArray(defaults)) {
      if (!Array.isArray(value)) {
        issues.push({ key: path, message: '配列形式が必要です' });
        return defaults;
      }
      if (path.endsWith('.effects')) {
        return value.map((entry, index) => {
          const effectPath = `${path}.${index}`;
          if (!isRecord(entry)) {
            issues.push({
              key: effectPath,
              message: '効果オブジェクトが必要です',
            });
            return defaults[0];
          }
          const unlock = entry.id === 'crossing-unlock';
          const unitUnlock = entry.id === 'unit-unlock';
          exactKeys(
            entry,
            unlock
              ? ['id', 'value', 'crossingTier']
              : unitUnlock
                ? ['id', 'value', 'unitKind']
                : ['id', 'value'],
            effectPath,
            issues,
          );
          if (
            ![
              'damage-bonus',
              'vision-bonus',
              'supply-income-bonus',
              'upkeep-reduction',
              'crossing-unlock',
              'unit-unlock',
              'base-upgrade-max',
            ].includes(String(entry.id))
          )
            issues.push({
              key: `${effectPath}.id`,
              message: '未実装の効果IDです',
            });
          if (
            !isInteger(entry.value) ||
            entry.value < 0 ||
            entry.value > 100_000
          )
            issues.push({
              key: `${effectPath}.value`,
              message: '0以上100000以下の整数が必要です',
            });
          if (
            unlock &&
            !['bridge-2', 'bridge-3', 'ropeway-1', 'ropeway-2'].includes(
              String(entry.crossingTier),
            )
          )
            issues.push({
              key: `${effectPath}.crossingTier`,
              message: '未対応の渡河解放IDです',
            });
          if (!unlock && Object.hasOwn(entry, 'crossingTier'))
            issues.push({
              key: `${effectPath}.crossingTier`,
              message: '渡河解放以外には指定できません',
            });
          if (
            unitUnlock &&
            !['artillery', 'antiAir', 'helicopter', 'patrolBoat'].includes(
              String(entry.unitKind),
            )
          )
            issues.push({
              key: `${effectPath}.unitKind`,
              message: '未対応の兵種解放IDです',
            });
          if (!unitUnlock && Object.hasOwn(entry, 'unitKind'))
            issues.push({
              key: `${effectPath}.unitKind`,
              message: '兵種解放以外には指定できません',
            });
          return {
            id: String(entry.id),
            value: isInteger(entry.value) ? entry.value : 0,
            ...(unlock && typeof entry.crossingTier === 'string'
              ? { crossingTier: entry.crossingTier }
              : {}),
            ...(unitUnlock && typeof entry.unitKind === 'string'
              ? { unitKind: entry.unitKind }
              : {}),
          };
        });
      }
      if (path.endsWith('.attackTargets')) {
        const allowed: readonly CombatTargetKind[] = [
          'unit',
          'defender',
          'base',
          'crossing',
          'stronghold',
        ];
        const targets = value.filter(
          (entry): entry is CombatTargetKind =>
            typeof entry === 'string' &&
            allowed.includes(entry as CombatTargetKind),
        );
        if (targets.length !== value.length)
          issues.push({ key: path, message: '未対応の攻撃対象種類です' });
        if (new Set(targets).size !== targets.length)
          issues.push({ key: path, message: '攻撃対象を重複指定できません' });
        return targets;
      }
      const values = value.filter(
        (entry): entry is string => typeof entry === 'string',
      );
      if (values.length !== value.length)
        issues.push({ key: path, message: '研究IDの配列が必要です' });
      if (new Set(values).size !== values.length)
        issues.push({ key: path, message: '同じ研究IDを重複指定できません' });
      return values;
    }
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
      if (isRecord(expected) || Array.isArray(expected))
        output[key] = walk(actual, expected, fieldPath);
      else if (typeof expected === 'boolean') {
        if (typeof actual !== 'boolean')
          issues.push({
            key: fieldPath,
            message: '有効/無効を指定してください',
          });
        output[key] = typeof actual === 'boolean' ? actual : expected;
      } else {
        const allowedNull = expected === null;
        if (allowedNull && (actual === null || typeof actual === 'string')) {
          if (
            fieldPath.endsWith('.unlockResearchId') &&
            ![
              null,
              'artillery-1',
              'air-defense-1',
              'aircraft-1',
              'naval-1',
            ].includes(actual)
          )
            issues.push({ key: fieldPath, message: '未対応の研究IDです' });
          output[key] = actual;
        } else if (!allowedNull && typeof expected === 'number') {
          const positive =
            !fieldPath.endsWith('initialResearchCenti') &&
            !fieldPath.endsWith('damageBonus') &&
            !fieldPath.includes('damageVs') &&
            !fieldPath.endsWith('supplyIncomeCentiPerTick') &&
            !fieldPath.endsWith('researchIncomeCentiPerTick') &&
            !fieldPath.endsWith('baseIncomeCentiPerTick') &&
            !fieldPath.endsWith('upkeepCentiPerTick') &&
            !fieldPath.endsWith('penaltyPerWeightCenti') &&
            !fieldPath.endsWith('ticketWeight');
          const max = fieldPath.endsWith('captureEfficiencyPercent')
            ? 1_000
            : fieldPath.endsWith('timeLimitTicks')
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
          const allowed = fieldPath.endsWith('.domain')
            ? ['power', 'logistics', 'information', 'engineering']
            : fieldPath.endsWith('.movementDomain')
              ? ['land', 'air', 'water']
              : fieldPath.endsWith('.unlockResearchId')
                ? [
                    null,
                    'artillery-1',
                    'air-defense-1',
                    'aircraft-1',
                    'naval-1',
                  ]
                : fieldPath.endsWith('.id')
                  ? [
                      'damage-bonus',
                      'vision-bonus',
                      'supply-income-bonus',
                      'upkeep-reduction',
                      'crossing-unlock',
                      'unit-unlock',
                      'base-upgrade-max',
                    ]
                  : [
                      'firepower-1',
                      'firepower-2',
                      'bridge-2',
                      'bridge-3',
                      'ropeway-1',
                      'ropeway-2',
                      'supply-lines-1',
                      'maintenance-1',
                      'survey-1',
                      'survey-2',
                      'base-development-1',
                      'base-development-2',
                      'artillery-1',
                      'air-defense-1',
                      'aircraft-1',
                      'naval-1',
                    ];
          if (
            (typeof actual !== 'string' && actual !== null) ||
            !allowed.includes(actual as string | null)
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
    const path = `rules.research.definitions.${id}`;
    if (
      !['power', 'logistics', 'information', 'engineering'].includes(def.domain)
    )
      issues.push({ key: `${path}.domain`, message: '未対応の研究分野です' });
    if (!Number.isSafeInteger(def.stage) || def.stage < 1 || def.stage > 20)
      issues.push({
        key: `${path}.stage`,
        message: '段階は1〜20の整数にしてください',
      });
    if (def.effects.length === 0)
      issues.push({
        key: `${path}.effects`,
        message: '効果のない研究は登録できません',
      });
    for (const prereq of def.prerequisites)
      if (!Object.hasOwn(rules.research.definitions, prereq))
        issues.push({
          key: `${path}.prerequisites`,
          message: `存在しない研究ID: ${prereq}`,
        });
    for (const excluded of def.exclusiveWith) {
      const peer = rules.research.definitions[excluded];
      if (!peer)
        issues.push({
          key: `${path}.exclusiveWith`,
          message: `存在しない研究ID: ${excluded}`,
        });
      else if (!peer.exclusiveWith.includes(id))
        issues.push({
          key: `${path}.exclusiveWith`,
          message: '排他指定は相手側にも同じIDを指定してください',
        });
    }
    if (def.prerequisites.includes(id) || def.exclusiveWith.includes(id))
      issues.push({
        key: path,
        message: '研究は自分自身を前提/排他に指定できません',
      });
    const seen = new Set<string>();
    const visit = (current: string): void => {
      if (seen.has(current)) {
        issues.push({
          key: `${path}.prerequisites`,
          message: '研究前提に循環があります',
        });
        return;
      }
      seen.add(current);
      for (const parent of rules.research.definitions[current]?.prerequisites ??
        [])
        visit(parent);
      seen.delete(current);
    };
    visit(id);
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
  for (const kind of Object.keys(
    rules.units,
  ) as (keyof RulesMaster['units'])[]) {
    const grownHp = (rules.units[kind].maxHp * growthAtMatchEnd) / 10_000;
    const grownDamage =
      (Math.max(
        rules.units[kind].damageVsLand,
        rules.units[kind].damageVsAir,
        rules.units[kind].damageVsWater,
        rules.units[kind].damageVsStructure,
      ) *
        growthAtMatchEnd) /
      10_000;
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
      input.masterSchemaVersion !== 5 &&
      input.masterSchemaVersion !== 6 &&
      input.masterSchemaVersion !== 7 &&
      input.masterSchemaVersion !== 8 &&
      input.masterSchemaVersion !== 9 &&
      input.masterSchemaVersion !== 10)
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
  if (input.masterSchemaVersion !== MASTER_SCHEMA_VERSION) {
    if (!isRecord(candidateRules))
      return {
        ok: false,
        issues: [{ key: 'rules', message: '設定形式を認識できません' }],
      };
    const oldUnits = isRecord(candidateRules.units) ? candidateRules.units : {};
    const units: Record<string, unknown> = {};
    for (const [kind, defaults] of Object.entries(DEFAULT_RULES.units)) {
      const old = isRecord(oldUnits[kind]) ? oldUnits[kind] : {};
      const { baseDamage: legacyDamage, ...preserved } = old;
      const fallback =
        typeof legacyDamage === 'number'
          ? {
              damageVsLand: legacyDamage,
              damageVsAir: legacyDamage,
              damageVsWater: legacyDamage,
              damageVsStructure: legacyDamage,
            }
          : {};
      units[kind] = { ...defaults, ...preserved, ...fallback };
    }
    candidateRules = { ...candidateRules, units };
  }
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
    candidateRules = {
      ...(isRecord(candidateRules) ? candidateRules : {}),
      defenses: DEFAULT_RULES.defenses,
    };
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
      ...(isRecord(candidateRules) ? candidateRules : {}),
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
    let migrationCandidate: Record<string, unknown> = candidateRules;
    if (!Object.hasOwn(migrationCandidate, 'localFaction'))
      migrationCandidate = {
        ...migrationCandidate,
        localFaction: DEFAULT_RULES.localFaction,
      };
    if (!Object.hasOwn(migrationCandidate, 'baseUpgrades'))
      migrationCandidate = {
        ...migrationCandidate,
        baseUpgrades: DEFAULT_RULES.baseUpgrades,
      };
    candidateRules = migrationCandidate;
  }
  if (
    input.masterSchemaVersion !== MASTER_SCHEMA_VERSION &&
    isRecord(candidateRules)
  ) {
    const oldResearch = isRecord(candidateRules.research)
      ? candidateRules.research
      : null;
    const oldDefinitions =
      oldResearch && isRecord(oldResearch.definitions)
        ? oldResearch.definitions
        : null;
    const converted = { ...DEFAULT_RULES.research.definitions } as Record<
      string,
      ResearchDefinition
    >;
    if (
      oldDefinitions &&
      input.masterSchemaVersion !== 7 &&
      input.masterSchemaVersion !== 8 &&
      input.masterSchemaVersion !== 9 &&
      input.masterSchemaVersion !== 10
    ) {
      const migrationIssues: ValidationIssue[] = [];
      for (const [id, oldValue] of Object.entries(oldDefinitions)) {
        if (!converted[id]) {
          migrationIssues.push({
            key: `rules.research.definitions.${id}`,
            message: '旧マスタに未知の研究IDがあります',
          });
          continue;
        }
        if (!isRecord(oldValue)) {
          migrationIssues.push({
            key: `rules.research.definitions.${id}`,
            message: '旧研究定義がオブジェクトではありません',
          });
          continue;
        }
        exactKeys(
          oldValue,
          ['costCenti', 'prerequisite', 'damageBonus', 'unlocksCrossing'],
          `rules.research.definitions.${id}`,
          migrationIssues,
        );
        const baseline = converted[id];
        const effects: ResearchEffect[] = [];
        if (
          typeof oldValue.damageBonus === 'number' &&
          oldValue.damageBonus > 0
        )
          effects.push({ id: 'damage-bonus', value: oldValue.damageBonus });
        if (typeof oldValue.unlocksCrossing === 'string')
          effects.push({
            id: 'crossing-unlock',
            value: 0,
            crossingTier: oldValue.unlocksCrossing as CrossingTierId,
          });
        converted[id] = {
          ...baseline,
          costCenti:
            typeof oldValue.costCenti === 'number'
              ? oldValue.costCenti
              : baseline.costCenti,
          prerequisites:
            typeof oldValue.prerequisite === 'string'
              ? [oldValue.prerequisite]
              : [],
          effects: effects.length ? effects : baseline.effects,
        };
      }
      if (migrationIssues.length > 0)
        return { ok: false, issues: migrationIssues };
    } else if (oldDefinitions) {
      for (const [id, oldValue] of Object.entries(oldDefinitions))
        if (Object.hasOwn(converted, id))
          converted[id] = oldValue as ResearchDefinition;
    }
    candidateRules = {
      ...candidateRules,
      research: {
        ...DEFAULT_RULES.research,
        ...(oldResearch ?? {}),
        definitions: converted,
      },
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

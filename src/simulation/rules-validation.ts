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
    'facilities',
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
        if (value.length > 32)
          issues.push({ key: path, message: '効果は32件以下にしてください' });
        return value.slice(0, 32).map((entry, index) => {
          const effectPath = `${path}.${index}`;
          if (!isRecord(entry)) {
            issues.push({
              key: effectPath,
              message: '効果オブジェクトが必要です',
            });
            return defaults[0];
          }
          const unlock = entry.id === 'crossing-unlock';
          const facilityUnlock = entry.id === 'facility-unlock';
          const unitUnlock = entry.id === 'unit-unlock';
          exactKeys(
            entry,
            unlock
              ? ['id', 'value', 'crossingTier']
              : facilityUnlock
                ? ['id', 'value', 'facilityKind']
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
              'facility-unlock',
              'facility-build-speed-percent',
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
          if ((unlock || unitUnlock || facilityUnlock) && entry.value !== 0)
            issues.push({
              key: `${effectPath}.value`,
              message: '解放効果の値は0にしてください',
            });
          if (
            entry.id === 'base-upgrade-max' &&
            entry.value !== 2 &&
            entry.value !== 3
          )
            issues.push({
              key: `${effectPath}.value`,
              message: '強化上限は2または3にしてください',
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
          if (
            facilityUnlock &&
            !['turret', 'antiAir', 'mine', 'watchtower', 'jammer'].includes(
              String(entry.facilityKind),
            )
          )
            issues.push({
              key: `${effectPath}.facilityKind`,
              message: '未対応の施設IDです',
            });
          return {
            ...(facilityUnlock ? { facilityKind: entry.facilityKind } : {}),
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
          'facility',
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
    if (path === 'rules.research.definitions') {
      const entries = Object.entries(value);
      if (entries.length < 1 || entries.length > 128)
        issues.push({
          key: path,
          message: '研究ノードは1〜128件にしてください',
        });
      return Object.fromEntries(
        entries.slice(0, 128).map(([id, definition]) => {
          if (!/^[a-z][a-z0-9-]{0,63}$/.test(id))
            issues.push({
              key: `${path}.${id}`,
              message:
                '研究IDは小文字英字から始まる英数字・ハイフン64文字以内にしてください',
            });
          return [
            id,
            walk(
              definition,
              DEFAULT_RULES.research.definitions['firepower-1'],
              `${path}.${id}`,
            ),
          ];
        }),
      );
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
        if (fieldPath.endsWith('.unlockResearchId')) {
          if (actual !== null && typeof actual !== 'string')
            issues.push({
              key: fieldPath,
              message: '研究IDまたはnullが必要です',
            });
          output[key] =
            actual === null || typeof actual === 'string' ? actual : expected;
        } else if (!allowedNull && typeof expected === 'number') {
          const positive =
            !(
              fieldPath.startsWith('rules.facilities.') &&
              (fieldPath.endsWith('.range') ||
                fieldPath.endsWith('.vision') ||
                fieldPath.endsWith('.jamRange'))
            ) &&
            !fieldPath.endsWith('initialResearchCenti') &&
            !fieldPath.endsWith('damageBonus') &&
            !fieldPath.includes('damageVs') &&
            !fieldPath.endsWith('windupTicks') &&
            !fieldPath.endsWith('supplyIncomeCentiPerTick') &&
            !fieldPath.endsWith('researchIncomeCentiPerTick') &&
            !fieldPath.endsWith('baseIncomeCentiPerTick') &&
            !fieldPath.endsWith('upkeepCentiPerTick') &&
            !fieldPath.endsWith('penaltyPerWeightCenti') &&
            !fieldPath.endsWith('ticketWeight') &&
            !fieldPath.endsWith('hqProtectionTicks') &&
            !fieldPath.endsWith('startTick') &&
            !fieldPath.endsWith('startCentiPerTick') &&
            !fieldPath.endsWith('unitsPerOwnedBase');
          const max = fieldPath.endsWith('.garrisonCapacity')
            ? 64
            : fieldPath === 'rules.capture.restoredHpPercent'
              ? 100
              : fieldPath.endsWith('territoryMinPercent') ||
                  fieldPath.endsWith('territoryMaxPercent') ||
                  fieldPath.endsWith('territoryPercentPerWeight') ||
                  fieldPath.endsWith('captureEfficiencyPercent')
                ? 1_000
                : fieldPath.endsWith('timeLimitTicks') ||
                    fieldPath.endsWith('hqProtectionTicks') ||
                    fieldPath.endsWith('startTick') ||
                    fieldPath.endsWith('endTick')
                  ? 100_000_000
                  : fieldPath.endsWith('moveTicksPerCell') ||
                      fieldPath.endsWith('decisionIntervalTicks') ||
                      fieldPath.endsWith('updateIntervalTicks') ||
                      fieldPath.endsWith('requiredTicks') ||
                      fieldPath.endsWith('windupTicks') ||
                      fieldPath.endsWith('intervalTicks') ||
                      fieldPath.endsWith('startCentiPerTick') ||
                      fieldPath.endsWith('endCentiPerTick')
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
              : null;
          if (
            typeof actual !== 'string' ||
            (allowed !== null && !allowed.includes(actual))
          )
            issues.push({ key: fieldPath, message: '未対応のIDです' });
          output[key] = typeof actual === 'string' ? actual : expected;
        } else output[key] = actual;
      }
    }
    return output;
  };
  const rules = walk(input, DEFAULT_RULES, 'rules') as RulesMaster;
  const checkReference = (id: string | null, path: string): void => {
    if (id !== null && !Object.hasOwn(rules.research.definitions, id))
      issues.push({ key: path, message: `存在しない研究ID: ${id}` });
  };
  for (const [kind, unit] of Object.entries(rules.units))
    checkReference(
      unit.unlockResearchId,
      `rules.units.${kind}.unlockResearchId`,
    );
  checkReference(
    rules.baseUpgrades.level2ResearchId,
    'rules.baseUpgrades.level2ResearchId',
  );
  checkReference(
    rules.baseUpgrades.level3ResearchId,
    'rules.baseUpgrades.level3ResearchId',
  );
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
      const peer = Object.hasOwn(rules.research.definitions, excluded)
        ? rules.research.definitions[excluded]
        : undefined;
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
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) {
      issues.push({
        key: `rules.research.definitions.${id}.prerequisites`,
        message: '研究前提に循環があります',
      });
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const parent of rules.research.definitions[id]?.prerequisites ?? [])
      visit(parent);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of Object.keys(rules.research.definitions)) visit(id);
  if (rules.limits.baseUnits < 2)
    issues.push({
      key: 'rules.limits.baseUnits',
      message: '基本部隊数は2以上にしてください',
    });
  if (rules.limits.maxUnits < rules.limits.baseUnits)
    issues.push({
      key: 'rules.limits.maxUnits',
      message: '最大部隊数は基本部隊数以上にしてください',
    });
  if (rules.tickets.decay.startTick > rules.tickets.decay.endTick)
    issues.push({
      key: 'rules.tickets.decay.startTick',
      message: '開始tickは終了tick以下にしてください',
    });
  if (
    rules.tickets.decay.territoryMinPercent >
    rules.tickets.decay.territoryMaxPercent
  )
    issues.push({
      key: 'rules.tickets.decay.territoryMinPercent',
      message: '最小倍率は最大倍率以下にしてください',
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
    (Object.keys(input).length !== 3 && Object.keys(input).length !== 4) ||
    Object.keys(input).some(
      (key) =>
        !['masterSchemaVersion', 'revision', 'rules', 'rulesVersion'].includes(
          key,
        ),
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
      input.masterSchemaVersion !== 10 &&
      input.masterSchemaVersion !== 11 &&
      input.masterSchemaVersion !== 12 &&
      input.masterSchemaVersion !== 13 &&
      input.masterSchemaVersion !== 14 &&
      input.masterSchemaVersion !== 15 &&
      input.masterSchemaVersion !== 16 &&
      input.masterSchemaVersion !== 17 &&
      input.masterSchemaVersion !== 18 &&
      input.masterSchemaVersion !== 19)
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
      const attackProfileDefaults =
        input.masterSchemaVersion <= 16
          ? {
              windupTicks: 0,
              intervalTicks: 1,
              canAttackWhileMoving: true,
            }
          : {};
      units[kind] = {
        ...defaults,
        ...attackProfileDefaults,
        ...preserved,
        ...fallback,
      };
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
    if (input.masterSchemaVersion === 15) {
      const oldEnabled = migrationCandidate.garrisonEnabled !== false;
      const { garrisonEnabled: _legacy, ...withoutLegacy } = migrationCandidate;
      migrationCandidate = { ...withoutLegacy };
      if (isRecord(migrationCandidate.units))
        migrationCandidate = {
          ...migrationCandidate,
          units: Object.fromEntries(
            Object.entries(migrationCandidate.units).map(([kind, value]) => [
              kind,
              {
                ...(isRecord(value) ? value : {}),
                canGarrison:
                  oldEnabled &&
                  DEFAULT_RULES.units[kind as keyof typeof DEFAULT_RULES.units]
                    ?.canGarrison === true,
              },
            ]),
          ),
        };
    }
    if (isRecord(migrationCandidate.bases))
      migrationCandidate = {
        ...migrationCandidate,
        bases: Object.fromEntries(
          Object.entries(DEFAULT_RULES.bases).map(([kind, defaults]) => [
            kind,
            {
              ...defaults,
              ...(isRecord(migrationCandidate.bases) &&
              isRecord(migrationCandidate.bases[kind])
                ? migrationCandidate.bases[kind]
                : {}),
            },
          ]),
        ),
      };
    if (isRecord(migrationCandidate.capture))
      migrationCandidate = {
        ...migrationCandidate,
        capture: {
          restoredHpPercent: DEFAULT_RULES.capture.restoredHpPercent,
          ...migrationCandidate.capture,
        },
      };
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
    if (!Object.hasOwn(migrationCandidate, 'facilities'))
      migrationCandidate = {
        ...migrationCandidate,
        facilities: DEFAULT_RULES.facilities,
      };
    if (isRecord(migrationCandidate.units))
      migrationCandidate = {
        ...migrationCandidate,
        units: Object.fromEntries(
          Object.entries(migrationCandidate.units).map(([key, value]) => [
            key,
            isRecord(value) && Array.isArray(value.attackTargets)
              ? {
                  ...value,
                  attackTargets: [
                    ...value.attackTargets,
                    ...(value.damageVsStructure &&
                    !value.attackTargets.includes('facility')
                      ? ['facility']
                      : []),
                  ],
                }
              : value,
          ]),
        ),
      };
    if (input.masterSchemaVersion <= 16) {
      if (isRecord(migrationCandidate.units)) {
        migrationCandidate = {
          ...migrationCandidate,
          units: Object.fromEntries(
            Object.entries(migrationCandidate.units).map(([key, value]) => [
              key,
              isRecord(value)
                ? {
                    ...value,
                    windupTicks:
                      typeof value.windupTicks === 'number'
                        ? value.windupTicks
                        : 0,
                    intervalTicks:
                      typeof value.intervalTicks === 'number'
                        ? value.intervalTicks
                        : 1,
                    canAttackWhileMoving:
                      typeof value.canAttackWhileMoving === 'boolean'
                        ? value.canAttackWhileMoving
                        : true,
                  }
                : value,
            ]),
          ),
        };
      }
      if (isRecord(migrationCandidate.defenses)) {
        migrationCandidate = {
          ...migrationCandidate,
          defenses: Object.fromEntries(
            Object.entries(migrationCandidate.defenses).map(([key, value]) => [
              key,
              isRecord(value)
                ? {
                    ...value,
                    windupTicks:
                      typeof value.windupTicks === 'number'
                        ? value.windupTicks
                        : 0,
                    intervalTicks:
                      typeof value.intervalTicks === 'number'
                        ? value.intervalTicks
                        : 1,
                    canAttackWhileMoving:
                      typeof value.canAttackWhileMoving === 'boolean'
                        ? value.canAttackWhileMoving
                        : true,
                  }
                : value,
            ]),
          ),
        };
      }
      if (
        isRecord(migrationCandidate.baseUpgrades) &&
        isRecord(migrationCandidate.baseUpgrades.kinds)
      ) {
        migrationCandidate = {
          ...migrationCandidate,
          baseUpgrades: {
            ...migrationCandidate.baseUpgrades,
            kinds: Object.fromEntries(
              Object.entries(migrationCandidate.baseUpgrades.kinds).map(
                ([baseKind, tiers]) => [
                  baseKind,
                  isRecord(tiers)
                    ? Object.fromEntries(
                        Object.entries(tiers).map(([tierKey, tierVal]) => [
                          tierKey,
                          isRecord(tierVal)
                            ? {
                                ...tierVal,
                                windupTicks:
                                  typeof tierVal.windupTicks === 'number'
                                    ? tierVal.windupTicks
                                    : 0,
                                intervalTicks:
                                  typeof tierVal.intervalTicks === 'number'
                                    ? tierVal.intervalTicks
                                    : typeof tierVal.turretIntervalTicks ===
                                        'number'
                                      ? tierVal.turretIntervalTicks
                                      : 10,
                                canAttackWhileMoving:
                                  typeof tierVal.canAttackWhileMoving ===
                                  'boolean'
                                    ? tierVal.canAttackWhileMoving
                                    : true,
                              }
                            : tierVal,
                        ]),
                      )
                    : tiers,
                ],
              ),
            ),
          },
        };
      }
      if (
        isRecord(migrationCandidate.facilities) &&
        isRecord(migrationCandidate.facilities.definitions)
      ) {
        migrationCandidate = {
          ...migrationCandidate,
          facilities: {
            ...migrationCandidate.facilities,
            definitions: Object.fromEntries(
              Object.entries(migrationCandidate.facilities.definitions).map(
                ([facKind, defVal]) => [
                  facKind,
                  isRecord(defVal)
                    ? {
                        ...defVal,
                        windupTicks:
                          typeof defVal.windupTicks === 'number'
                            ? defVal.windupTicks
                            : 0,
                        intervalTicks:
                          typeof defVal.intervalTicks === 'number'
                            ? defVal.intervalTicks
                            : typeof defVal.attackIntervalTicks === 'number'
                              ? defVal.attackIntervalTicks
                              : 10,
                        canAttackWhileMoving:
                          typeof defVal.canAttackWhileMoving === 'boolean'
                            ? defVal.canAttackWhileMoving
                            : true,
                      }
                    : defVal,
                ],
              ),
            ),
          },
        };
      }
    }
    if (input.masterSchemaVersion <= 17) {
      if (isRecord(migrationCandidate.match)) {
        migrationCandidate = {
          ...migrationCandidate,
          match: {
            ...migrationCandidate.match,
            hqProtectionTicks:
              typeof migrationCandidate.match.hqProtectionTicks === 'number'
                ? migrationCandidate.match.hqProtectionTicks
                : 1200,
          },
        };
      }
    }
    if (input.masterSchemaVersion <= 18) {
      if (isRecord(migrationCandidate.match)) {
        const { hqLossTicketsCenti: _discardHqLoss, ...cleanMatch } =
          migrationCandidate.match as Record<string, unknown>;
        migrationCandidate = {
          ...migrationCandidate,
          match: {
            ...cleanMatch,
            hqProtectionTicks:
              typeof cleanMatch.hqProtectionTicks === 'number'
                ? cleanMatch.hqProtectionTicks
                : 1200,
          },
        };
      }
      if (isRecord(migrationCandidate.limits)) {
        const { unitsPerFaction: _discardUnitsPerFaction, ...cleanLimits } =
          migrationCandidate.limits as Record<string, unknown>;
        migrationCandidate = {
          ...migrationCandidate,
          limits: {
            ...cleanLimits,
            baseUnits:
              typeof cleanLimits.baseUnits === 'number'
                ? cleanLimits.baseUnits
                : 3,
            unitsPerOwnedBase:
              typeof cleanLimits.unitsPerOwnedBase === 'number'
                ? cleanLimits.unitsPerOwnedBase
                : 1,
            maxUnits:
              typeof cleanLimits.maxUnits === 'number'
                ? cleanLimits.maxUnits
                : 9,
            productionQueue:
              typeof cleanLimits.productionQueue === 'number'
                ? cleanLimits.productionQueue
                : 3,
          },
        };
      }
      if (isRecord(migrationCandidate.tickets)) {
        migrationCandidate = {
          ...migrationCandidate,
          tickets: {
            ...migrationCandidate.tickets,
            decay: isRecord(migrationCandidate.tickets.decay)
              ? migrationCandidate.tickets.decay
              : DEFAULT_RULES.tickets.decay,
          },
        };
      }
      if (isRecord(migrationCandidate.units)) {
        const oldUpkeepDefaults: Record<string, number> = {
          assault: 5,
          scout: 3,
          artillery: 6,
          antiAir: 5,
          helicopter: 7,
          patrolBoat: 6,
        };
        migrationCandidate = {
          ...migrationCandidate,
          units: Object.fromEntries(
            Object.entries(migrationCandidate.units).map(([kind, unitVal]) => [
              kind,
              isRecord(unitVal)
                ? {
                    ...unitVal,
                    upkeepCentiPerTick:
                      typeof unitVal.upkeepCentiPerTick === 'number' &&
                      unitVal.upkeepCentiPerTick !== oldUpkeepDefaults[kind]
                        ? unitVal.upkeepCentiPerTick
                        : (DEFAULT_RULES.units[
                            kind as keyof typeof DEFAULT_RULES.units
                          ]?.upkeepCentiPerTick ?? 10),
                  }
                : unitVal,
            ]),
          ),
        };
      }
    }
    if (input.masterSchemaVersion <= 19) {
      if (isRecord(migrationCandidate.localFaction)) {
        migrationCandidate = {
          ...migrationCandidate,
          localFaction: {
            ...migrationCandidate.localFaction,
            enabled:
              typeof migrationCandidate.localFaction.enabled === 'boolean'
                ? migrationCandidate.localFaction.enabled
                : DEFAULT_RULES.localFaction.enabled,
          },
        };
      }
      if (isRecord(migrationCandidate.units)) {
        const oldMoveDefaults: Record<string, number> = {
          assault: 2,
          scout: 2,
          artillery: 3,
          antiAir: 2,
          helicopter: 1,
          patrolBoat: 2,
        };
        const oldBuildDefaults: Record<string, number> = {
          assault: 120,
          scout: 60,
          artillery: 100,
          antiAir: 90,
          helicopter: 140,
          patrolBoat: 120,
        };
        migrationCandidate = {
          ...migrationCandidate,
          units: Object.fromEntries(
            Object.entries(migrationCandidate.units).map(([kind, unitVal]) => [
              kind,
              isRecord(unitVal)
                ? {
                    ...unitVal,
                    moveTicksPerCell:
                      typeof unitVal.moveTicksPerCell === 'number' &&
                      unitVal.moveTicksPerCell !== oldMoveDefaults[kind]
                        ? unitVal.moveTicksPerCell
                        : (DEFAULT_RULES.units[
                            kind as keyof typeof DEFAULT_RULES.units
                          ]?.moveTicksPerCell ?? 4),
                    buildTicks:
                      typeof unitVal.buildTicks === 'number' &&
                      unitVal.buildTicks !== oldBuildDefaults[kind]
                        ? unitVal.buildTicks
                        : (DEFAULT_RULES.units[
                            kind as keyof typeof DEFAULT_RULES.units
                          ]?.buildTicks ?? 200),
                  }
                : unitVal,
            ]),
          ),
        };
      }
    }
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
    if (
      (input.masterSchemaVersion === 11 || input.masterSchemaVersion === 12) &&
      oldDefinitions === null
    )
      return {
        ok: false,
        issues: [
          {
            key: 'rules.research.definitions',
            message: '研究定義オブジェクトが必要です',
          },
        ],
      };
    const converted = { ...DEFAULT_RULES.research.definitions } as Record<
      string,
      ResearchDefinition
    >;
    if (oldDefinitions && input.masterSchemaVersion <= 6) {
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
    } else if (
      oldDefinitions &&
      input.masterSchemaVersion >= 11 &&
      input.masterSchemaVersion <= 19
    ) {
      for (const id of Object.keys(converted)) delete converted[id];
      for (const [id, oldValue] of Object.entries(oldDefinitions))
        Object.defineProperty(converted, id, {
          value: oldValue,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      // F21 preserves arbitrary existing nodes and deliberate removals. Only
      // newly introduced F11 facility definitions are supplemented for both versions.
      for (const [id, definition] of Object.entries(
        DEFAULT_RULES.research.definitions,
      ))
        if (id.startsWith('facility-') && !Object.hasOwn(converted, id))
          converted[id] = definition;
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
          ...(typeof input.rulesVersion === 'string'
            ? { rulesVersion: input.rulesVersion }
            : {}),
        },
      }
    : result;
}

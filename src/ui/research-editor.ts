import type { RulesMaster } from '../simulation/rules';
import type { ResearchDefinition } from '../simulation/config';
import type { ResearchEffect, ResearchEffectId } from '../simulation/types';

export type ResearchDraftUpdate = (current: RulesMaster) => RulesMaster;
type Change = (update: ResearchDraftUpdate, structural: boolean) => void;

const EFFECTS: readonly [ResearchEffectId, string][] = [
  ['damage-bonus', '部隊攻撃加算'],
  ['vision-bonus', '視界加算'],
  ['supply-income-bonus', '補給収入加算'],
  ['upkeep-reduction', '維持費減額'],
  ['crossing-unlock', '渡河解放'],
  ['unit-unlock', '兵種解放'],
  ['base-upgrade-max', '拠点強化上限'],
];

export function newResearchProblem(
  rules: RulesMaster,
  id: string,
): string | null {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(id))
    return 'IDは英小文字で始まる1〜64文字の英小文字・数字・ハイフンにしてください。';
  if (Object.hasOwn(rules.research.definitions, id))
    return `ID「${id}」は既にあります。`;
  if (Object.keys(rules.research.definitions).length >= 128)
    return '研究は128件までです。';
  return null;
}

export function editResearchNode(
  rules: RulesMaster,
  id: string,
  update: (node: ResearchDefinition) => ResearchDefinition,
): RulesMaster {
  const node = rules.research.definitions[id];
  if (!node) return rules;
  return {
    ...rules,
    research: {
      ...rules.research,
      definitions: { ...rules.research.definitions, [id]: update(node) },
    },
  };
}

function button(text: string, action: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = text;
  element.addEventListener('click', action);
  return element;
}

function field(
  host: HTMLElement,
  text: string,
  path: string,
  control: HTMLElement,
): void {
  const label = document.createElement('label');
  label.className = 'master-field';
  const title = document.createElement('strong');
  title.textContent = text;
  control.dataset.researchPath = path;
  const error = document.createElement('small');
  error.className = 'master-field-error';
  label.append(title, control, error);
  host.append(label);
}

function select(
  choices: readonly (readonly [string, string])[],
  value: string,
  onChange: (value: string) => void,
): HTMLSelectElement {
  const element = document.createElement('select');
  const all = choices.some(([id]) => id === value)
    ? choices
    : [...choices, [value, `${value}（参照先なし）`] as const];
  for (const [id, label] of all) element.add(new Option(label, id));
  element.value = value;
  element.addEventListener('change', () => onChange(element.value));
  return element;
}

function number(
  value: number,
  onInput: (value: number) => void,
): HTMLInputElement {
  const element = document.createElement('input');
  element.type = 'number';
  element.step = '1';
  element.inputMode = 'numeric';
  element.value = String(value);
  element.addEventListener('input', () =>
    onInput(element.value === '' ? Number.NaN : Number(element.value)),
  );
  return element;
}

/** Edits a private draft; the parent owns validation and persistence. */
export function renderResearchEditor(
  host: HTMLElement,
  rules: RulesMaster,
  onChange: Change,
): void {
  host.replaceChildren();
  host.className = 'master-group research-editor';
  const heading = document.createElement('h2');
  heading.textContent = '研究ノード';
  const help = document.createElement('p');
  help.textContent =
    '研究は1〜128件。削除は参照を自動変更しません。前提・排他・兵種/拠点の参照を修正してから保存してください。排他は両側に設定します。';
  const add = document.createElement('div');
  add.className = 'research-actions';
  const idInput = document.createElement('input');
  idInput.placeholder = '新規研究ID（例: field-logistics）';
  idInput.setAttribute('aria-label', '新規研究ID');
  idInput.dataset.researchNewId = '';
  idInput.maxLength = 64;
  const notice = document.createElement('p');
  notice.setAttribute('role', 'alert');
  const addButton = button('研究を追加', () => {
    const id = idInput.value;
    const problem = newResearchProblem(rules, id);
    if (problem) {
      notice.textContent = problem;
      return;
    }
    onChange((current) => {
      if (newResearchProblem(current, id)) return current;
      return {
        ...current,
        research: {
          ...current.research,
          definitions: {
            ...current.research.definitions,
            [id]: {
              domain: 'power',
              stage: 1,
              costCenti: 5000,
              prerequisites: [],
              exclusiveWith: [],
              effects: [{ id: 'damage-bonus', value: 1 }],
            },
          },
        },
      };
    }, true);
  });
  addButton.dataset.researchAdd = '';
  addButton.disabled = Object.keys(rules.research.definitions).length >= 128;
  add.append(idInput, addButton);
  host.append(heading, help, add, notice);
  const ids = Object.keys(rules.research.definitions);
  for (const [id, node] of Object.entries(rules.research.definitions)) {
    const card = document.createElement('details');
    card.className = 'research-node';
    card.dataset.researchNode = id;
    const title = document.createElement('summary');
    title.textContent = id;
    card.append(title);
    const body = document.createElement('div');
    body.className = 'research-node-fields';
    const path = `research.definitions.${id}`;
    const change = (
      update: (current: ResearchDefinition) => ResearchDefinition,
      structural = false,
    ): void =>
      onChange((current) => editResearchNode(current, id, update), structural);
    field(
      body,
      '分野',
      `${path}.domain`,
      select(
        [
          ['power', '戦力'],
          ['logistics', '兵站'],
          ['information', '情報'],
          ['engineering', '工学'],
        ],
        node.domain,
        (domain) =>
          change((current) => ({
            ...current,
            domain: domain as ResearchDefinition['domain'],
          })),
      ),
    );
    field(
      body,
      '段階',
      `${path}.stage`,
      number(node.stage, (stage) =>
        change((current) => ({ ...current, stage })),
      ),
    );
    field(
      body,
      '必要研究量（pt ×100）',
      `${path}.costCenti`,
      number(node.costCenti, (costCenti) =>
        change((current) => ({ ...current, costCenti })),
      ),
    );
    for (const [key, label] of [
      ['prerequisites', '前提研究（複数選択）'],
      ['exclusiveWith', '排他研究（両側で設定）'],
    ] as const) {
      const choices = select(
        [
          ...new Set([...ids.filter((other) => other !== id), ...node[key]]),
        ].map(
          (other) =>
            [
              other,
              ids.includes(other) ? other : `${other}（参照先なし）`,
            ] as const,
        ),
        '',
        () => {},
      );
      // The multi-select carries exactly the selected IDs, including dangling references.
      for (const option of [...choices.options])
        if (option.value === '') option.remove();
      choices.multiple = true;
      choices.size = Math.min(5, Math.max(2, choices.options.length));
      for (const option of [...choices.options])
        option.selected = node[key].includes(option.value);
      choices.addEventListener('change', () =>
        change((current) => ({
          ...current,
          [key]: [...choices.selectedOptions].map((option) => option.value),
        })),
      );
      field(body, label, `${path}.${key}`, choices);
    }
    const effectHost = document.createElement('div');
    effectHost.className = 'research-effects';
    for (const [index, effect] of node.effects.entries()) {
      const row = document.createElement('div');
      row.className = 'research-effect';
      const updateEffect = (
        update: (current: ResearchEffect) => ResearchEffect,
        structural = false,
      ): void =>
        change(
          (current) => ({
            ...current,
            effects: current.effects.map((entry, i) =>
              i === index ? update(entry) : entry,
            ),
          }),
          structural,
        );
      field(
        row,
        `効果 ${index + 1}`,
        `${path}.effects.${index}.id`,
        select(EFFECTS, effect.id, (value) =>
          updateEffect(
            () =>
              value === 'crossing-unlock'
                ? { id: value, value: 0, crossingTier: 'bridge-2' }
                : value === 'unit-unlock'
                  ? { id: value, value: 0, unitKind: 'artillery' }
                  : {
                      id: value as ResearchEffectId,
                      value: value === 'base-upgrade-max' ? 2 : 1,
                    },
            true,
          ),
        ),
      );
      if (effect.id === 'crossing-unlock')
        field(
          row,
          '対象渡河設備',
          `${path}.effects.${index}.crossingTier`,
          select(
            Object.keys(rules.crossings)
              .filter((key) => key !== 'bridge-1')
              .map((key) => [key, key]),
            effect.crossingTier ?? '',
            (value) =>
              updateEffect((current) => ({
                ...current,
                crossingTier: value as NonNullable<
                  ResearchEffect['crossingTier']
                >,
              })),
          ),
        );
      else if (effect.id === 'unit-unlock')
        field(
          row,
          '対象兵種',
          `${path}.effects.${index}.unitKind`,
          select(
            Object.keys(rules.units)
              .filter((key) => key !== 'assault' && key !== 'scout')
              .map((key) => [key, key]),
            effect.unitKind ?? '',
            (value) =>
              updateEffect((current) => ({
                ...current,
                unitKind: value as NonNullable<ResearchEffect['unitKind']>,
              })),
          ),
        );
      else
        field(
          row,
          '効果値',
          `${path}.effects.${index}.value`,
          number(effect.value, (value) =>
            updateEffect((current) => ({ ...current, value })),
          ),
        );
      row.append(
        button('効果を削除', () =>
          change(
            (current) => ({
              ...current,
              effects: current.effects.filter((_, i) => i !== index),
            }),
            true,
          ),
        ),
      );
      effectHost.append(row);
    }
    body.append(
      effectHost,
      button('効果を追加', () =>
        change(
          (current) => ({
            ...current,
            effects: [...current.effects, { id: 'damage-bonus', value: 1 }],
          }),
          true,
        ),
      ),
    );
    const remove = button('この研究を削除', () =>
      onChange((current) => {
        if (Object.keys(current.research.definitions).length <= 1)
          return current;
        return {
          ...current,
          research: {
            ...current.research,
            definitions: Object.fromEntries(
              Object.entries(current.research.definitions).filter(
                ([key]) => key !== id,
              ),
            ),
          },
        };
      }, true),
    );
    remove.disabled = ids.length <= 1;
    remove.dataset.researchDelete = id;
    body.append(remove);
    card.append(body);
    host.append(card);
  }
  const external = document.createElement('details');
  external.className = 'research-node';
  const summary = document.createElement('summary');
  summary.textContent = '研究要否・旧互換参照（解放は効果で判定）';
  external.append(summary);
  const referenceHelp = document.createElement('p');
  referenceHelp.textContent =
    '兵種は「研究不要」なら即解放、それ以外は対応する兵種解放効果を持つ研究のいずれかを完了すると解放します。指定IDだけでは解放しません。拠点Lvの旧互換参照も解放条件ではなく、完了した拠点強化上限効果で判定します。参照先を削除する場合はここも更新してください。';
  external.append(referenceHelp);
  const options = ids.map((id) => [id, id] as const);
  for (const [kind, unit] of Object.entries(rules.units))
    field(
      external,
      `${kind} の研究要否・互換参照`,
      `units.${kind}.unlockResearchId`,
      select(
        [['', '研究不要'], ...options],
        unit.unlockResearchId ?? '',
        (value) =>
          onChange(
            (current) => ({
              ...current,
              units: {
                ...current.units,
                [kind]: {
                  ...current.units[kind as keyof typeof current.units],
                  unlockResearchId: value || null,
                },
              },
            }),
            false,
          ),
      ),
    );
  for (const key of ['level2ResearchId', 'level3ResearchId'] as const)
    field(
      external,
      key === 'level2ResearchId' ? 'Lv2の旧互換参照' : 'Lv3の旧互換参照',
      `baseUpgrades.${key}`,
      select(options, rules.baseUpgrades[key], (value) =>
        onChange(
          (current) => ({
            ...current,
            baseUpgrades: { ...current.baseUpgrades, [key]: value },
          }),
          false,
        ),
      ),
    );
  host.append(external);
}

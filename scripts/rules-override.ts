import { readFileSync } from 'node:fs';
import { DEFAULT_RULES, type RulesMaster } from '../src/simulation/rules';
import { validateRules } from '../src/simulation/rules-validation';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function merge(base: unknown, patch: unknown): unknown {
  if (!isRecord(base) || !isRecord(patch)) return patch;
  const output: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch))
    output[key] = merge(base[key], value);
  return output;
}

/**
 * Reads a partial master (only the changed fields) from --rules=path and
 * returns the validated full rules, so tuning needs no code change.
 */
export function rulesFromArgs(
  args: readonly string[],
): RulesMaster | undefined {
  const path = args
    .find((argument) => argument.startsWith('--rules='))
    ?.slice('--rules='.length);
  if (!path) return undefined;
  const patch: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const result = validateRules(merge(DEFAULT_RULES, patch));
  if (!result.ok)
    throw new Error(
      `invalid --rules ${path}: ${result.issues.map(({ key, message }) => `${key} ${message}`).join('; ')}`,
    );
  return result.rules;
}

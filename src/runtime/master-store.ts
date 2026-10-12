import {
  cloneRules,
  DEFAULT_RULES,
  MASTER_SCHEMA_VERSION,
} from '../simulation/rules';
import type { MasterEnvelope } from '../simulation/rules';
import {
  validateEnvelope,
  validateRules,
} from '../simulation/rules-validation';
import type { ValidationIssue } from '../simulation/rules-validation';

export const MASTER_STORAGE_KEY = 'rts-match-prototype.master.v1';

/** The subset of the browser Storage API used by the master store. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type MasterStoreErrorCode =
  | 'STORAGE_UNAVAILABLE'
  | 'READ_FAILED'
  | 'WRITE_FAILED'
  | 'REMOVE_FAILED'
  | 'INVALID_JSON'
  | 'INVALID_MASTER';

export interface MasterStoreError {
  readonly code: MasterStoreErrorCode;
  readonly message: string;
  readonly issues?: readonly ValidationIssue[];
}

export type LoadMasterResult =
  | {
      readonly ok: true;
      readonly envelope: MasterEnvelope;
      readonly source: 'storage' | 'default';
    }
  | {
      readonly ok: false;
      /** Safe defaults are available even when stored data cannot be read. */
      readonly envelope: MasterEnvelope;
      readonly error: MasterStoreError;
    };

export type SaveMasterResult =
  | { readonly ok: true; readonly envelope: MasterEnvelope }
  | { readonly ok: false; readonly error: MasterStoreError };

export type ParseMasterResult =
  | { readonly ok: true; readonly envelope: MasterEnvelope }
  | { readonly ok: false; readonly error: MasterStoreError };

export type ExportMasterResult =
  | { readonly ok: true; readonly json: string }
  | { readonly ok: false; readonly error: MasterStoreError };

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function defaultEnvelope(): MasterEnvelope {
  return {
    masterSchemaVersion: MASTER_SCHEMA_VERSION,
    revision: 0,
    rules: cloneRules(DEFAULT_RULES),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Strictly parses JSON and validates both the envelope and every rule field. */
export function parseMasterJson(json: string): ParseMasterResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'INVALID_JSON',
        message: `JSONを読み込めません: ${errorMessage(error)}`,
      },
    };
  }

  if (
    !isRecord(parsed) ||
    Object.keys(parsed).length !== 3 ||
    !Object.hasOwn(parsed, 'masterSchemaVersion') ||
    !Object.hasOwn(parsed, 'revision') ||
    !Object.hasOwn(parsed, 'rules')
  )
    return {
      ok: false,
      error: {
        code: 'INVALID_MASTER',
        message: 'マスタ形式が正しくありません。',
      },
    };

  const result = validateEnvelope(parsed);
  if (!result.ok)
    return {
      ok: false,
      error: {
        code: 'INVALID_MASTER',
        message: 'マスタの検証に失敗しました。',
        issues: result.issues,
      },
    };
  return { ok: true, envelope: result.envelope };
}

/** Validates an envelope before producing a portable JSON representation. */
export function stringifyMasterJson(input: unknown): ExportMasterResult {
  const parsed =
    typeof input === 'string'
      ? parseMasterJson(input)
      : validateEnvelopeStrict(input);
  if (!parsed.ok) return parsed;
  try {
    return {
      ok: true,
      json: `${JSON.stringify(parsed.envelope, null, 2)}\n`,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: 'INVALID_MASTER',
        message: `マスタを書き出せません: ${errorMessage(error)}`,
      },
    };
  }
}

function validateEnvelopeStrict(input: unknown): ParseMasterResult {
  if (
    !isRecord(input) ||
    Object.keys(input).length !== 3 ||
    !Object.hasOwn(input, 'masterSchemaVersion') ||
    !Object.hasOwn(input, 'revision') ||
    !Object.hasOwn(input, 'rules')
  )
    return {
      ok: false,
      error: {
        code: 'INVALID_MASTER',
        message: 'マスタ形式が正しくありません。',
      },
    };
  const result = validateEnvelope(input);
  return result.ok
    ? { ok: true, envelope: result.envelope }
    : {
        ok: false,
        error: {
          code: 'INVALID_MASTER',
          message: 'マスタの検証に失敗しました。',
          issues: result.issues,
        },
      };
}

/**
 * Browser-backed master persistence. Pass a StorageLike to use another
 * storage implementation (for example, an in-memory adapter in tests).
 */
export class MasterStore {
  constructor(
    private readonly storage?: StorageLike,
    private readonly key = MASTER_STORAGE_KEY,
  ) {}

  load(): LoadMasterResult {
    const storage = this.getStorage();
    if (storage === null)
      return {
        ok: false,
        envelope: defaultEnvelope(),
        error: {
          code: 'STORAGE_UNAVAILABLE',
          message: 'ブラウザの保存領域を利用できません。',
        },
      };

    let raw: string | null;
    try {
      raw = storage.getItem(this.key);
    } catch (error) {
      return {
        ok: false,
        envelope: defaultEnvelope(),
        error: {
          code: 'READ_FAILED',
          message: `保存済みマスタを読み込めません: ${errorMessage(error)}`,
        },
      };
    }
    if (raw === null)
      return { ok: true, envelope: defaultEnvelope(), source: 'default' };

    const parsed = parseMasterJson(raw);
    return parsed.ok
      ? { ok: true, envelope: parsed.envelope, source: 'storage' }
      : { ok: false, envelope: defaultEnvelope(), error: parsed.error };
  }

  /** Saves a complete, strictly validated envelope. Failed writes roll back. */
  save(input: unknown): SaveMasterResult {
    const parsed = validateEnvelopeStrict(input);
    if (!parsed.ok) return parsed;
    return this.write(parsed.envelope);
  }

  /** Saves validated rules as the next revision, retaining no caller references. */
  saveRules(input: unknown): SaveMasterResult {
    const validated = validateRules(input);
    if (!validated.ok)
      return {
        ok: false,
        error: {
          code: 'INVALID_MASTER',
          message: 'マスタの検証に失敗しました。',
          issues: validated.issues,
        },
      };
    const loaded = this.load();
    const revision = loaded.ok ? loaded.envelope.revision + 1 : 1;
    if (!Number.isSafeInteger(revision))
      return {
        ok: false,
        error: {
          code: 'INVALID_MASTER',
          message: 'マスタのrevisionが上限に達しました。',
        },
      };
    return this.write({
      masterSchemaVersion: MASTER_SCHEMA_VERSION,
      revision,
      rules: validated.rules,
    });
  }

  /** Invalid imports never reach storage; write failures restore the old value. */
  importJson(json: string): SaveMasterResult {
    const parsed = parseMasterJson(json);
    if (!parsed.ok) return parsed;
    return this.write(parsed.envelope);
  }

  exportJson(input?: unknown): ExportMasterResult {
    if (input !== undefined) return stringifyMasterJson(input);
    const loaded = this.load();
    return loaded.ok
      ? stringifyMasterJson(loaded.envelope)
      : { ok: false, error: loaded.error };
  }

  /** Restores defaults in storage while incrementing the visible revision. */
  reset(): SaveMasterResult {
    const loaded = this.load();
    const revision = loaded.ok ? loaded.envelope.revision + 1 : 0;
    if (!Number.isSafeInteger(revision))
      return {
        ok: false,
        error: {
          code: 'INVALID_MASTER',
          message: 'マスタのrevisionが上限に達しました。',
        },
      };
    return this.write({
      masterSchemaVersion: MASTER_SCHEMA_VERSION,
      revision,
      rules: cloneRules(DEFAULT_RULES),
    });
  }

  /** Removes the persisted value. A failed removal attempts to restore it. */
  clear(): SaveMasterResult {
    const storage = this.getStorage();
    if (storage === null)
      return {
        ok: false,
        error: {
          code: 'STORAGE_UNAVAILABLE',
          message: 'ブラウザの保存領域を利用できません。',
        },
      };
    let previous: string | null;
    try {
      previous = storage.getItem(this.key);
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'READ_FAILED',
          message: `保存済みマスタを読み込めません: ${errorMessage(error)}`,
        },
      };
    }
    try {
      storage.removeItem(this.key);
      return { ok: true, envelope: defaultEnvelope() };
    } catch (error) {
      this.restore(storage, previous);
      return {
        ok: false,
        error: {
          code: 'REMOVE_FAILED',
          message: `保存済みマスタを削除できません: ${errorMessage(error)}`,
        },
      };
    }
  }

  private write(envelope: MasterEnvelope): SaveMasterResult {
    const storage = this.getStorage();
    if (storage === null)
      return {
        ok: false,
        error: {
          code: 'STORAGE_UNAVAILABLE',
          message: 'ブラウザの保存領域を利用できません。',
        },
      };

    let previous: string | null;
    try {
      previous = storage.getItem(this.key);
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'READ_FAILED',
          message: `保存済みマスタを読み込めません: ${errorMessage(error)}`,
        },
      };
    }
    let serialized: string;
    try {
      serialized = JSON.stringify(envelope);
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'INVALID_MASTER',
          message: `マスタを保存形式に変換できません: ${errorMessage(error)}`,
        },
      };
    }
    try {
      storage.setItem(this.key, serialized);
      return { ok: true, envelope };
    } catch (error) {
      const restored = this.restore(storage, previous);
      return {
        ok: false,
        error: {
          code: 'WRITE_FAILED',
          message: restored
            ? `マスタを保存できません: ${errorMessage(error)}`
            : `マスタを保存できず、以前の値も復元できませんでした: ${errorMessage(error)}`,
        },
      };
    }
  }

  private restore(storage: StorageLike, previous: string | null): boolean {
    try {
      if (previous === null) storage.removeItem(this.key);
      else storage.setItem(this.key, previous);
      return true;
    } catch {
      return false;
    }
  }

  private getStorage(): StorageLike | null {
    if (this.storage !== undefined) return this.storage;
    try {
      return globalThis.localStorage;
    } catch {
      return null;
    }
  }
}

export function createMasterStore(
  storage?: StorageLike,
  key?: string,
): MasterStore {
  return new MasterStore(storage, key);
}

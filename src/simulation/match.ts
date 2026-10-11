/** Plain, serializable state. Browser and renderer dependencies belong elsewhere. */
export type FactionId = 'A' | 'B' | 'C';

export interface Faction {
  readonly id: FactionId;
  readonly controller: 'human' | 'bot';
}

export interface MatchState {
  readonly schemaVersion: 1;
  readonly seed: number;
  readonly elapsedTicks: number;
  readonly factions: readonly Faction[];
}

/** Initial contract only; movement, combat, AI and victory rules are not implemented. */
export function createMatch(seed: number): MatchState {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('seed must be an unsigned 32-bit integer');
  }

  return {
    schemaVersion: 1,
    seed,
    elapsedTicks: 0,
    factions: [
      { id: 'A', controller: 'human' },
      { id: 'B', controller: 'bot' },
      { id: 'C', controller: 'bot' },
    ],
  };
}

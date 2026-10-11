/** Deterministic uint32 LCG used by simulation map generation. */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
      throw new RangeError('seed must be an unsigned 32-bit integer');
    }
    this.state = seed >>> 0;
  }

  nextUint32(): number {
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state;
  }
}

export function createRandom(seed: number): SeededRandom {
  return new SeededRandom(seed);
}

import type { Renderer, View } from '../render/renderer';
import type { Game, Side } from '../sim/types';

export interface App {
  g: Game;
  view: View;
  renderer: Renderer;
  human: Side | null; // null = AI同士の観戦
  speed: number;
  paused: boolean;
  toast(msg: string, kind?: 'err' | 'info'): void;
  restart(): void;
  toTitle(): void;
  // AI対戦専用版（watch）だけが持つ：試合情報と次の試合
  watch?: { info(): string; next(): void };
}

import type { Renderer, View } from '../render/renderer';
import type { Game, Side } from '../sim/types';

export interface App {
  g: Game;
  view: View;
  renderer: Renderer;
  human: Side | null; // null = タイトル画面の裏で流れるAI同士の中継
  speed: number;
  paused: boolean;
  toast(msg: string, kind?: 'err' | 'info'): void;
  restart(): void;
  toTitle(): void;
}

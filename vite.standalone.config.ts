import { defineConfig } from 'vite';
import { inlineIntoHtml } from './build/inline-html';

// スタンドアロン版：静的ファイルだけで動く。dist-standalone/index.html がゲーム本体（強盗・支店長・観戦）、
// dist-standalone/watch/index.html が AI 対 AI の中継だけを流すページ。どちらも JS・CSS を埋め込んだ1ファイル。
// 使い方: vite build --config vite.standalone.config.ts --mode game ／ --mode watch
const common = { modulePreload: false, cssCodeSplit: false } as const;

export default defineConfig(({ mode }) =>
  mode === 'watch'
    ? { root: 'watch', base: './', plugins: [inlineIntoHtml()], build: { ...common, outDir: '../dist-standalone/watch', emptyOutDir: true } }
    : { root: '.', base: './', plugins: [inlineIntoHtml()], build: { ...common, outDir: 'dist-standalone', emptyOutDir: true } },
);

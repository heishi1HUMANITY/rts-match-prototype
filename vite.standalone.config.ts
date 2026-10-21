import { defineConfig } from 'vite';
import { inlineIntoHtml } from './build/inline-html';

// スタンドアロン版：静的ファイルだけで動く。dist-standalone/index.html に JS・CSS を埋め込んだ1ファイルを出す
export default defineConfig({
  base: './',
  plugins: [inlineIntoHtml()],
  build: { outDir: 'dist-standalone', emptyOutDir: true, modulePreload: false, cssCodeSplit: false },
});

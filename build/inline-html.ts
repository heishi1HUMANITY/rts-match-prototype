import type { Plugin } from 'vite';

// ビルドした JS と CSS を index.html に埋め込み、1ファイルで動くようにする（静的配信・直接開く用）
export function inlineIntoHtml(): Plugin {
  return {
    name: 'inline-into-html',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      const html = Object.values(bundle).find((a) => a.type === 'asset' && a.fileName.endsWith('.html'));
      if (!html || html.type !== 'asset') return;
      let src = String(html.source);
      for (const [name, item] of Object.entries(bundle)) {
        if (item.type === 'chunk' && item.isEntry) {
          const code = item.code.replace(/<\/script/gi, '<\\/script');
          src = src.replace(/<script type="module"[^>]*src="[^"]*"[^>]*><\/script>/, () => `<script type="module">${code}</script>`);
          delete bundle[name];
        } else if (item.type === 'asset' && name.endsWith('.css')) {
          const css = String(item.source);
          src = src.replace(/<link rel="stylesheet"[^>]*href="\.?\/?assets\/[^"]*"[^>]*>/, () => `<style>${css}</style>`);
          delete bundle[name];
        }
      }
      html.source = src;
    },
  };
}

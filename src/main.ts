import { createMatch } from './simulation/match';
import './ui/styles.css';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing application root');

const match = createMatch(42);
app.innerHTML = `
  <section class="panel" aria-labelledby="title">
    <p class="eyebrow">RTS MATCH PROTOTYPE · DEVELOPMENT</p>
    <h1 id="title">対戦本編の開発基盤</h1>
    <p>ブラウザで遊ぶ、プレイヤー1人＋NPC2人の 1v1v1。</p>
    <ul class="factions" aria-label="陣営構成">
      ${match.factions
        .map(
          (faction) => `
        <li class="faction faction-${faction.id.toLowerCase()}">
          <span aria-hidden="true">${{ A: '◆', B: '■', C: '⬡' }[faction.id]}</span>
          陣営${faction.id} · ${faction.controller === 'human' ? 'プレイヤー' : 'NPC'}
        </li>
      `,
        )
        .join('')}
    </ul>
    <p class="status">基盤の起動を確認できます。対戦機能はこれから実装します。</p>
    <p>次の開発：盤面と移動 → 生産・制圧・戦闘 → NPC → 勝敗・再戦。</p>
  </section>
`;

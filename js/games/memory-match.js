/* ============================================================
 * 游戏模块：翻牌配对
 * 玩法：一排盖着的卡片，点开两张，一样的就留下，不一样的翻回去。
 * 练什么：工作记忆 + 视觉比对。这是 3-6 岁最经典的记忆游戏，
 *        也是本项目原来完全空白的方向（原来只有视觉辨别和逻辑规律）。
 *
 * 一局玩 3 副牌，牌面逐副变大 —— 单次时长从 2 分钟延长到 5 分钟左右，
 * 这是「玩得下去」和「点两下就走了」的区别。
 *
 * 关键设计：翻开两张不一样的牌 **不算答错**。那本身就是玩法，
 * 所以只出柔和提示音，不调 r.retry()（不记连错、不影响难度）。
 * 「永不惩罚」是本项目的硬规则，记忆游戏尤其要守住。
 * 适合：3-6岁
 * ============================================================ */

/* 贴纸册定义在 start() 外面：注册到贴纸墙要在「还没玩过」时就生效，
   否则孩子第一次点进游戏之前，首页贴纸墙是空的。 */
const MM_STICKERS = [
  { id: 'mm1', emoji: '🧠', name: '小脑筋' },
  { id: 'mm2', emoji: '🎯', name: '神眼睛' },
  { id: 'mm3', emoji: '🍀', name: '好运气' },
  { id: 'mm4', emoji: '🕯️', name: '小蜡烛' },
  { id: 'mm5', emoji: '🌟', name: '闪亮星' },
];
Store.wall.register({
  id: 'memory-match', title: '翻牌配对', items: MM_STICKERS,
  owned: () => Store.create('mm_').getStickers(),
});

GameManager.register({
  id: 'memory-match',
  name: '翻牌配对',
  icon: '🃏',
  color: 'linear-gradient(135deg,#d4fc79,#96e6a1)',
  age: [3, 6],
  title: '翻开卡片，找到一样的！',

  start(stage, api) {
    const FACES = ['🐶', '🐱', '🐰', '🐻', '🦊', '🐼', '🐸', '🐷', '🐵', '🐥', '🦉', '🐙'];

    const r = api.rounds(stage, {
      total: 3,                          // 一局 3 副牌
      scope: 'mm',
      stickers: MM_STICKERS,
      draw: buildBoard,
      onWin(res) {
        api.setTitle(res && res.isNew ? '拿到新贴纸啦！' : '全部配对成功！');
      },
    });

    // 第 no 副牌有几对：难度决定底数，再逐副加 1 对，6 对封顶
    function pairCount(no) {
      const base = [3, 4, 5][r.store.getLevel() - 1] || 3;
      return Math.min(6, base + (no - 1));
    }

    function buildBoard(host, no) {
      const pairs = pairCount(no);
      const faces = api.util.shuffle(FACES).slice(0, pairs);
      const deck = api.util.shuffle(faces.concat(faces));
      const cols = pairs <= 3 ? 3 : 4;

      api.setTitle('翻开卡片，找到一样的！');

      const grid = api.util.el('div', 'mm-grid');
      grid.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';

      let open = [];      // 当前翻开的卡（最多 2 张）
      let found = 0;      // 已配对的对数
      let lock = false;   // 翻开两张后的结算锁，防止连点

      deck.forEach(face => {
        const card = api.util.el('div', 'mm-card');
        const inner = api.util.el('div', 'mm-inner');

        const back = api.util.el('div', 'mm-face mm-back', '❓');
        const front = api.util.el('div', 'mm-face mm-front', face);
        inner.appendChild(back);
        inner.appendChild(front);
        card.appendChild(inner);
        card.dataset.face = face;

        card.onclick = () => {
          if (lock) return;
          if (card.classList.contains('open') || card.classList.contains('matched')) return;

          card.classList.add('open');
          open.push(card);
          if (open.length < 2) return;

          // 翻开两张：结算
          lock = true;
          const [a, b] = open;

          if (a.dataset.face === b.dataset.face) {
            a.classList.add('matched');
            b.classList.add('matched');
            open = [];
            found++;
            api.sound.good();
            if (found >= pairs) setTimeout(() => r.next(), 700);
            else setTimeout(() => { lock = false; }, 250);
          } else {
            // 不一样：翻回去。这不是「答错」，不调 r.retry()。
            api.sound.soft();
            api.speak('再找找看');
            setTimeout(() => {
              a.classList.remove('open');
              b.classList.remove('open');
              open = [];
              lock = false;
            }, 800);
          }
        };

        grid.appendChild(card);
      });

      host.appendChild(grid);
    }
  },
});

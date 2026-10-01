/* ============================================================
 * 游戏模块：影子配对
 * 玩法：上面是彩色的小动物，下面是它们的黑影子。
 *       把小动物拖到自己的影子上。
 * 练什么：视觉辨别 + 空间对应 + 手眼协调。
 *
 * 为什么用 emoji 而不是画影子：
 *   项目要求零素材、纯离线。CSS 的 brightness(0) 能把任意
 *   emoji 变成纯黑剪影，既拿到了「影子」效果，又不用准备图片。
 *   也就是说：影子 = 同一个 emoji + 变黑。这是最省的做法。
 *
 * 难度分级（第几关决定动物几个 / 有没有相近的干扰项）：
 *   1 关 = 3 个动物，全是差别很大的
 *   2 关 = 4 个动物，出现猫/狗这种有点像的
 *   3 关 = 5 个动物，像的更多
 *
 * 适合：3-6岁
 * ============================================================ */

/* 贴纸册放在 start() 外面：贴纸墙要在「还没玩过」时就注册好，
   否则孩子第一次点进游戏之前首页贴纸墙是空的。 */
const SM_STICKERS = [
  { id: 'sm1', emoji: '🔦', name: '小探照灯' },
  { id: 'sm2', emoji: '🌗', name: '月牙' },
  { id: 'sm3', emoji: '🔍', name: '放大镜' },
  { id: 'sm4', emoji: '🕶️', name: '墨镜' },
  { id: 'sm5', emoji: '🦉', name: '猫头鹰' },
];
Store.wall.register({
  id: 'shadow-match', title: '影子配对', items: SM_STICKERS,
  owned: () => Store.create('sm_').getStickers(),
});

GameManager.register({
  id: 'shadow-match',
  name: '影子配对',
  icon: '🐾',
  color: 'linear-gradient(135deg,#c9d6ff,#e2e2e2)',
  age: [3, 6],
  title: '把小动物送回自己的影子！',

  start(stage, api) {
    // 按「像不像」分组：同一组里长得接近，用来做高难度的干扰项
    const EASY = ['🦁', '🐰', '🐢', '🐬'];
    const SIMILAR_1 = ['🐱', '🐶', '🦊', '🐷'];
    const SIMILAR_2 = ['🐭', '🐹', '🐨', '🦡'];

    const r = api.rounds(stage, {
      total: 3,
      scope: 'sm',
      stickers: SM_STICKERS,
      draw: buildRound,
      onWin(res) { api.setTitle(res && res.isNew ? '影子全对啦！' : '全部配对成功！'); },
    });

    // 难度 → 本关用哪一组动物、几个
    function pickAnimals() {
      const lv = r.store.getLevel();
      const pool = lv >= 3 ? SIMILAR_2.concat(SIMILAR_1) : lv === 2 ? SIMILAR_1 : EASY;
      const n = lv >= 3 ? 5 : lv === 2 ? 4 : 3;
      return api.util.shuffle(pool).slice(0, n);
    }

    function buildRound(host) {
      const animals = pickAnimals();
      api.setTitle('把小动物送回自己的影子！');

      // 影子 = 同一个 emoji，用 CSS 变黑
      const homes = api.util.el('div', 'sh-homes');
      const shadows = api.util.shuffle(animals);
      shadows.forEach(a => {
        const slot = api.util.el('div', 'sh-slot');
        slot.appendChild(api.util.el('div', 'sh-shadow', a));
        slot.dataset.face = a;
        homes.appendChild(slot);
      });

      const tray = api.util.el('div', 'sh-tray');
      let matched = 0;

      function slotUnder(x, y) {
        return [...homes.querySelectorAll('.sh-slot')].find(s => {
          const r = s.getBoundingClientRect();
          return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
        });
      }

      api.util.shuffle(animals).forEach(a => {
        const chip = api.util.el('div', 'sh-animal', a);
        chip.dataset.face = a;
        api.makeDraggable(chip, {
          onMove(x, y) {
            homes.querySelectorAll('.sh-slot').forEach(s => s.classList.remove('over'));
            const s = slotUnder(x, y); if (s) s.classList.add('over');
          },
          onDrop(x, y, revert, el) {
            homes.querySelectorAll('.sh-slot').forEach(s => s.classList.remove('over'));
            const s = slotUnder(x, y);
            if (s && s.dataset.face === el.dataset.face) {
              // 配对成功：影子亮起来显示彩色小动物
              s.classList.add('done');
              s.innerHTML = '';
              s.appendChild(api.util.el('div', 'sh-shadow lit', el.dataset.face));
              el.style.pointerEvents = 'none';
              el.style.opacity = '0';
              api.sound.good();
              if (++matched >= animals.length) setTimeout(() => r.next(), 600);
            } else {
              // 放错了影子：这是真的答错了（把狮子放进兔子的影子），
              // 调 r.retry() 让连错两次降一档难度。
              // 但表现上仍然只是滑回去 + 柔和提示音，不扣分不弹窗。
              r.retry();
              el.style.transition = 'all .3s';
              revert();
              setTimeout(() => (el.style.transition = ''), 300);
            }
          },
        });
        tray.appendChild(chip);
      });

      host.appendChild(homes);
      host.appendChild(tray);
      api.speak('把小动物送回自己的影子');
    }
  },
});

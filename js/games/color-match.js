/* ============================================================
 * 游戏模块：颜色配对
 * 玩法：把小动物拖回颜色相同的家。锻炼颜色认知 + 手眼协调。
 * 适合：3-4岁
 *
 * 这是一个独立插件，删掉本文件（及 index.html 里对应 <script>）
 * 不会影响其他任何游戏。
 * ============================================================ */
GameManager.register({
  id: 'color-match',
  name: '颜色配对',
  icon: '🎨',
  color: 'linear-gradient(135deg,#ff9a9e,#fad0c4)',
  age: [3, 5],
  title: '把小动物送回一样颜色的家吧！',

  start(stage, api) {
    const COLORS = [
      { n: '红', bg: '#ff6b6b' }, { n: '蓝', bg: '#4d96ff' },
      { n: '黄', bg: '#ffd93d' }, { n: '绿', bg: '#6bcB77' },
    ];
    const ANIMALS = ['🐶', '🐱', '🐰', '🐻', '🐼', '🦁', '🐯', '🐵', '🐸', '🐷'];

    const use = api.util.shuffle(COLORS).slice(0, 3);
    let matched = 0;

    const homes = api.util.el('div', 'color-homes');
    const tray = api.util.el('div', 'animal-tray');

    use.forEach(c => {
      const slot = api.util.el('div', 'home-slot', '🏠');
      slot.style.background = c.bg;
      slot.dataset.color = c.n;
      homes.appendChild(slot);
    });

    function slotUnder(x, y) {
      return [...homes.querySelectorAll('.home-slot')].find(s => {
        const r = s.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      });
    }

    const pool = api.util.shuffle(ANIMALS);
    api.util.shuffle(use).forEach((c, i) => {
      const a = api.util.el('div', 'animal', pool[i]);
      a.style.background = c.bg;
      a.dataset.color = c.n;
      api.makeDraggable(a, {
        onMove(x, y) {
          homes.querySelectorAll('.home-slot').forEach(s => s.classList.remove('over'));
          const s = slotUnder(x, y); if (s) s.classList.add('over');
        },
        onDrop(x, y, revert, el) {
          homes.querySelectorAll('.home-slot').forEach(s => s.classList.remove('over'));
          const s = slotUnder(x, y);
          if (s && s.dataset.color === el.dataset.color) {
            const r = s.getBoundingClientRect();
            el.style.left = (r.left + r.width / 2 - el.offsetWidth / 2) + 'px';
            el.style.top = (r.top + r.height / 2 - el.offsetHeight / 2) + 'px';
            el.style.pointerEvents = 'none';
            el.style.opacity = '0';
            s.textContent = el.textContent;
            api.sound.good();
            if (++matched >= use.length) setTimeout(() => api.reward(), 400);
          } else {
            api.sound.soft();
            el.style.transition = 'all .3s';
            revert();
            setTimeout(() => (el.style.transition = ''), 300);
          }
        },
      });
      tray.appendChild(a);
    });

    stage.appendChild(homes);
    stage.appendChild(tray);
    api.speak('把小动物送回一样颜色的家吧');
  },
});

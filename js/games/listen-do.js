/* ============================================================
 * 游戏模块：听指令
 * 玩法：屏幕上有 4 个物品，语音说「先摸苹果，再摸星星」，
 *       孩子必须按说的顺序去点。顺序错了也不扣分，温柔重来。
 * 练什么：听觉记忆 + 指令执行 + 顺序概念。
 *
 * 为什么值得单独做这个：
 *   现有游戏（配对/规律/找不同/情绪）全部只考「眼睛」，
 *   没有一个考「耳朵 + 记顺序」。而「听完一串话照着做」
 *   恰恰是幼儿园大班入学前最常考的能力。
 *
 * 降级方案（重要）：
 *   万一这台设备的浏览器不支持语音合成（老安卓、某些电视浏览器），
 *   api.canSpeak() 为 false，这时不静默卡住，而是把指令同时
 *   用图标序列显示出来变成「看图做」。游戏照样能玩完。
 *
 * 交互细节：
 *   - 语音念完才允许判对错，避免孩子手比声音快，第一下就点错。
 *   - 念完给 2.5 秒「记忆准备期」，这期间点了只提示、不判错。
 *   - 点错了：只出柔和音 + 说「再想想」，不扣分不清空进度。
 * 适合：4-6岁（要能记住 2-3 步）
 * ============================================================ */

/* 贴纸册放在 start() 外面：贴纸墙要在「还没玩过」时就注册好，
   否则孩子第一次点进游戏之前首页贴纸墙是空的。 */
const LD_STICKERS = [
  { id: 'ld1', emoji: '🎧', name: '小耳机' },
  { id: 'ld2', emoji: '🧩', name: '顺序王' },
  { id: 'ld3', emoji: '💡', name: '小灯泡' },
  { id: 'ld4', emoji: '🐘', name: '大象' },
  { id: 'ld5', emoji: '🏅', name: '棒棒哒' },
];
Store.wall.register({
  id: 'listen-do', title: '听指令', items: LD_STICKERS,
  owned: () => Store.create('ld_').getStickers(),
});

GameManager.register({
  id: 'listen-do',
  name: '听指令',
  icon: '👂',
  color: 'linear-gradient(135deg,#a1c4fd,#c2e9fb)',
  age: [4, 6],
  title: '听清楚，按顺序点哦',

  start(stage, api) {
    // 每件物品：图案 + 颜色说法 + 名称说法
    const ITEMS = [
      { e: '🍎', name: '苹果', c: '红色' },
      { e: '⭐', name: '星星', c: '黄色' },
      { e: '🚗', name: '汽车', c: '蓝色' },
      { e: '🌳', name: '大树', c: '绿色' },
      { e: '🍌', name: '香蕉', c: '黄色' },
      { e: '🐟', name: '小鱼', c: '橙色' },
      { e: '🎈', name: '气球', c: '红色' },
      { e: '☁️', name: '白云', c: '白色' },
    ];
    const COLORS = {
      '红色': '#ff6b6b', '黄色': '#ffd93d', '蓝色': '#4d96ff',
      '绿色': '#6bcB77', '橙色': '#ff9f43', '白色': '#f0f0f0',
    };

    const r = api.rounds(stage, {
      total: 4,
      scope: 'ld',
      stickers: LD_STICKERS,
      draw: buildRound,
      onWin(res) { api.setTitle(res && res.isNew ? '拿到新贴纸啦！' : '全听对啦！'); },
    });

    function buildRound(host) {
      const lv = r.store.getLevel();
      // 难度决定：念几步、屏幕上有几个干扰项
      const steps = Math.min(3, 1 + lv);               // 1关2步 2关3步 3关3步
      const shown = Math.min(ITEMS.length, steps + 2); // 干扰项 = 2 个

      const pool = api.util.shuffle(ITEMS).slice(0, shown);
      // 指令里的物品必须来自屏幕上的那几件，否则孩子点了也不算对
      const order = api.util.shuffle(pool).slice(0, steps);

      const visual = !api.canSpeak();   // 不能说话 → 降级成「看图做」
      api.setTitle(visual ? '按图上的顺序点' : '听清楚，按顺序点哦');

      /* ---- 顶部：指令区（能说话就只显示耳朵图标） ---- */
      const cue = api.util.el('div', 'ld-cue');
      if (visual) {
        order.forEach((it, i) => {
          const chip = api.util.el('div', 'ld-chip');
          chip.style.background = COLORS[it.c];
          chip.appendChild(api.util.el('span', 'ld-chip-e', it.e));
          cue.appendChild(chip);
          if (i < order.length - 1) cue.appendChild(api.util.el('span', 'ld-arrow', '→'));
        });
      } else {
        cue.appendChild(api.util.el('div', 'ld-ear', '👂'));
        cue.appendChild(api.util.el('div', 'ld-hint', '仔细听'));
      }
      host.appendChild(cue);

      /* ---- 中间：可选的物品 ---- */
      const row = api.util.el('div', 'ld-row');
      const buttons = [];
      pool.forEach(it => {
        const b = api.util.el('div', 'ld-item');
        b.style.background = COLORS[it.c];
        b.appendChild(api.util.el('span', 'ld-item-e', it.e));
        b.appendChild(api.util.el('span', 'ld-item-name', it.name));
        b._item = it;   // 记住这件物品，判定时直接比引用
        row.appendChild(b);
        buttons.push(b);
      });
      host.appendChild(row);

      /* ---- 进度：几步完成了 ---- */
      const prog = api.util.el('div', 'ld-prog');
      for (let i = 0; i < steps; i++) prog.appendChild(api.util.el('div', 'ld-step'));
      host.appendChild(prog);

      let at = 0;          // 当前该点第几步
      let ready = false;   // 念完 + 记忆准备期结束后才能判对错
      const paint = () => {
        const list = prog.children;
        for (let i = 0; i < list.length; i++) list[i].classList.toggle('done', i < at);
      };
      paint();

      // 念指令。念完（onEnd）再等 2.5 秒记忆期，然后才开判。
      // 孩子中途退出了（host 已从页面移除）就不必再开判。
      function arm() {
        setTimeout(() => {
          if (r.host.isConnected === false) return;
          ready = true;
        }, 2500);
      }
      if (visual) {
        api.speak('按图上的顺序点');
        arm();
      } else {
        const txt = '先摸' + order[0].c + '的' + order[0].name +
          (order[1] ? '，再摸' + order[1].c + '的' + order[1].name : '') +
          (order[2] ? '，最后摸' + order[2].c + '的' + order[2].name : '');
        api.speak(txt, arm);
      }

      buttons.forEach(b => {
        b.onclick = () => {
          if (!ready) { api.speak('先听清楚哦'); return; }   // 准备期：只提示
          if (b.classList.contains('done')) return;

          if (b._item === order[at]) {
            b.classList.add('done');
            api.sound.good();
            at++;
            paint();
            if (at >= steps) setTimeout(() => r.next(), 700);
            else api.speak('对啦，下一个是' + order[at].name);
          } else {
            // 点错：只温柔提示，不扣分、不清空已完成的进度。
            // 这里是真的答错了题目，要调 r.retry() 让难度系统知道。
            r.retry();
            api.speak('再想想');
            b.classList.add('wrong');
            setTimeout(() => b.classList.remove('wrong'), 400);
          }
        };
      });
    }
  },
});

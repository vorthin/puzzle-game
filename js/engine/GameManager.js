/* ============================================================
 * GameManager —— 游戏管理器（插件化核心）
 *
 * 所有游戏通过 GameManager.register({...}) 注册进来。
 * 主界面自动读取「已启用」的游戏生成卡片，不写死任何游戏。
 *
 *   加游戏 = 新建一个 js/games/xxx.js 并 register，再在 index.html 引入
 *   删游戏 = 删掉那个文件和 index.html 里的一行 <script>
 *   关游戏 = 家长设置里关掉开关（存 localStorage，不改代码）
 *
 * 每个游戏收到一套受控的 api，不用直接碰全局，降低耦合。
 * ============================================================ */
const GameManager = (function () {

  /* ---------- 通用工具，注入给每个游戏用 ---------- */
  const util = {
    shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; },
    pick(a) { return a[Math.floor(Math.random() * a.length)]; },
    randInt(n) { return Math.floor(Math.random() * n); },
    el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; },
  };

  /* ---------- 通用拖拽能力（颜色配对等游戏用） ---------- */
  let lastPoint = { x: 0, y: 0 };
  function point(e) { const t = e.touches ? e.touches[0] : e; lastPoint = { x: t.clientX, y: t.clientY }; return lastPoint; }
  function makeDraggable(el, handlers) {
    let sx, sy, ox, oy, dragging = false;
    function down(e) {
      dragging = true; el.classList.add('dragging');
      const p = point(e), r = el.getBoundingClientRect();
      ox = r.left; oy = r.top; sx = p.x; sy = p.y;
      el.style.position = 'fixed'; el.style.left = ox + 'px'; el.style.top = oy + 'px';
      el.style.width = r.width + 'px'; el.style.height = r.height + 'px';
      document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
      document.addEventListener('touchmove', move, { passive: false }); document.addEventListener('touchend', up);
    }
    function move(e) {
      if (!dragging) return; e.preventDefault();
      const p = point(e);
      el.style.left = ox + (p.x - sx) + 'px';
      el.style.top = oy + (p.y - sy) + 'px';
      if (handlers.onMove) handlers.onMove(p.x, p.y);
    }
    function up() {
      if (!dragging) return; dragging = false; el.classList.remove('dragging');
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up);
      document.removeEventListener('touchmove', move); document.removeEventListener('touchend', up);
      const revert = () => { el.style.left = ox + 'px'; el.style.top = oy + 'px'; };
      handlers.onDrop(lastPoint.x, lastPoint.y, revert, el);
    }
    el.addEventListener('mousedown', down);
    el.addEventListener('touchstart', down, { passive: true });
  }

  /* ---------- 多关卡循环：api.rounds ----------
   *
   * 解决的问题：原来每个游戏都只能「出 1 题 → 答对 → 结束」。
   * 孩子玩两分钟就没了，重复点卡片也只是换一批同样的题。
   *
   * rounds() 把「出题 → 判定 → 下一题 → 通关庆祝」这套流程收到引擎里，
   * 游戏只需要关心「这一题长什么样」和「答对/答错分别做什么」。
   *
   * 用法：
   *   const r = api.rounds(stage, {
   *     total: 5,                       // 本次玩几关
   *     scope: 'mm',                    // 存档命名空间（连对升难、贴纸都记在这）
   *     stickers: [...],                // 本游戏的贴纸册
   *     draw(host, no) { ... },         // 画第 no 关（no 从 1 开始）
   *     onWin(res) { ... },             // 全部通关，res = { sticker, isNew }
   *   });
   *   答对 → r.next()      答错 → r.retry()
   *
   * 关于「什么才算答错」：
   *   只有「点错/拖错」才算答错（会记一次连错，用于降难度）。
   *   翻牌配对里翻开两张不一样的牌不算答错——那是游戏本身，
   *   那种情况直接调 api.sound.soft() 即可，不要调 r.retry()。
   *
   * 设计上仍然遵守「永不惩罚」：retry() 只出柔和提示音，
   * 记一次连错用于降难度，不会显示任何失败/扣分。
   */
  function makeRounds(stage, opts) {
    const total = Math.max(1, opts.total || 5);
    // 传 scope:'mm' 就落在 mm_ 开头，不传就用 rounds_ 兜底
    const prefix = opts.scope ? opts.scope + '_' : 'rounds_';
    const store = Store.create(prefix, { stickers: opts.stickers });

    const box = util.el('div', 'rounds');
    const dots = util.el('div', 'rounds-dots');
    const host = util.el('div', 'rounds-host');
    box.appendChild(dots);
    box.appendChild(host);
    stage.appendChild(box);

    for (let i = 0; i < total; i++) dots.appendChild(util.el('div', 'rounds-dot'));
    let no = 0;      // 已通关数
    let closed = false;

    function alive() { return !closed && host.isConnected !== false; }

    function paint() {
      const list = dots.children;
      for (let i = 0; i < list.length; i++) list[i].classList.toggle('done', i < no);
    }
    function draw() {
      host.innerHTML = '';
      paint();
      if (opts.draw) opts.draw(host, no + 1);
    }

    function next() {
      if (closed) return;
      store.reportCorrect();
      no++;
      paint();
      if (no >= total) return finish();
      AudioManager.good();
      setTimeout(() => { if (alive()) draw(); }, 650);
    }

    function retry() {
      if (closed) return;
      store.reportWrong();
      AudioManager.soft();
      return store.getLevel();
    }

    function finish() {
      if (closed) return;
      closed = true;
      AudioManager.good();
      const res = store.grantNewSticker();
      if (opts.onWin) opts.onWin(res);
      api.reward();
    }

    // 首次出题必须延后一拍，不能同步调 draw()。
    //
    // 原因：游戏里写的是
    //     const r = api.rounds(stage, {...draw: buildBoard...});
    //     function buildBoard(...) { ...r.store... }   ← 用了 r
    // rounds() 还没 return，r 就还没赋值（const 有暂时性死区），
    // 此刻同步调 draw() → buildBoard 里读 r.store 直接抛
    // "Cannot access 'r' before initialization"，整页白屏。
    //
    // 延后到下一个事件循环，赋值就完成了。零成本，纯时序修正。
    setTimeout(draw, 0);

    return { next, retry, store, host, get no() { return no; }, get total() { return total; } };
  }

  /* ---------- 提供给每个游戏模块的受控 API ---------- */
  const api = {
    util,
    makeDraggable,
    rounds: makeRounds,
    store: Store,                 // Store.create('xx_') 建自己的存档
    speak: (t, onEnd) => SpeechManager.speak(t, onEnd),
    canSpeak: () => SpeechManager.supported() && SpeechManager.isEnabled(),
    sound: AudioManager,          // .good() .soft() .win()
    reward: (msg) => RewardManager.show(msg),
    // 允许游戏改标题（比如「好习惯」每关标题不同）
    setTitle: (t) => { const el = document.getElementById('gameTitle'); if (el) el.textContent = t; },
    // 退回平台首页。由 app.js 在启动时注入具体实现。
    exit: null,
  };

  /* ---------- 注册表 ---------- */
  const registry = [];
  function register(game) {
    // 基本校验，缺字段给默认值，避免整站崩
    if (!game || !game.id || typeof game.start !== 'function') {
      console.warn('[GameManager] 忽略无效游戏模块', game);
      return;
    }
    if (registry.some(g => g.id === game.id)) {
      console.warn('[GameManager] 重复的游戏 id：' + game.id);
      return;
    }
    registry.push(Object.assign({
      name: game.id, icon: '🎮', color: 'linear-gradient(135deg,#a1c4fd,#6a9dfd)',
      age: [3, 6], title: '',
    }, game));
  }

  function getAll() { return registry.slice(); }

  // 已启用 = 未被家长关闭 + （可选）符合当前年龄
  function getEnabled() {
    const off = JSON.parse(localStorage.getItem('disabledGames') || '[]');
    const age = parseInt(localStorage.getItem('childAge') || '0', 10);
    return registry.filter(g => {
      if (off.includes(g.id)) return false;
      if (age && g.age && (age < g.age[0] || age > g.age[1])) return false;
      return true;
    });
  }

  function isEnabled(id) { return getEnabled().some(g => g.id === id); }

  return {
    register,
    getAll,
    getEnabled,
    isEnabled,
    api,
  };
})();

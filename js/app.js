/* ============================================================
 * app.js —— 应用主控
 * 负责把引擎和界面粘起来：
 *   - 首页卡片自动渲染（读取 GameManager.getEnabled）
 *   - 进入/退出/重玩游戏
 *   - 家长门（算术题）+ 家长设置（时长、游戏开关、年龄）
 *   - 时间到锁定界面 + 长按解锁
 * 本文件不含任何具体游戏逻辑，游戏都在 js/games/ 里。
 * ============================================================ */
(function () {

  /* ---------- 屏幕切换 ---------- */
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }
  function stopCurrentGame() {
    // 游戏可能有自己的计时、自动行走或全局按键监听；离开时统一停掉，
    // 否则旧游戏还会接收输入或回头改新页面。
    if (current && typeof current.stop === 'function') current.stop();
  }
  function goHome() {
    stopCurrentGame();
    current = null;
    // 不只切换屏幕，还卸载旧舞台；这样游戏内部的 isConnected 检查才能真正停下延迟回调。
    document.getElementById('gameStage').innerHTML = '';
    show('home');
    SpeechManager.stop();
  }

  /* ---------- 启动 / 重玩游戏 ---------- */
  let current = null;
  function startGame(game) {
    if (TimerManager.isTimeUp()) { triggerTimeUp(); return; }
    stopCurrentGame();
    current = game;
    document.getElementById('gameTitle').textContent = game.title || '';
    const stage = document.getElementById('gameStage');
    stage.innerHTML = '';
    show('gameScreen');
    try { game.start(stage, GameManager.api); }
    catch (e) { console.error('游戏运行出错：' + game.id, e); goHome(); }
  }
  function replay() { if (current) startGame(current); }

  /* ---------- 首页卡片渲染 ---------- */
  function renderHome() {
    const grid = document.getElementById('homeGrid');
    grid.innerHTML = '';
    const games = GameManager.getEnabled();
    if (games.length === 0) {
      grid.innerHTML = '<p class="empty-tip">还没有开启任何游戏<br>点右上角 ⚙️ 开启吧</p>';
      return;
    }
    games.forEach(g => {
      const card = GameManager.api.util.el('div', 'card');
      card.style.background = g.color;
      card.appendChild(GameManager.api.util.el('div', 'emoji', g.icon));
      card.appendChild(GameManager.api.util.el('div', 'label', g.name));
      card.onclick = () => startGame(g);
      grid.appendChild(card);
    });
  }

  /* ---------- 家长门（算术题防孩子进入） ---------- */
  let mathAnswer = 0;
  function openGate() {
    const a = 2 + Math.floor(Math.random() * 8);
    const b = 2 + Math.floor(Math.random() * 8);
    mathAnswer = a + b;
    document.getElementById('mathQ').textContent = a + ' + ' + b + ' = ?';
    document.getElementById('mathA').value = '';
    document.getElementById('gate').classList.add('show');
    setTimeout(() => document.getElementById('mathA').focus(), 100);
  }

  /* ---------- 贴纸墙 ----------
   * 所有游戏的贴纸汇总在一面墙上（数据来自 Store.wall）。
   * 这是「玩得越多越想回来看」的钩子：孩子能看见自己收集到了什么，
   * 而不是玩完就散。已获得的显示图案，没获得的显示问号（不剧透）。
   */
  function openWall() {
    const grid = document.getElementById('wallGrid');
    grid.innerHTML = '';
    const cells = Store.wall.cells();
    cells.forEach(c => {
      const cell = GameManager.api.util.el('div', 'wall-cell' + (c.got ? ' got' : ''));
      cell.textContent = c.got ? c.emoji : '❔';
      cell.title = c.got ? c.name : '还没拿到';
      grid.appendChild(cell);
    });
    const s = Store.wall.stats();
    document.getElementById('wallCount').textContent = '已收集 ' + s.got + ' / ' + s.total + ' 张';
    document.getElementById('wall').classList.add('show');
  }

  /* ---------- 家长设置 ---------- */
  function openSettings() {
    // 时长选中态
    document.querySelectorAll('.time-opt').forEach(o =>
      o.classList.toggle('sel', parseInt(o.dataset.min, 10) === TimerManager.getLimit()));

    // 年龄选中态
    const age = parseInt(localStorage.getItem('childAge') || '0', 10);
    document.querySelectorAll('.age-opt').forEach(o =>
      o.classList.toggle('sel', parseInt(o.dataset.age, 10) === age));

    // 语音开关
    document.getElementById('voiceToggle').checked = SpeechManager.isEnabled();

    // 游戏开关列表
    const off = JSON.parse(localStorage.getItem('disabledGames') || '[]');
    const list = document.getElementById('toggleList');
    list.innerHTML = '';
    GameManager.getAll().forEach(g => {
      const row = GameManager.api.util.el('div', 'toggle-row');
      const name = GameManager.api.util.el('div', 'name');
      name.innerHTML = '<span class="ticon">' + g.icon + '</span> ' + g.name;
      const sw = GameManager.api.util.el('label', 'switch');
      const cb = GameManager.api.util.el('input');
      cb.type = 'checkbox';
      cb.checked = !off.includes(g.id);
      cb.dataset.id = g.id;
      const sl = GameManager.api.util.el('span', 'slider');
      sw.appendChild(cb); sw.appendChild(sl);
      row.appendChild(name); row.appendChild(sw);
      list.appendChild(row);
    });

    document.getElementById('settings').classList.add('show');
  }

  function saveSettings() {
    // 游戏开关
    const off = [...document.querySelectorAll('#toggleList input')]
      .filter(c => !c.checked).map(c => c.dataset.id);
    localStorage.setItem('disabledGames', JSON.stringify(off));
    // 语音
    SpeechManager.setEnabled(document.getElementById('voiceToggle').checked);
    localStorage.setItem('voiceOn', document.getElementById('voiceToggle').checked ? '1' : '0');
    // 关闭面板 + 重置计时 + 重绘首页
    document.getElementById('settings').classList.remove('show');
    TimerManager.reset();
    renderHome();
  }

  /* ---------- 时间到锁定 ---------- */
  function triggerTimeUp() {
    document.getElementById('timeup').classList.add('show');
    SpeechManager.speak('今天玩得真棒，我们明天再玩吧');
  }
  function unlock() {
    TimerManager.reset();
    document.getElementById('timeup').classList.remove('show');
    goHome();
  }

  /* ---------- 绑定所有 UI 事件 ---------- */
  function bindUI() {
    document.getElementById('settingsBtn').onclick = openGate;
    document.getElementById('wallBtn').onclick = openWall;
    document.getElementById('wallClose').onclick = () => document.getElementById('wall').classList.remove('show');
    document.getElementById('gateCancel').onclick = () => document.getElementById('gate').classList.remove('show');
    document.getElementById('mathSubmit').onclick = () => {
      if (parseInt(document.getElementById('mathA').value, 10) === mathAnswer) {
        document.getElementById('gate').classList.remove('show');
        openSettings();
      } else {
        document.getElementById('mathA').value = '';
        const q = document.getElementById('mathQ');
        q.style.color = '#ff6b6b';
        setTimeout(() => (q.style.color = '#333'), 600);
      }
    };
    document.getElementById('backBtn').onclick = goHome;
    document.getElementById('replayBtn').onclick = replay;

    // 时长选择
    document.querySelectorAll('.time-opt').forEach(o => o.onclick = () => {
      document.querySelectorAll('.time-opt').forEach(x => x.classList.remove('sel'));
      o.classList.add('sel');
      TimerManager.setLimit(parseInt(o.dataset.min, 10));
    });
    // 年龄选择
    document.querySelectorAll('.age-opt').forEach(o => o.onclick = () => {
      document.querySelectorAll('.age-opt').forEach(x => x.classList.remove('sel'));
      o.classList.add('sel');
      localStorage.setItem('childAge', o.dataset.age);
    });

    document.getElementById('saveSettings').onclick = saveSettings;
    document.getElementById('resetTimer').onclick = () => {
      TimerManager.reset();
      document.getElementById('settings').classList.remove('show');
    };

    // 时间到：长按月亮3秒解锁（防孩子误解锁）
    const moon = document.querySelector('#timeup .moon');
    let t;
    const startPress = () => { t = setTimeout(unlock, 3000); };
    const cancelPress = () => clearTimeout(t);
    moon.addEventListener('mousedown', startPress);
    moon.addEventListener('touchstart', startPress, { passive: true });
    moon.addEventListener('mouseup', cancelPress);
    moon.addEventListener('touchend', cancelPress);
    moon.addEventListener('mouseleave', cancelPress);

    // 计时回调
    TimerManager.onWarn(() => SpeechManager.speak('还有一分钟就要休息啦'));
    TimerManager.onTimeUp(triggerTimeUp);

    // 首次点击激活语音（浏览器策略要求先有用户交互）
    document.body.addEventListener('click', function once() {
      SpeechManager.speak('欢迎来到宝贝乐园');
    }, { once: true });
  }

  /* ---------- 启动 ---------- */
  function boot() {
    // 恢复语音开关
    SpeechManager.setEnabled(localStorage.getItem('voiceOn') !== '0');
    // 让游戏模块能退回平台首页
    GameManager.api.exit = goHome;
    bindUI();
    renderHome();
    TimerManager.reset();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();

/* ============================================================
 * LG_Game —— 《光之小卫士》主流程
 *
 * 作为一个游戏模块注册进平台（GameManager）。点开后在 stage 内
 * 渲染自己的一整套界面：首页 → 关卡 → 结束页，并管理家长门、
 * 家长设置、计时与打哈欠结束。
 *
 * 实现的需求点：
 *  1 首页 / 家长设置 / 家长门（长按3秒 + 算术）
 *  2 三个任务（多波变身配对 / 数数与比较 / 星星呼吸）——见 levels.js
 *  3 每关内部有连续任务和进度反馈，不再答一题就结束
  *  4 默认10分钟，5分钟提醒，1分钟预告，到点打哈欠自动结束
  *  5 无失败惩罚（在 levels.js 里保证）
  *  6 无广告/内购/排行榜/外链
  *  7 结束页给现实任务
  *  8 奖励=本地贴纸墙
  *  9 预录音频/无音频时中文朗读（VoiceManager）
  * 10 localStorage（LG_Store）
  * 11 连对升难度/连错降难度（LG_Store）
 * ============================================================ */
const LG_Game = (function () {
  function h(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function buildHero(yawning) {
    const hero = h('div', 'lg-hero');
    const heroBody = h('div', 'lg-hero-body');
    const heroHead = h('div', 'lg-hero-head');
    if (yawning) heroHead.classList.add('lg-yawn');
    const heroEyes = h('div', 'lg-hero-eyes');
    heroEyes.innerHTML = '<div class="lg-hero-eye"></div><div class="lg-hero-eye"></div>';
    heroHead.appendChild(heroEyes);
    const heroTorso = h('div', 'lg-hero-torso');
    const heroLamp = h('div', 'lg-hero-lamp');
    heroTorso.appendChild(heroLamp);
    heroBody.appendChild(heroHead);
    heroBody.appendChild(heroTorso);
    hero.appendChild(heroBody);
    return hero;
  }

  let root, screens = {};
  let outerApi = null;
  // 计时
  let sessionStart = 0, tick = null, remind5 = false, preview1 = false, ended = false;
  // 平台离开游戏时让延迟过场失效，避免旧关卡回头改新页面。
  let sessionToken = 0;
  // 关卡进度
  let queue = [], pos = 0;

  /* ---------------- 入口 ---------------- */
  function start(stage, api) {
    outerApi = api;
    sessionToken++;
    ended = false; remind5 = false; preview1 = false;
    VoiceManager.preload();
    buildDOM(stage);
    startTimer();
    showHome();
    VoiceManager.play('welcome');
    LG_Focus.onBack(handleBack);
  }

  /* ---------------- 构建所有内部界面 ---------------- */
  function buildDOM(stage) {
    stage.innerHTML = '';
    root = h('div', 'lg-root');

    /* 顶部条：返回平台 + 暂停 */
    const bar = h('div', 'lg-bar');
    const homeBtn = h('button', 'lg-iconbtn lg-focusable', '🏠');
    homeBtn.onclick = () => { if (outerApi && outerApi.exit) outerApi.exit(); };
    const pauseBtn = h('button', 'lg-iconbtn lg-focusable', '⏸️');
    pauseBtn.onclick = openPause;
    const gearBtn = h('button', 'lg-iconbtn lg-focusable', '⚙️');
    gearBtn.onclick = openGate;
    const timeChip = h('div', 'lg-timechip'); timeChip.id = 'lgTimeChip';
    bar.appendChild(homeBtn);
    bar.appendChild(timeChip);
    const barRight = h('div', 'lg-bar-right');
    barRight.appendChild(pauseBtn); barRight.appendChild(gearBtn);
    bar.appendChild(barRight);
    root.appendChild(bar);

    /* 各屏容器 */
    ['home', 'play', 'end'].forEach(name => {
      const s = h('div', 'lg-screen'); s.id = 'lg-' + name; screens[name] = s; root.appendChild(s);
    });

    /* 弹层：暂停 / 家长门 / 家长设置 */
    root.appendChild(buildPause());
    root.appendChild(buildGate());
    root.appendChild(buildSettings());

    stage.appendChild(root);
  }

  /* ---------------- 首页 ---------------- */
  function showHome() {
    // 回内部首页也要卸载旧关卡；仅隐藏 play 屏会让呼吸/过场计时继续跑。
    sessionToken++;
    screens.play.innerHTML = '';
    VoiceManager.stop();
    switchScreen('home');
    const s = screens.home; s.innerHTML = '';

    s.appendChild(buildHero(false));
    s.appendChild(h('h1', 'lg-title', LG_CONFIG.theme.heroName));
    s.appendChild(h('p', 'lg-subtitle', '用光的力量，帮能量兽变彩色、送回家！'));

    const grid = h('div', 'lg-levelgrid');
    LG_Levels.levels.forEach((lv, i) => {
      const card = h('button', 'lg-levelcard lg-focusable');
      card.appendChild(h('div', 'lg-levelicon', lv.icon));
      card.appendChild(h('div', 'lg-levelname', lv.name));
      // 首页卡片显示「这一关会做什么」，减少孩子盲选，也让新增玩法的理由可见。
      card.appendChild(h('div', 'lg-leveltip', lv.tip || '点进去试试看'));
      card.onclick = () => startFrom(i);
      grid.appendChild(card);
    });
    s.appendChild(grid);

    const playAll = h('button', 'lg-bigbtn lg-focusable', '▶ 开始闯关');
    playAll.onclick = () => startFrom(0);
    s.appendChild(playAll);

    LG_Focus.setScope(s);
    VoiceManager.play('pickLevel');
  }

  /* ---------------- 关卡流程 ---------------- */
  function startFrom(index) {
    if (ended) return;
    queue = LG_Levels.levels.slice();
    pos = index;
    playCurrent();
  }
  function playCurrent() {
    if (ended) return;
    if (pos >= queue.length) { finishSession('allClear'); return; }
    const playToken = sessionToken;
    switchScreen('play');
    const s = screens.play; s.innerHTML = '';
    const lv = queue[pos];
    s.appendChild(h('div', 'lg-levelbadge', lv.icon + ' ' + lv.name));
    const stageBox = h('div', 'lg-stagebox');
    s.appendChild(stageBox);
    lv.build(stageBox, {
      config: LG_CONFIG,
      onClear: () => {
        if (ended || playToken !== sessionToken) return;
        VoiceManager.play('good');
        pos++;
        // 关间小奖励贴纸
        grantSticker(true);
        setTimeout(() => { if (!ended && playToken === sessionToken) playCurrent(); }, 900);
      },
    });
    LG_Focus.setScope(s);
  }

  /* ---------------- 计时（10分钟 / 5分提醒 / 1分预告 / 打哈欠结束） ---------------- */
  function totalMinutes() { return LG_Store.get('minutes', LG_CONFIG.timer.defaultMinutes); }
  function startTimer() {
    sessionStart = Date.now();
    if (tick) clearInterval(tick);
    tick = setInterval(updateTimer, 1000);
    updateTimer();
  }
  function elapsedMin() { return (Date.now() - sessionStart) / 60000; }
  function updateTimer() {
    if (ended) return;
    const total = totalMinutes();
    const e = elapsedMin();
    const remain = Math.max(0, total - e);
    const chip = document.getElementById('lgTimeChip');
    if (chip) chip.textContent = '⏳ ' + Math.ceil(remain) + ' 分钟';

    if (!remind5 && e >= LG_CONFIG.timer.remindAt && remain > LG_CONFIG.timer.previewAt) {
      remind5 = true; VoiceManager.play('remind5'); flashMsg('还可以玩一会儿哦~');
    }
    if (!preview1 && remain <= LG_CONFIG.timer.previewAt && remain > 0) {
      preview1 = true; VoiceManager.play('preview1'); flashMsg('还有一分钟就要休息啦');
    }
    if (e >= total) finishSession('timeup');
  }

  /* ---------------- 结束（打哈欠 + 现实任务 + 贴纸墙） ---------------- */
  function finishSession(reason) {
    if (ended) return;
    ended = true;
    sessionToken++;
    if (tick) { clearInterval(tick); tick = null; }
    // 时间到时必须卸载旧关卡，否则正在呼吸的延迟回调仍会发声和更新难度。
    screens.play.innerHTML = '';
    VoiceManager.stop();
    // 记录今日分钟
    LG_Store.addTodayMinutes(Math.round(elapsedMin()));
    switchScreen('end');
    const s = screens.end; s.innerHTML = '';

    if (reason === 'timeup') VoiceManager.play('yawn');

    s.appendChild(buildHero(reason === 'timeup'));
    s.appendChild(h('h1', 'lg-title', reason === 'timeup' ? '今天玩得真棒，该休息啦' : '全部通关啦！'));

    // 现实任务
    const task = LG_CONFIG.realTasks[Math.floor(Math.random() * LG_CONFIG.realTasks.length)];
    const taskBox = h('div', 'lg-taskbox');
    taskBox.appendChild(h('div', 'lg-taskicon', task.icon));
    taskBox.appendChild(h('div', 'lg-tasktext', '离开屏幕，去完成一个小任务：\n' + task.text));
    s.appendChild(taskBox);

    // 贴纸墙
    s.appendChild(buildStickerWall());

    const back = h('button', 'lg-bigbtn lg-focusable', '好的，我知道啦');
    back.onclick = () => { restartSession(); };
    s.appendChild(back);

    LG_Focus.setScope(s);
  }

  // 家长确认后重新开始一段新的时长
  function restartSession() {
    ended = false; remind5 = false; preview1 = false;
    startTimer();
    showHome();
  }

  function buildStickerWall() {
    const wall = h('div', 'lg-wall');
    wall.appendChild(h('div', 'lg-wall-title', '🏆 我的贴纸墙'));
    const grid = h('div', 'lg-wall-grid');
    const owned = LG_Store.getStickers();
    LG_CONFIG.stickers.forEach(st => {
      const cell = h('div', 'lg-wall-cell' + (owned.includes(st.id) ? ' got' : ''));
      cell.textContent = owned.includes(st.id) ? st.emoji : '❔';
      grid.appendChild(cell);
    });
    wall.appendChild(grid);
    return wall;
  }
  function grantSticker(silent) {
    const res = LG_Store.grantNewSticker();
    if (res.isNew && !silent) VoiceManager.play('sticker');
    if (res.isNew) flashMsg('获得新贴纸 ' + res.sticker.emoji);
  }

  /* ---------------- 暂停弹层 ---------------- */
  function buildPause() {
    const o = h('div', 'lg-overlay'); o.id = 'lgPause';
    const p = h('div', 'lg-panel');
    p.appendChild(h('h2', null, '⏸️ 休息一下'));
    const resume = h('button', 'lg-bigbtn lg-focusable', '继续玩');
    resume.onclick = closePause;
    const home = h('button', 'lg-bigbtn ghost lg-focusable', '回首页');
    home.onclick = () => { closePause(); showHome(); };
    p.appendChild(resume); p.appendChild(home);
    o.appendChild(p);
    return o;
  }
  function openPause() { document.getElementById('lgPause').classList.add('show'); LG_Focus.setScope(document.getElementById('lgPause')); }
  function closePause() { document.getElementById('lgPause').classList.remove('show'); LG_Focus.setScope(currentScreenEl()); }

  /* ---------------- 家长门（长按3秒 + 算术） ---------------- */
  let mathAnswer = 0;
  function buildGate() {
    const o = h('div', 'lg-overlay'); o.id = 'lgGate';
    const p = h('div', 'lg-panel');
    p.appendChild(h('h2', null, '👨‍👩‍👧 家长验证'));
    p.appendChild(h('p', null, '请长按下面的按钮 3 秒'));
    const hold = h('button', 'lg-holdbtn lg-focusable', '长按这里');
    hold.id = 'lgHold';
    const mathWrap = h('div', 'lg-mathwrap'); mathWrap.id = 'lgMathWrap'; mathWrap.style.display = 'none';
    const q = h('div', 'lg-mathq'); q.id = 'lgMathQ';
    const inp = h('input', 'lg-mathinput'); inp.id = 'lgMathA'; inp.type = 'number'; inp.inputMode = 'numeric';
    const ok = h('button', 'lg-bigbtn lg-focusable', '确定');
    ok.onclick = submitMath;
    mathWrap.appendChild(q); mathWrap.appendChild(inp); mathWrap.appendChild(ok);
    const cancel = h('button', 'lg-bigbtn ghost lg-focusable', '取消');
    cancel.onclick = closeGate;
    p.appendChild(hold); p.appendChild(mathWrap); p.appendChild(cancel);
    o.appendChild(p);

    // 长按逻辑
    let timer = null, progress = 0;
    const startHold = () => {
      hold.classList.add('holding');
      timer = setTimeout(() => { hold.classList.remove('holding'); showMath(); }, 3000);
    };
    const cancelHold = () => { clearTimeout(timer); hold.classList.remove('holding'); };
    hold.addEventListener('mousedown', startHold);
    hold.addEventListener('touchstart', (e) => { e.preventDefault(); startHold(); }, { passive: false });
    hold.addEventListener('mouseup', cancelHold);
    hold.addEventListener('mouseleave', cancelHold);
    hold.addEventListener('touchend', cancelHold);
    // 遥控器/键盘：按住 Enter 也能触发（keydown 持续，keyup 取消）
    hold.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !timer) startHold(); });
    hold.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') cancelHold(); });
    return o;
  }
  function openGate() {
    document.getElementById('lgMathWrap').style.display = 'none';
    document.getElementById('lgGate').classList.add('show');
    LG_Focus.setScope(document.getElementById('lgGate'));
  }
  function closeGate() { document.getElementById('lgGate').classList.remove('show'); LG_Focus.setScope(currentScreenEl()); }
  function showMath() {
    const a = 2 + Math.floor(Math.random() * 8), b = 2 + Math.floor(Math.random() * 8);
    mathAnswer = a + b;
    document.getElementById('lgMathQ').textContent = a + ' + ' + b + ' = ?';
    document.getElementById('lgMathA').value = '';
    document.getElementById('lgMathWrap').style.display = 'flex';
    LG_Focus.setScope(document.getElementById('lgGate'));
    setTimeout(() => document.getElementById('lgMathA').focus(), 100);
  }
  function submitMath() {
    if (parseInt(document.getElementById('lgMathA').value, 10) === mathAnswer) {
      closeGate(); openSettings();
    } else {
      const q = document.getElementById('lgMathQ');
      q.style.color = LG_CONFIG.theme.red;
      document.getElementById('lgMathA').value = '';
      setTimeout(() => q.style.color = '', 600);
    }
  }

  /* ---------------- 家长设置（年龄/时长/声音） ---------------- */
  function buildSettings() {
    const o = h('div', 'lg-overlay'); o.id = 'lgSettings';
    const p = h('div', 'lg-panel wide');
    p.appendChild(h('h2', null, '⚙️ 家长设置'));

    p.appendChild(h('p', null, '孩子年龄'));
    const ageRow = h('div', 'lg-optrow'); ageRow.id = 'lgAgeRow';
    [3, 4, 5, 6].forEach(a => {
      const b = h('button', 'lg-opt lg-focusable', a + '岁'); b.dataset.age = a;
      b.onclick = () => { LG_Store.set('age', a); syncSettings(); };
      ageRow.appendChild(b);
    });
    p.appendChild(ageRow);

    p.appendChild(h('p', null, '单次时长'));
    const minRow = h('div', 'lg-optrow'); minRow.id = 'lgMinRow';
    [5, 10, 15, 20].forEach(m => {
      const b = h('button', 'lg-opt lg-focusable', m + '分钟'); b.dataset.min = m;
      b.onclick = () => { LG_Store.set('minutes', m); syncSettings(); };
      minRow.appendChild(b);
    });
    p.appendChild(minRow);

    p.appendChild(h('p', null, '声音'));
    const soundRow = h('div', 'lg-optrow');
    const soundBtn = h('button', 'lg-opt lg-focusable'); soundBtn.id = 'lgSoundBtn';
    soundBtn.onclick = () => { LG_Store.set('soundOn', !LG_Store.get('soundOn', true)); syncSettings(); };
    soundRow.appendChild(soundBtn);
    p.appendChild(soundRow);

    p.appendChild(h('p', 'lg-todaytip', '')).id = 'lgTodayTip';

    const save = h('button', 'lg-bigbtn lg-focusable', '保存并开始');
    save.onclick = () => { closeSettings(); restartSession(); };
    p.appendChild(save);
    o.appendChild(p);
    return o;
  }
  function syncSettings() {
    const age = LG_Store.get('age', 0);
    document.querySelectorAll('#lgAgeRow .lg-opt').forEach(b => b.classList.toggle('sel', +b.dataset.age === age));
    const min = totalMinutes();
    document.querySelectorAll('#lgMinRow .lg-opt').forEach(b => b.classList.toggle('sel', +b.dataset.min === min));
    const on = LG_Store.get('soundOn', true);
    document.getElementById('lgSoundBtn').textContent = on ? '🔊 开' : '🔇 关';
    document.getElementById('lgSoundBtn').classList.toggle('sel', on);
    document.getElementById('lgTodayTip').textContent = '今天已经玩了 ' + LG_Store.getTodayMinutes() + ' 分钟';
  }
  function openSettings() { document.getElementById('lgSettings').classList.add('show'); syncSettings(); LG_Focus.setScope(document.getElementById('lgSettings')); }
  function closeSettings() { document.getElementById('lgSettings').classList.remove('show'); LG_Focus.setScope(currentScreenEl()); }

  /* ---------------- 工具 ---------------- */
  let activeScreen = 'home';
  function switchScreen(name) {
    activeScreen = name;
    Object.keys(screens).forEach(k => screens[k].classList.toggle('active', k === name));
  }
  function currentScreenEl() { return screens[activeScreen] || screens.home; }
  function handleBack() {
    // Esc/返回：优先关弹层，否则在游玩中暂停，首页则回平台
    const pause = document.getElementById('lgPause');
    const gate = document.getElementById('lgGate');
    const setg = document.getElementById('lgSettings');
    if (gate.classList.contains('show')) { closeGate(); return; }
    if (setg.classList.contains('show')) { closeSettings(); return; }
    if (pause.classList.contains('show')) { closePause(); return; }
    if (activeScreen === 'play') { openPause(); return; }
    // 首页按返回 → 交还平台（点平台的🏠效果）
    if (outerApi && outerApi.exit) outerApi.exit();
  }
  function flashMsg(msg) {
    let t = document.getElementById('lgFlash');
    if (!t) { t = h('div', 'lg-flash'); t.id = 'lgFlash'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 1600);
  }

  function stop() {
    // 平台首页会清空 gameStage；这里先让所有关卡回调失效，再停本游戏自己的计时。
    sessionToken++;
    ended = true;
    if (tick) { clearInterval(tick); tick = null; }
    VoiceManager.stop();
    LG_Focus.clear();
  }

  return { start, stop, showEnd: () => finishSession('timeup') };
})();

/* ---------------- 注册到平台 ---------------- */
GameManager.register({
  id: 'light-guardian',
  name: '光之小卫士',
  icon: '🦸',
  color: 'linear-gradient(135deg,#e63946,#1d7fe0)',
  age: [3, 6],
  title: '',
  start(stage, api) { LG_Game.start(stage, api); },
  // 平台回首页/重玩前会调用 stop，清理本游戏自己的计时、音频和延迟过场。
  stop() { LG_Game.stop(); },
});

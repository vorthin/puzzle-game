/* 冒烟测试：用最小 DOM/window stub 按 index.html 顺序加载全部脚本，
   验证：无加载期报错、游戏注册数、Store/rounds、光之小卫士、社区步行与任务。
   本文件保留在仓库中，改动引擎或关卡后运行 node _smoke_test.js。 */
const fs = require('fs');
const vm = require('vm');

/* ---- 极简 DOM stub ---- */
function makeEl(tag = 'div') {
  const el = {
    tagName: tag.toUpperCase(), className: '', id: '', textContent: '', innerHTML: '', value: '',
    style: {}, dataset: {}, disabled: false, offsetParent: {},
    children: [], _cls: new Set(),
    classList: {
      add: (...c) => c.forEach(x => el._cls.add(x)),
      remove: (...c) => c.forEach(x => el._cls.delete(x)),
      toggle: (c, on) => { if (on === undefined) on = !el._cls.has(c); on ? el._cls.add(c) : el._cls.delete(c); return on; },
      contains: (c) => el._cls.has(c),
    },
    appendChild: (c) => { el.children.push(c); return c; },
    setAttribute() {}, getAttribute() { return ''; },
    addEventListener(type, fn) { (el._events[type] ||= []).push(fn); },
    removeEventListener(type, fn) { el._events[type] = (el._events[type] || []).filter(x => x !== fn); },
    _events: {},
    click() { if (el.onclick) el.onclick(); },
    dispatch(type, event = {}) { (el._events[type] || []).forEach(fn => fn(event)); },
    focus() { document.activeElement = el; }, scrollIntoView() {}, contains() { return true; },
    querySelectorAll: () => [], querySelector: () => null,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }),
    remove() {},
  };
  let html = '';
  Object.defineProperty(el, 'innerHTML', {
    get: () => html,
    set: value => { html = value; el.children = []; },
  });
  return el;
}
const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const docEvents = {};
const document = {
  body: makeEl(),
  createElement: makeEl,
  getElementById: () => makeEl(),
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener(type, fn) { (docEvents[type] ||= []).push(fn); },
  removeEventListener(type, fn) { docEvents[type] = (docEvents[type] || []).filter(x => x !== fn); },
  dispatch(type, event = {}) { (docEvents[type] || []).forEach(fn => fn(event)); },
};
function Audio() { return { preload: '', src: '', addEventListener() {}, play: () => Promise.resolve(), currentTime: 0 }; }
function AudioContext() { return { createOscillator: () => ({ connect() {}, start() {}, stop() {}, frequency: {}, type: '' }), createGain: () => ({ connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }), currentTime: 0, destination: {} }; }
function SpeechSynthesisUtterance() { return {}; }
const sandbox = {
  window: {}, document, localStorage, navigator: { userAgent: 'node' },
  Audio, AudioContext, webkitAudioContext: AudioContext,
  SpeechSynthesisUtterance, speechSynthesis: { cancel() {}, speak() {} },
  setTimeout, clearTimeout, setInterval, clearInterval, console,
};
const winEvents = {};
sandbox.addEventListener = (type, fn) => { (winEvents[type] ||= []).push(fn); };
sandbox.removeEventListener = (type, fn) => {
  winEvents[type] = (winEvents[type] || []).filter(x => x !== fn);
};
sandbox.window = sandbox;
vm.createContext(sandbox);

const files = [
  'js/engine/AudioManager.js', 'js/engine/SpeechManager.js', 'js/engine/TimerManager.js',
  'js/engine/RewardManager.js', 'js/engine/Store.js', 'js/engine/GameManager.js',
  'js/games/color-match.js', 'js/games/pattern.js', 'js/games/spot-difference.js', 'js/games/emotion.js',
  'js/games/memory-match.js', 'js/games/shadow-match.js', 'js/games/listen-do.js',
  'js/games/community-helper.js',
  'js/games/light-guardian/config.js', 'js/games/light-guardian/voice.js', 'js/games/light-guardian/store.js',
  'js/games/light-guardian/focus.js', 'js/games/light-guardian/levels.js', 'js/games/light-guardian/main.js',
  'js/app.js',
];
let pass = 0, fail = 0;
function ok(name, cond) { cond ? (pass++, console.log('  ✓ ' + name)) : (fail++, console.log('  ✗ ' + name)); }

console.log('加载脚本…');
for (const f of files) {
  try { vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f }); console.log('  loaded ' + f); }
  catch (e) { fail++; console.log('  ✗ 加载失败 ' + f + ' → ' + e.message); }
}

console.log('\n断言：');

async function main() {
// VM 里顶层 const 不挂到 sandbox 对象，改用在上下文内求值读取（浏览器里 script 间共享全局词法作用域）
const evalIn = (expr) => vm.runInContext(expr, sandbox);
const GM = evalIn('GameManager');
ok('GameManager 存在', !!GM);
ok('注册了 9 个游戏', GM && GM.getAll().length === 9);
const html = fs.readFileSync('index.html', 'utf8');
const scriptPaths = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
ok('测试脚本顺序和真实页面一致', JSON.stringify(scriptPaths) === JSON.stringify(files));
ok('社区样式已在页面引入', html.includes('href="css/community-helper.css"') &&
  fs.existsSync('css/community-helper.css'));

/* ---- 首页布局：新增游戏后不应悄悄退回「2列 + 必须下拉」 ---- */
const homeCss = fs.readFileSync('css/main.css', 'utf8');
ok('首页宽屏默认4列', /\.grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,/.test(homeCss));
ok('首页窄屏切换3列', /@media\s*\(max-width:\s*700px\)[\s\S]*?\.grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,/.test(homeCss));
ok('矮横屏保持4列', /@media\s*\(max-height:\s*500px\)\s+and\s+\(orientation:\s*landscape\)[\s\S]*?\.grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,/.test(homeCss));
ok('首页保留超量游戏滚动兜底', /\.grid\s*\{[^}]*max-height:\s*72vh[^}]*overflow-y:\s*auto/.test(homeCss));
ok('包含 light-guardian', GM && GM.getAll().some(g => g.id === 'light-guardian'));
ok('新游戏都在（翻牌/影子/听指令）', GM && ['memory-match', 'shadow-match', 'listen-do']
  .every(id => GM.getAll().some(g => g.id === id)));
ok('LG_CONFIG 有 3 关卡数据源(能量兽/贴纸/任务)', evalIn('LG_CONFIG.energyBeast.kinds.length>=4 && LG_CONFIG.stickers.length===9 && LG_CONFIG.realTasks.length>=4'));
ok('LG_Levels 有 3 个关卡', evalIn('LG_Levels.levels.length') === 3);

/* ---- Store：命名空间隔离 ---- */
const St = evalIn('Store');
ok('Store 存在', !!St);
const a = St.create('t_a_'), b = St.create('t_b_');
a.set('k', 1);
ok('同名键在不同命名空间互不干扰', a.get('k') === 1 && b.get('k', 0) === 0);
ok('读不存在的键返回默认值', b.get('nope', 'def') === 'def');
// 连对升 / 连错降
a.set('difficulty', 1);
a.reportCorrect(); a.reportCorrect(); a.reportCorrect();
ok('连对3次 → 难度升到2', a.getLevel() === 2);
a.reportWrong(); a.reportWrong();
ok('连错2次 → 难度降回1', a.getLevel() === 1);
a.reportWrong(); a.reportWrong(); a.reportWrong(); a.reportWrong();
ok('难度不低于最小值1', a.getLevel() === 1);
// 今日分钟
a.addTodayMinutes(3); a.addTodayMinutes(2);
ok('今日分钟累加=5', a.getTodayMinutes() === 5);
// 坏数据不崩
localStorage.setItem('t_a_k', '{坏JSON');
ok('坏 JSON 不抛错，退回原始字符串', a.get('k') === '{坏JSON');

// 贴纸去重（要带贴纸册，行为 light-guardian 那种）
const CAT = [{ id: 'c1', emoji: '🍎', name: '苹果' }, { id: 'c2', emoji: '🍌', name: '香蕉' }];
const st2 = St.create('t_st_', { stickers: CAT });
const n0 = st2.getStickers().length;
const g1 = st2.grantNewSticker();
ok('发贴纸 isNew=true', g1.isNew === true);
ok('贴纸数量+1', st2.getStickers().length === n0 + 1);
const g2 = st2.grantNewSticker();
ok('第2张也是新的', g2.isNew === true && st2.getStickers().length === 2);
const g3 = st2.grantNewSticker();
ok('全部拿完后重复发，不再新增', g3.isNew === false && st2.getStickers().length === 2);
ok('没贴纸册的 store 调 grantNewSticker 不抛错',
  (() => { try { return St.create('t_none_').grantNewSticker().isNew === false; } catch (e) { return false; } })());

/* ---- 贴纸墙：新增社区游戏的贴纸包也能在玩之前看到 ---- */
ok('贴纸墙注册了 5 个游戏', St.wall.cells().length === 9 + 5 + 5 + 5 + 2);
const stats = St.wall.stats();
ok('贴纸墙统计可读', stats.total === 26 && stats.got >= 0);

/* ---- LG_Store 现在是 Store 的适配层，接口必须没变 ---- */
const S = evalIn('LG_Store');
ok('LG_Store 存在', !!S);
ok('LG_Store 接口完整', ['get', 'set', 'getTodayMinutes', 'addTodayMinutes', 'getStickers',
  'grantNewSticker', 'getLevel', 'reportCorrect', 'reportWrong'].every(k => typeof S[k] === 'function'));
// 老存档键名仍然是 lg_ 前缀（不能改名，否则已有数据读不出来）
S.set('difficulty', 1);
ok('LG_Store 仍写 lg_ 前缀', store['lg_difficulty'] === '1');
S.reportCorrect(); S.reportCorrect(); S.reportCorrect();
ok('LG 连对3次升难(兼容旧接口)', S.getLevel() === 2);

/* ---- SpeechManager：speak 的 onEnd 一定会被调用 ----
   听指令这个游戏靠 onEnd 才知道「念完了、可以开始判对错」，
   如果 onEnd 不触发，游戏会永远停在准备期 = 白屏等。所以这条必须测。 */
const Sp = evalIn('SpeechManager');
// 语音被家长关掉时，走的是 setTimeout(onEnd, 300) 这条兜底
evalIn('SpeechManager.setEnabled(false)');
let endedWhenOff = 0;
Sp.speak('先摸红色的苹果，再摸蓝色的汽车', () => endedWhenOff++);
await new Promise(r => setTimeout(r, 400));
ok('语音关闭时 onEnd 仍会触发（不会卡住游戏）', endedWhenOff === 1);
evalIn('SpeechManager.setEnabled(true)');
// 支持语音时：onEnd 最多在 1200 + 字数*220 ms 后兜底触发
let endedWhenOn = 0;
Sp.speak('一二三四五', () => endedWhenOn++);
await new Promise(r => setTimeout(r, 300));
ok('语音开启时不会重复触发 onEnd', endedWhenOn === 0);
await new Promise(r => setTimeout(r, 2600));
ok('语音开启时兜底一定会触发 onEnd', endedWhenOn === 1);

/* ---- 三个新游戏都能正常构建（抓运行期异常） ---- */
for (const id of ['memory-match', 'shadow-match', 'listen-do']) {
  const g = GM.getAll().find(x => x.id === id);
  try {
    const st = document.createElement('div');
    st.isConnected = true;
    st.children = [];
    // querySelectorAll 桩返回空数组，fill/paint 循环要能安全跑完
    g.start(st, GM.api);
    ok('游戏[' + id + '] start() 不抛错', st.children.length > 0);
  } catch (e) {
    ok('游戏[' + id + '] start() 不抛错 → ' + e.message, false);
  }
}

/* ---- 三个新游戏都用了 rounds（应该注册了进度点） ---- */
ok('rounds 生成的进度点数量正确', (() => {
  const g = GM.getAll().find(x => x.id === 'memory-match');
  const st = document.createElement('div'); st.isConnected = true;
  g.start(st, GM.api);
  const box = st.children[0];
  return box.children[0].children.length === 3; // total: 3 → 3 个点
})());

// 直接构建三个关卡，捕获运行期异常（定位白屏根因）
const Levels = evalIn('LG_Levels');
ok('LG 关卡都有玩法提示', Levels.levels.every(lv => typeof lv.tip === 'string' && lv.tip.length > 0));
Levels.levels.forEach(lv => {
  try {
    const mockStage = document.createElement('div');
    lv.build(mockStage, { config: evalIn('LG_CONFIG'), onClear() {} });
    ok('关卡[' + lv.id + '] 构建不抛错', true);
  } catch (e) {
    ok('关卡[' + lv.id + '] 构建不抛错 → ' + e.message, false);
  }
});
// 新版每关都有进度条；这是「多波/多题」没有悄悄退回单题模式的最低保障。
const hasClass = (el, name) =>
  (el.className || '').split(/\s+/).includes(name) || (el.children || []).some(child => hasClass(child, name));
Levels.levels.forEach(lv => {
  const mockStage = document.createElement('div');
  lv.build(mockStage, { config: evalIn('LG_CONFIG'), onClear() {} });
  ok('关卡[' + lv.id + '] 有进度条', hasClass(mockStage, 'lg-missionbar'));
});
ok('LG 语音开关挂到 window 可供 VoiceManager 读取', sandbox.LG_Store === evalIn('LG_Store'));
ok('LG 游戏实现退出清理接口', typeof GM.getAll().find(g => g.id === 'light-guardian').stop === 'function');
// 当前仓库无预录音频；回退时必须念题，不能只给孩子一串无语义的提示音。
const V = evalIn('VoiceManager');
const originalSpeak = Sp.speak;
const said = [];
Sp.speak = text => said.push(text);
S.set('soundOn', true);
V.play('compare');
ok('LG 缺录音时会朗读比较题', said.some(text => text.includes('哪一边更多')));
S.set('soundOn', false);
V.play('count');
ok('LG 关闭声音后不再朗读', said.length === 1);
S.set('soundOn', true);
Sp.speak = originalSpeak;
V.stop();

/* ---- 社区试玩：移动、障碍、接任务、解决线索、回访、奖励、退出清理 ---- */
const findAll = (root, cls) => {
  const found = [];
  const walk = el => {
    if ((el.className || '').split(/\s+/).includes(cls)) found.push(el);
    (el.children || []).forEach(walk);
  };
  walk(root);
  return found;
};
const rpg = GM.getAll().find(g => g.id === 'community-helper');
const village = document.createElement('div'); village.isConnected = true;
const originalInterval = sandbox.setInterval;
const rpgIntervals = new Map();
let rpgTimerId = 1;
sandbox.setInterval = fn => { const id = rpgTimerId++; rpgIntervals.set(id, fn); return id; };
sandbox.clearInterval = id => rpgIntervals.delete(id);
function walkTo(kind, root = village) {
  const sprite = findAll(root, 'village-actor').find(el => el.dataset.kind === kind);
  if (!sprite) throw new Error('找不到社区目标: ' + kind);
  sprite.click();
  let turns = 0;
  while (rpgIntervals.size && turns++ < 120) {
    for (const fn of [...rpgIntervals.values()]) fn();
  }
  if (rpgIntervals.size) throw new Error('自动寻路未能走到: ' + kind);
}
function chooseVillage(text, root = village) {
  const btn = findAll(root, 'village-choice').find(el => el.textContent.includes(text));
  if (!btn) throw new Error('找不到剧情选项: ' + text);
  btn.click();
}
try {
  rpg.start(village, GM.api);
  ok('社区生成 12x8 地图和 7 个目标',
    findAll(village, 'village-tile').length === 96 && findAll(village, 'village-actor').length === 7);
  const player = findAll(village, 'village-player')[0];
  const before = player.style.top;
  document.dispatch('keydown', { key: 'ArrowUp', preventDefault() {} });
  document.dispatch('keyup', { key: 'ArrowUp' });
  ok('方向键移动角色', player.style.top !== before);
  const water = findAll(village, 'village-tile').find(el => el.dataset.x === 5 && el.dataset.y === 2);
  const position = player.style.left + player.style.top;
  water.click();
  ok('水池不能直接穿过', player.style.left + player.style.top === position);
  const padRight = findAll(village, 'village-dir').find(el => el.className.includes('right'));
  padRight.dispatch('pointerdown', { preventDefault() {} });
  padRight.dispatch('pointerup');
  ok('触屏方向盘可推动角色', player.style.left + player.style.top !== position);
  walkTo('rabbit');
  ok('小兔发布任务并给两条故事选择', findAll(village, 'village-choice').length === 2);
  document.dispatch('keydown', { key: 'ArrowRight', target: document.activeElement, preventDefault() {} });
  ok('遥控器左右键切换剧情选项焦点', document.activeElement.textContent.includes('先找水壶'));
  chooseVillage('先看花');
  walkTo('flower');
  chooseVillage('干干的');
  walkTo('can');
  walkTo('flower');
  ok('浇水后花真的变成盛开的花',
    findAll(village, 'village-actor').find(el => el.dataset.kind === 'flower').children[0].textContent === '🌻');
  walkTo('rabbit');
  ok('回访小兔得到园丁贴纸', JSON.parse(store['ch_stickers'])[0] === 'ch-garden' &&
    findAll(village, 'village-mission')[0].textContent.includes('✓'));
  walkTo('post');
  walkTo('parcel');
  walkTo('circle');
  ok('圆圈门牌会解释线索，不错误投递', !findAll(village, 'village-mission')[1].textContent.includes('✓'));
  walkTo('star');
  walkTo('post');
  ok('投递成功回访后得到邮递员贴纸',
    findAll(village, 'village-mission')[1].textContent.includes('✓') &&
    JSON.parse(store['ch_stickers'])[1] === 'ch-post');
  rpg.stop();
  ok('退出社区后移除键盘监听且不留自动寻路', rpgIntervals.size === 0 &&
    (docEvents.keydown || []).length === 1); // 光之小卫士全局焦点监听仍在
  const secondVillage = document.createElement('div'); secondVillage.isConnected = true;
  rpg.start(secondVillage, GM.api);
  walkTo('rabbit', secondVillage);
  chooseVillage('先找水壶', secondVillage);
  walkTo('can', secondVillage);
  walkTo('flower', secondVillage);
  chooseVillage('干干的', secondVillage);
  walkTo('flower', secondVillage);
  ok('先拿水壶再观察也能浇水',
    findAll(secondVillage, 'village-actor').find(el => el.dataset.kind === 'flower').children[0].textContent === '🌻');
  walkTo('rabbit', secondVillage);
  ok('重复游玩不重复写入已获得的园丁贴纸', JSON.parse(store['ch_stickers']).length === 2);
  rpg.stop();
} catch (e) {
  ok('社区完整游玩 → ' + e.message, false);
  rpg.stop();
} finally {
  sandbox.setInterval = originalInterval;
  sandbox.clearInterval = clearInterval;
}

/* ---- 光之小卫士：关卡可实际玩完，不只是构建不报错 ---- */
const pending = [];
const originalSetTimeout = sandbox.setTimeout;
sandbox.setTimeout = (fn, ms) => { pending.push(fn); return pending.length; };
function flushTimers() {
  let count = 0;
  while (pending.length && count++ < 100) pending.shift()();
  if (count >= 100) throw new Error('关卡的延迟任务出现无限循环');
}
function playLevel(id, play) {
  const stage = document.createElement('div');
  stage.isConnected = true;
  let clears = 0;
  Levels.levels.find(lv => lv.id === id).build(stage, { config: evalIn('LG_CONFIG'), onClear() { clears++; } });
  play(stage, flushTimers);
  ok('关卡[' + id + '] 实际完成后只触发一次 onClear', clears === 1);
}
try {
  evalIn("LG_Store.set('difficulty', 1)");
  playLevel('transform', (stage, flush) => {
    for (let wave = 0; wave < 2; wave++) {
      const host = findAll(stage, 'lg-wavehost')[0];
      const board = host.children[host.children.length - 1];
      const left = findAll(board, 'lg-beast');
      const right = findAll(board, 'lg-friend');
      left.forEach(gray => {
        const friend = right.find(btn => btn.dataset.id === gray.dataset.id);
        gray.click(); friend.click();
      });
      flush();
    }
  });
  evalIn("LG_Store.set('difficulty', 1)");
  playLevel('count', (stage, flush) => {
    for (let task = 0; task < 3; task++) {
      const answer = findAll(stage, 'lg-lightray').length;
      const btn = findAll(stage, 'lg-count-option').find(b => b.textContent === String(answer));
      if (!btn) throw new Error('数数题没有对应的正确数字选项: ' + answer);
      btn.click(); flush();
    }
  });
  evalIn("LG_Store.set('difficulty', 2)");
  sandbox.originalRandomForLGTest = evalIn('Math.random');
  playLevel('count', (stage, flush) => {
    for (let task = 0; task < 4; task++) {
      const scene = findAll(stage, 'lg-count-scene')[0];
      let label;
      if (scene.className.includes('compare')) {
        const groups = findAll(scene, 'lg-count-group');
        const left = findAll(groups[0], 'lg-count-ray').length;
        const right = findAll(groups[1], 'lg-count-ray').length;
        label = left === right ? '一样多' : left > right ? '⬅️ 更多' : '➡️ 更多';
      } else {
        label = String(findAll(scene, 'lg-lightray').length);
      }
      const btn = findAll(stage, 'lg-count-option').find(b => b.textContent === label);
      if (!btn) throw new Error('比较题找不到正确选项: ' + label);
      if (task === 1) ok('比较题一样多分支可选', label === '一样多');
      // 第一次答题后的下一题固定生成等量两边，其余随机逻辑保持真实运行。
      if (task === 0) evalIn('Math.random = () => 0.1');
      try { btn.click(); flush(); }
      finally { if (task === 0) evalIn('Math.random = originalRandomForLGTest'); }
    }
  });
  evalIn("LG_Store.set('difficulty', 1)");
  playLevel('breathe', (stage, flush) => {
    const btn = findAll(stage, 'lg-bigbtn')[0];
    for (let cycle = 0; cycle < 3; cycle++) { btn.click(); flush(); }
    ok('呼吸完成后点亮 3 颗星', findAll(stage, 'lg-breath-star').filter(el => el._cls.has('lit')).length === 3);
  });
} catch (e) {
  ok('LG 三关交互流程 → ' + e.message, false);
} finally {
  sandbox.setTimeout = originalSetTimeout;
  if (sandbox.originalRandomForLGTest) evalIn('Math.random = originalRandomForLGTest');
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
}

main().catch(e => { console.error('测试自身崩了：', e); process.exit(1); });

/* ============================================================
 * Store —— 全平台共享存储层
 *
 * 为什么要有这个文件（背景）：
 *   之前只有「光之小卫士」需要存东西，所以 localStorage 的读写、
 *   贴纸墙、连对升难/连错降难，全都写死在 light-guardian/store.js 里。
 *   结果新游戏想加一个「翻牌配对」也得存进度时，只能再抄一遍，
 *   抄出来的第二份和第一份迟早会不一致。
 *
 * 这一层把三件事收到引擎里，任何游戏都能用：
 *   1) 命名空间存储   Store.create('mm_')  → 自己的 get/set，互不串味
 *   2) 连对升难/连错降难  reportCorrect() / reportWrong()
 *   3) 跨游戏贴纸墙    Store.wall —— 各游戏注册自己的贴纸册，墙只汇总展示
 *
 * 两条设计原则（和项目既有风格一致）：
 *   - 绝不抛错：localStorage 在隐私模式/禁用存储时会抛异常，
 *     这里全部包了 try/catch 并降级到内存，页面绝不白屏。
 *   - 键名保持不变：light-guardian 原来用 lg_ 前缀、difficulty / stickers /
 *     todayMinutes 三个键。这里前缀和键名都不改，老存档直接接着用。
 * ============================================================ */
const Store = (function () {

  /* ---------- localStorage 安全封装 ---------- */
  // 隐私模式下 localStorage.setItem 会抛 QuotaExceededError。
  // 存不进去就退到内存：本次游玩照常，刷新后丢失，但页面不崩。
  const mem = {};
  function lsGet(k) {
    try { return localStorage.getItem(k); }
    catch (e) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, v); }
    catch (e) { mem[k] = v; }
  }

  // 今日分钟按日期分组，跨天自动归零
  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  /* ---------- 跨游戏贴纸墙 ----------
   * 墙只做「汇总展示」，不负责发贴纸：
   *   - 发贴纸由各游戏自己的 store.grantNewSticker() 负责（各管各的存档）
   *   - 展示时每个包传一个 owned()，墙实时去问它要，避免读出一份过期副本
   * 这样光之小卫士保留自己的 lg_stickers 老存档，不用做数据迁移。
   */
  const packs = [];
  const wall = {
    register(pack) {
      if (!pack || !pack.id || !Array.isArray(pack.items)) {
        console.warn('[Store] 忽略无效的贴纸包', pack); return;
      }
      if (packs.some(p => p.id === pack.id)) return;  // 重复注册直接忽略，不报错
      packs.push(pack);
    },
    // 拉平成一格一格的列表，首页直接渲染
    cells() {
      const out = [];
      packs.forEach(p => {
        let got = [];
        try { got = (typeof p.owned === 'function' && p.owned()) || []; } catch (e) { got = []; }
        p.items.forEach(it => out.push({
          packId: p.id, name: it.name, emoji: it.emoji,
          got: got.indexOf(it.id) >= 0,
        }));
      });
      return out;
    },
    stats() {
      const c = wall.cells();
      return { got: c.filter(x => x.got).length, total: c.length };
    },
  };

  /* ---------- 创建一份带命名空间的 store ---------- */
  // prefix: 键前缀，如 'mm_'。所有键都会带上它，不同游戏互不覆盖。
  // opts.difficulty: { min, max, upStreak, downStreak } 缺省用 DEFAULT_DIFFICULTY
  // opts.stickers:   [{ id, emoji, name }]，本游戏的贴纸册
  function create(prefix, opts) {
    opts = opts || {};
    const d = Object.assign({}, DEFAULT_DIFFICULTY, opts.difficulty);
    const stickers = Array.isArray(opts.stickers) ? opts.stickers : [];

    // 连对/连错计数只放内存，不落盘：
    // 和原来 LG_Store 的行为一致（刷新页面重新计数），也避免孩子
    // 关掉页面就「攒好了一次降难」被白白降级。
    let okStreak = 0, badStreak = 0;

    function get(key, def) {
      const raw = lsGet(prefix + key);
      if (raw === null || raw === undefined) return def;
      try { return JSON.parse(raw); } catch (e) { return raw; }
    }
    function set(key, val) { lsSet(prefix + key, JSON.stringify(val)); }
    function del(key) { try { localStorage.removeItem(prefix + key); } catch (e) { delete mem[prefix + key]; } }

    /* ---- 今日游玩分钟 ---- */
    function getTodayMinutes() {
      const rec = get('todayMinutes', { date: '', min: 0 });
      if (!rec || rec.date !== todayKey()) return 0;   // 跨天 → 归零
      return rec.min || 0;
    }
    function addTodayMinutes(min) {
      const cur = getTodayMinutes();
      set('todayMinutes', { date: todayKey(), min: cur + min });
    }

    /* ---- 贴纸：优先发没拿过的，全集齐了再随机重复 ---- */
    function getStickers() { return get('stickers', []); }
    function grantNewSticker() {
      if (!stickers.length) return { sticker: null, isNew: false };
      const owned = getStickers();
      const locked = stickers.filter(s => owned.indexOf(s.id) < 0);
      const pick = locked.length
        ? locked[Math.floor(Math.random() * locked.length)]
        : stickers[Math.floor(Math.random() * stickers.length)];
      const isNew = owned.indexOf(pick.id) < 0;
      if (isNew) set('stickers', owned.concat([pick.id]));
      return { sticker: pick, isNew };
    }

    /* ---- 难度：连对升、连错降，永不出现「失败」概念 ---- */
    function getLevel() { return get('difficulty', d.min); }
    function setLevel(v) { set('difficulty', Math.max(d.min, Math.min(d.max, v))); }
    function reportCorrect() {
      okStreak++; badStreak = 0;
      if (okStreak >= d.upStreak) { okStreak = 0; setLevel(getLevel() + 1); }
    }
    function reportWrong() {
      badStreak++; okStreak = 0;
      if (badStreak >= d.downStreak) { badStreak = 0; setLevel(getLevel() - 1); }
    }

    return {
      prefix, get, set, del,
      getTodayMinutes, addTodayMinutes,
      getStickers, grantNewSticker,
      getLevel, setLevel, reportCorrect, reportWrong,
    };
  }

  // 缺省难度参数：沿用光之小卫士原来的数值，改动最小
  const DEFAULT_DIFFICULTY = { min: 1, max: 3, upStreak: 3, downStreak: 2 };

  return { create, wall, todayKey, DEFAULT_DIFFICULTY };
})();

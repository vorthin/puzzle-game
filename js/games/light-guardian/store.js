/* ============================================================
 * LG_Store — 存档 + 难度系统
 *
 * 这条是「本游戏只做适配，不重复造轮子」：
 *   真正的读写、贴纸去重、连对升难，都在引擎层的 Store.js 里了。
 *   这里只做两件事：
 *     1) 用原来的 lg_ 前缀和键名包一层，老存档直接接着用，不用迁移
 *     2) 把贴纸册注册到平台贴纸墙，首页 🏅 里能一起看到
 *   对外接口（get/set/getStickers/grantNewSticker/getLevel/...）
 *   和以前完全一样，light-guardian 其它文件一行都不用改。
 *
 * 依赖：LG_CONFIG、Store
 * ============================================================ */
const LG_Store = (function () {
  const s = Store.create('lg_', {
    difficulty: LG_CONFIG.difficulty,
    stickers: LG_CONFIG.stickers,
  });

  // 注册到平台贴纸墙。owned 用闭包实时去问 s.getStickers()，
  // 避免读出一份会过期的副本。
  Store.wall.register({
    id: 'light-guardian',
    title: '光之小卫士',
    items: LG_CONFIG.stickers,
    owned: () => s.getStickers(),
  });

  return {
    get: s.get,
    set: s.set,
    getTodayMinutes: s.getTodayMinutes,
    addTodayMinutes: s.addTodayMinutes,
    getStickers: s.getStickers,
    grantNewSticker: s.grantNewSticker,
    getLevel: s.getLevel,
    reportCorrect: s.reportCorrect,
    reportWrong: s.reportWrong,
  };
})();

// voice.js 通过 window.LG_Store 读取声音开关；const 不会自动成为 window 属性，
// 显式挂出是为了让家长设置里的「声音关闭」真的生效，而不是只改了界面。
if (typeof window !== 'undefined') window.LG_Store = LG_Store;

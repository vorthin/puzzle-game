/* ============================================================
 * 《光之小卫士》配置文件 —— 换皮 / 调参只改这里
 *
 * 命名遵循需求：hero（小卫士）、energyBeast（能量兽）
 * 想换成别的主题（比如"星星精灵"），基本只改本文件的文字、
 * 颜色、emoji 和语音清单即可，逻辑代码不用动。
 * ============================================================ */
const LG_CONFIG = {

  /* ---- 主题外观（红银蓝 + 胸前能量灯，参考奥特曼但非暴力） ---- */
  theme: {
    heroName: '光之小卫士',
    red:   '#e63946',   // 红
    silver:'#d9dde3',   // 银
    blue:  '#1d7fe0',   // 蓝
    energyLamp: '#ffd23f', // 胸前能量灯（黄）
    focus: '#ffd23f',   // 焦点框颜色（8px 黄色）
    bgTop: '#0b1e4d',   // 光之国夜空
    bgBottom: '#3a6fd8',
  },

  /* ---- 主角与能量兽的外形（用 emoji 拼，方便自用/换皮） ---- */
  hero: {
    face: '🦸',         // 小卫士（占位，后续可换成图片）
  },

  // 能量兽：净化前是灰的（用文字描述+emoji），净化后变彩色
  energyBeast: {
    kinds: [
      { id: 'bunny', gray: '🐰', color: '🐰', tint: '#ff8fab', name: '兔兔' },
      { id: 'bear',  gray: '🐻', color: '🐻', tint: '#ffb703', name: '熊熊' },
      { id: 'cat',   gray: '🐱', color: '🐱', tint: '#8ecae6', name: '喵喵' },
      { id: 'frog',  gray: '🐸', color: '🐸', tint: '#95d5b2', name: '呱呱' },
      { id: 'chick', gray: '🐥', color: '🐥', tint: '#ffd23f', name: '啾啾' },
      { id: 'pig',   gray: '🐷', color: '🐷', tint: '#ffafcc', name: '噜噜' },
    ],
  },

  /*
   * 每关的短提示放配置而不是写死在流程里，理由是：
   * 关卡以后换主题时只需要换这组文案，玩法代码不会被宣传语污染；
   * 同时首页和关卡内可以共用同一套「孩子要做什么」说明。
   */
  levelInfo: {
    transform: { tip: '配对光之伙伴，收集友谊光' },
    count:     { tip: '数一数、比一比，找到更多的光' },
    // 呼吸是放松练习，不应该因为难度升高而催孩子加快；只增加轮数，保持舒适节奏。
    breathe:   { tip: '跟着能量灯呼吸，点亮星星', cycleMs: 2600 },
  },

  /* ---- 计时（分钟）。第10条：连对升难度、连错降难度 ---- */
  timer: {
    defaultMinutes: 10,   // 单次默认时长
    remindAt: 5,          // 5 分钟提醒
    previewAt: 1,         // 剩 1 分钟预告
  },

  /* ---- 难度：连续正确 up 次升级，连续错误 down 次降级 ---- */
  difficulty: {
    upStreak: 3,
    downStreak: 2,
    min: 1,
    max: 3,
  },

  /* ---- 语音清单（预录音频，放 assets/voice/ 下）----
     文件不存在时自动降级为合成提示音，不报错。
     以后录好真实 mp3，文件名对上即可，无需改代码。 */
  voice: {
    dir: 'assets/voice/',
    clips: {
      welcome:   'welcome.mp3',      // 欢迎来到光之国
      pickLevel: 'pick_level.mp3',   // 选一个关卡吧
      transform: 'transform.mp3',    // 变身！
      good:      'good.mp3',         // 你真棒
      tryAgain:  'try_again.mp3',    // 再试试
      count:     'count.mp3',        // 数一数有几个
      compare:   'compare.mp3',      // 哪边的光更多？一样多也可以选中间
      breathe:   'breathe.mp3',      // 跟我一起深呼吸
      breatheIn: 'breathe_in.mp3',   // 吸气
      breatheOut:'breathe_out.mp3',  // 呼气
      purified:  'purified.mp3',     // 能量兽变彩色啦
      remind5:   'remind5.mp3',      // 还可以玩五分钟
      preview1:  'preview1.mp3',     // 还有一分钟就休息啦
      yawn:      'yawn.mp3',         // 打哈欠：该休息啦
      sticker:   'sticker.mp3',      // 获得新贴纸
    },
  },

  /* ---- 结束页给孩子的现实任务（第6条），随机抽一条 ---- */
  realTasks: [
    { icon: '💧', text: '去喝一大口水' },
    { icon: '🤗', text: '给家人一个大大的抱抱' },
    { icon: '⭕', text: '在家里找出 3 个圆形的东西' },
    { icon: '🧸', text: '把 5 个玩具收进箱子里' },
    { icon: '🌱', text: '看看窗外，找一样绿色的东西' },
    { icon: '🦶', text: '学小兔子跳 5 下' },
  ],

  /* ---- 贴纸墙（第7条：本地贴纸，不给无限金币） ---- */
  stickers: [
    { id: 's1', emoji: '⭐', name: '星星' },
    { id: 's2', emoji: '🌈', name: '彩虹' },
    { id: 's3', emoji: '🚀', name: '火箭' },
    { id: 's4', emoji: '🌟', name: '闪星' },
    { id: 's5', emoji: '💎', name: '宝石' },
    { id: 's6', emoji: '🏅', name: '奖章' },
    { id: 's7', emoji: '🎈', name: '气球' },
    { id: 's8', emoji: '👑', name: '皇冠' },
    { id: 's9', emoji: '🦄', name: '独角兽' },
  ],
};

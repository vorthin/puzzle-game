/* ============================================================
 * VoiceManager —— 语音管理器（预录音频，不用浏览器 TTS）
 *
 * 需求第8条要求用预录音频。做法：
 *   - 所有语音都是 assets/voice/ 下的 mp3（清单见 config.js）
 *   - 页面加载时预加载，播放时直接放
 *   - 若某个 mp3 文件缺失/加载失败 → 先用浏览器中文朗读引导，
 *     不支持朗读时再降级为柔和提示音。孩子不识字，不能只用提示音代替题目。
 *     以后补上真实 mp3 即可自动优先播放录音。
 *
 * 依赖：LG_CONFIG.voice、LG_Store（读取声音开关）、SpeechManager
 * ============================================================ */
const VoiceManager = (function () {
  const cfg = LG_CONFIG.voice;
  const cache = {};       // key -> HTMLAudioElement
  const available = {};   // key -> bool，该 mp3 是否真的可用
  const guideText = {
    welcome: '欢迎来到光之小卫士',
    pickLevel: '选一个任务吧',
    transform: '先点灰色能量兽，再点它的彩色伙伴',
    good: '做得真棒',
    tryAgain: '再试试，慢慢来',
    count: '数一数有几束光',
    compare: '哪一边更多？如果一样多，选中间',
    breathe: '跟着能量灯，慢慢吸气和呼气',
    breatheIn: '慢慢吸气',
    breatheOut: '慢慢呼气',
    purified: '能量兽变彩色啦',
    remind5: '还可以玩一会儿',
    preview1: '还有一分钟就要休息啦',
    yawn: '今天玩得真棒，该休息啦',
    sticker: '获得了一张新贴纸',
  };

  // Web Audio 降级提示音（不同语义给不同音高，友好不刺耳）
  let ac = null;
  let generation = 0;
  function tone(freqs, request) {
    freqs.forEach((f, i) => {
      setTimeout(() => {
        if (request !== generation || !soundOn()) return;
        try {
          ac = ac || new (window.AudioContext || window.webkitAudioContext)();
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = 'sine'; o.frequency.value = f;
          o.connect(g); g.connect(ac.destination);
          g.gain.setValueAtTime(0.12, ac.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25);
          o.start(); o.stop(ac.currentTime + 0.25);
        } catch (e) {}
      }, i * 130);
    });
  }
  // 不同语音 key 的降级音型
  const fallbackTones = {
    good:     [660, 880],
    purified: [523, 659, 784, 1046],
    sticker:  [784, 988, 1318],
    tryAgain: [330],
    yawn:     [440, 392, 330],
    _default: [523, 659],
  };

  function preload() {
    Object.keys(cfg.clips).forEach(key => {
      const src = cfg.dir + cfg.clips[key];
      const a = new Audio();
      a.preload = 'auto';
      a.src = src;
      a.addEventListener('canplaythrough', () => { available[key] = true; }, { once: true });
      a.addEventListener('error', () => { available[key] = false; }, { once: true });
      cache[key] = a;
    });
  }

  function soundOn() {
    // 没有 Store 时默认开
    return !window.LG_Store || LG_Store.get('soundOn', true);
  }

  function play(key) {
    if (!soundOn()) return;
    // 每个提示只留最后一句；异步音频拒播和多音提示不能在离开后又响起来。
    stop();
    const request = generation;
    const a = cache[key];
    if (a && available[key]) {
      try {
        const playing = a.play();
        if (playing && typeof playing.catch === 'function')
          playing.catch(() => { if (request === generation) fallback(key); });
      } catch (e) { if (request === generation) fallback(key); }
    } else {
      fallback(key);
    }
  }

  function fallback(key) {
    if (!soundOn()) return;
    if (guideText[key] && typeof SpeechManager !== 'undefined' &&
        SpeechManager.supported() && SpeechManager.isEnabled()) {
      SpeechManager.speak(guideText[key]);
    } else {
      tone(fallbackTones[key] || fallbackTones._default, generation);
    }
  }

  function stop() {
    // 离开小游戏时停止录音与朗读；否则回首页后旧语音还会继续播。
    generation++;
    Object.keys(cache).forEach(key => {
      try { cache[key].pause(); cache[key].currentTime = 0; } catch (e) {}
    });
    if (typeof SpeechManager !== 'undefined') SpeechManager.stop();
  }

  return { preload, play, stop };
})();

/* ============================================================
 * AudioManager —— 音效管理器
 * 用 Web Audio 实时合成音效，不依赖任何音频文件，保持项目轻量。
 * 对外只暴露几个语义化方法：good() / soft() / win()
 * ============================================================ */
const AudioManager = (function () {
  let ctx = null;

  // 惰性创建音频上下文（浏览器要求用户交互后才能创建）
  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { ctx = null; }
    }
    return ctx;
  }

  // 播放一个单音
  function beep(freq, dur, type) {
    const c = ensure();
    if (!c) return;
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(c.destination);
      gain.gain.setValueAtTime(0.15, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      osc.start();
      osc.stop(c.currentTime + dur);
    } catch (e) {}
  }

  return {
    // 答对：两个上扬的音
    good() { beep(660, 0.12); setTimeout(() => beep(880, 0.18), 110); },
    // 温柔提示（答错时用，绝不刺耳）
    soft() { beep(330, 0.15, 'triangle'); },
    // 通关：一小段上行音阶
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.2), i * 130)); },
    // 通用自定义
    beep,
  };
})();

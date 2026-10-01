/* ============================================================
 * SpeechManager —— 语音管理器
 * 用浏览器自带的语音合成（SpeechSynthesis）朗读中文引导。
 * 3-6岁孩子大多不识字，所有引导都靠它念出来。
 * ============================================================ */
const SpeechManager = (function () {
  let enabled = true;

  function supported() { return 'speechSynthesis' in window; }

  // onEnd 可选：朗读结束时回调。用来「念完题目再让孩子操作」，
  // 避免孩子手比声音快。旧代码只传一个参数，行为完全不变。
  function speak(text, onEnd) {
    if (!enabled || !supported() || !text) { if (onEnd) setTimeout(onEnd, 300); return; }
    try {
      window.speechSynthesis.cancel();           // 打断上一句，避免排队堆积
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN';
      u.rate = 0.9;   // 稍慢，适合小孩
      u.pitch = 1.2;  // 稍高，更亲切

      // 部分设备/浏览器不触发 onend，用「字数 × 220ms + 1.2s」兜底，
      // 保证 onEnd 一定会被调用一次，调用方不用自己写超时。
      let fired = false;
      let guard = null;
      function fire() {
        if (fired) return;
        fired = true;
        if (guard) clearTimeout(guard);
        if (onEnd) onEnd();
      }
      u.onend = fire;
      u.onerror = fire;
      guard = setTimeout(fire, 1200 + text.length * 220);

      window.speechSynthesis.speak(u);
    } catch (e) { if (onEnd) setTimeout(onEnd, 300); }
  }

  function stop() { try { window.speechSynthesis.cancel(); } catch (e) {} }

  return {
    speak,
    supported,
    stop,
    setEnabled(v) { enabled = !!v; if (!enabled) stop(); },
    isEnabled() { return enabled; },
  };
})();

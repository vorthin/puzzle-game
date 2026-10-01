/* ============================================================
 * TimerManager —— 时间限制 / 防沉迷管理器
 * 家长设定每次可玩时长，到点温柔提示并锁定。
 * 通过回调把「提前提醒」「时间到」通知给外部（UI 层）。
 * ============================================================ */
const TimerManager = (function () {
  let limitMin = parseInt(localStorage.getItem('limitMin') || '20', 10);
  let sessionStart = Date.now();
  let warned = false;
  let onWarn = null;    // 提前1分钟回调
  let onTimeUp = null;  // 时间到回调

  function elapsedMin() { return (Date.now() - sessionStart) / 60000; }
  function remainMin() { return Math.max(0, limitMin - elapsedMin()); }

  function reset() {
    sessionStart = Date.now();
    warned = false;
  }

  function setLimit(min) {
    limitMin = min;
    localStorage.setItem('limitMin', String(min));
  }
  function getLimit() { return limitMin; }

  // 是否已超时（供进入游戏前检查）
  function isTimeUp() { return elapsedMin() >= limitMin; }

  // 每15秒检查一次：提前提醒 + 到点触发
  setInterval(function () {
    const e = elapsedMin();
    if (!warned && e >= limitMin - 1 && e < limitMin) {
      warned = true;
      if (onWarn) onWarn();
    }
    if (e >= limitMin && onTimeUp) onTimeUp();
  }, 15000);

  return {
    reset,
    setLimit,
    getLimit,
    isTimeUp,
    remainMin,
    onWarn(fn) { onWarn = fn; },
    onTimeUp(fn) { onTimeUp = fn; },
  };
})();

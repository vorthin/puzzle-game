/* ============================================================
 * LG_Focus —— 焦点导航（电视遥控器 / 键盘 / 触摸 三合一）
 *
 * 需求：方向键移动焦点，Enter/OK 确认，Esc/返回暂停。
 *       焦点框 8px 黄色（样式在 CSS 的 .lg-focusable.focused）。
 *
 * 用法：
 *   LG_Focus.setScope(容器DOM)  —— 把该容器内所有 .lg-focusable 纳入导航
 *   给可交互元素加 class="lg-focusable"，点击逻辑绑在元素的 click 上
 *   （Enter 会触发被聚焦元素的 click，触摸/鼠标点击也照常工作）
 *   LG_Focus.onBack(fn) —— Esc/返回键回调（用于暂停）
 * ============================================================ */
const LG_Focus = (function () {
  let scope = document;
  let items = [];
  let idx = -1;
  let backHandler = null;

  function refresh() {
    items = [...scope.querySelectorAll('.lg-focusable')].filter(el =>
      el.offsetParent !== null && !el.disabled);
    if (items.length === 0) { idx = -1; return; }
    if (idx < 0 || idx >= items.length) idx = 0;
    highlight();
  }

  function highlight() {
    items.forEach(el => el.classList.remove('focused'));
    if (idx >= 0 && items[idx]) {
      items[idx].classList.add('focused');
      items[idx].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function setScope(el) {
    scope = el || document;
    idx = 0;
    refresh();
  }

  // 基于屏幕坐标找「某方向上最近的」元素，做二维方向导航
  function move(dir) {
    if (items.length === 0) return;
    if (idx < 0) { idx = 0; highlight(); return; }
    const cur = items[idx].getBoundingClientRect();
    const cx = cur.left + cur.width / 2, cy = cur.top + cur.height / 2;
    let best = -1, bestScore = Infinity;
    items.forEach((el, i) => {
      if (i === idx) return;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      const dx = x - cx, dy = y - cy;
      let ok = false;
      if (dir === 'left' && dx < -5) ok = true;
      if (dir === 'right' && dx > 5) ok = true;
      if (dir === 'up' && dy < -5) ok = true;
      if (dir === 'down' && dy > 5) ok = true;
      if (!ok) return;
      // 主方向距离为主，垂直偏移加权惩罚
      const main = (dir === 'left' || dir === 'right') ? Math.abs(dx) : Math.abs(dy);
      const cross = (dir === 'left' || dir === 'right') ? Math.abs(dy) : Math.abs(dx);
      const score = main + cross * 2;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best >= 0) { idx = best; highlight(); }
  }

  function confirm() {
    if (idx >= 0 && items[idx]) items[idx].click();
  }

  function onBack(fn) { backHandler = fn; }

  function clear() {
    // 离开小游戏后不能继续让旧焦点接管平台方向键，也不能让旧的返回回调响应。
    items.forEach(el => el.classList.remove('focused'));
    items = [];
    idx = -1;
    backHandler = null;
    scope = { querySelectorAll: () => [], contains: () => false };
  }

  // 键盘 / 遥控器（多数电视遥控器映射为方向键 + Enter；返回键常为 Esc 或 Backspace）
  document.addEventListener('keydown', function (e) {
    // 只有当前作用域内确实有可聚焦元素时才接管方向/确认键，
    // 避免在平台首页或其它游戏里误吞按键。
    const activeNav = items.length > 0;
    switch (e.key) {
      case 'ArrowLeft':  if (activeNav) { move('left');  e.preventDefault(); } break;
      case 'ArrowRight': if (activeNav) { move('right'); e.preventDefault(); } break;
      case 'ArrowUp':    if (activeNav) { move('up');    e.preventDefault(); } break;
      case 'ArrowDown':  if (activeNav) { move('down');  e.preventDefault(); } break;
      case 'Enter':
      case ' ':          if (activeNav && idx >= 0) { confirm(); e.preventDefault(); } break;
      case 'Escape':
      case 'Backspace':
      case 'BrowserBack':
        if (backHandler) { backHandler(); e.preventDefault(); }
        break;
    }
  });

  // 触摸/鼠标悬停时同步焦点位置，体验统一
  document.addEventListener('mouseover', function (e) {
    const t = e.target.closest && e.target.closest('.lg-focusable');
    if (t && scope.contains(t)) {
      const i = items.indexOf(t);
      if (i >= 0) { idx = i; highlight(); }
    }
  });

  return { setScope, refresh, move, confirm, onBack, clear };
})();

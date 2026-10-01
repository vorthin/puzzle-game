/* ============================================================
 * 游戏模块：找不同
 * 玩法：九宫格里有一个和其他不一样，点出来。锻炼专注力 + 观察力。
 * 适合：3-6岁
 * ============================================================ */
GameManager.register({
  id: 'spot-difference',
  name: '找不同',
  icon: '🔍',
  color: 'linear-gradient(135deg,#84fab0,#4fd68a)',
  age: [3, 6],
  title: '找出不一样的那个！',

  start(stage, api) {
    const EMO = ['🍎', '🍊', '🍇', '🍓', '🐶', '🐱', '⭐', '🌸', '🚗', '⚽', '🎈', '🦋'];
    const [same, diff] = api.util.shuffle(EMO).slice(0, 2);
    const diffIndex = api.util.randInt(9);

    const grid = api.util.el('div', 'spot-grid');
    for (let i = 0; i < 9; i++) {
      const cell = api.util.el('div', 'spot-cell', i === diffIndex ? diff : same);
      cell.onclick = () => {
        if (i === diffIndex) {
          cell.classList.add('found');
          api.sound.good();
          setTimeout(() => api.reward(), 400);
        } else {
          cell.style.transform = 'scale(.85)';
          api.sound.soft();
          api.speak('不是这个哦');
          setTimeout(() => (cell.style.transform = ''), 200);
        }
      };
      grid.appendChild(cell);
    }

    stage.appendChild(grid);
    api.speak('找出不一样的那个');
  },
});

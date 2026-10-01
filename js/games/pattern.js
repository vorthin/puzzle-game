/* ============================================================
 * 游戏模块：找规律
 * 玩法：给出 ABAB… 排列，选出问号处应该是哪个。锻炼逻辑推理。
 * 适合：4-6岁
 * ============================================================ */
GameManager.register({
  id: 'pattern',
  name: '找规律',
  icon: '🧩',
  color: 'linear-gradient(135deg,#a1c4fd,#6a9dfd)',
  age: [4, 6],
  title: '接下来应该是哪个呢？',

  start(stage, api) {
    const SETS = [
      ['🔴', '🔵'], ['🍎', '🍌'], ['⭐', '🌙'],
      ['🐶', '🐱'], ['❤️', '💛'], ['🌸', '🌻'],
    ];
    const set = api.util.pick(SETS);

    // 生成长度5的 ABAB… 序列，最后一个作为答案
    const full = [];
    for (let i = 0; i < 5; i++) full.push(set[i % 2]);
    const answer = full[4];

    const seq = api.util.el('div', 'seq');
    for (let i = 0; i < 4; i++) seq.appendChild(api.util.el('div', 'seq-item', full[i]));
    const q = api.util.el('div', 'seq-item seq-q', '❓');
    seq.appendChild(q);

    // 选项：正确答案 + 该组另一个 + 一个无关干扰项
    const others = api.util.shuffle(SETS.flat().filter(x => !set.includes(x)));
    const opts = api.util.shuffle([answer, set[0] === answer ? set[1] : set[0], others[0]]);

    const optBox = api.util.el('div', 'options');
    opts.forEach(o => {
      const b = api.util.el('div', 'opt', o);
      b.onclick = () => {
        if (o === answer) {
          q.textContent = o;
          q.className = 'seq-item';
          api.reward();
        } else {
          b.classList.add('wrong');
          api.sound.soft();
          api.speak('再想想看');
          setTimeout(() => b.classList.remove('wrong'), 400);
        }
      };
      optBox.appendChild(b);
    });

    stage.appendChild(seq);
    stage.appendChild(optBox);
    api.speak('接下来应该是哪个呢');
  },
});

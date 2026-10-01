/* ============================================================
 * 游戏模块：情绪识别
 * 玩法：给一个情境，让孩子选出对应的情绪表情，或选出正确的做法。
 * 锻炼：情绪认知 + 同理心 + 好习惯（这是最有差异化的能力方向）。
 * 适合：3-6岁
 * ============================================================ */
GameManager.register({
  id: 'emotion',
  name: '情绪认知',
  icon: '😊',
  color: 'linear-gradient(135deg,#fbc687,#f6a04d)',
  age: [3, 6],

  start(stage, api) {
    // 两类题：认表情 / 选做法。混在一起随机出。
    const QUESTIONS = [
      { scene: '🎂', ask: '过生日，是什么心情？', good: '😀', bad: '😢', gt: '对啦，是开心！', bt: '再想想，过生日很开心哦' },
      { scene: '🧸', ask: '心爱的玩具坏了，会怎样？', good: '😢', bad: '😀', gt: '嗯，会有点难过', bt: '玩具坏了会难过哦' },
      { scene: '🌧️', ask: '打雷下雨，宝宝会？', good: '😨', bad: '😄', gt: '有点害怕，抱抱就好啦', bt: '打雷会有点怕哦' },
      { scene: '🤝', ask: '小朋友要一起玩，应该？', good: '😊', bad: '😠', gt: '一起玩最开心！', bt: '一起玩才开心呀' },
      { scene: '😡', ask: '生气的时候，应该怎么办？', good: '😮‍💨', bad: '👊', gt: '深呼吸，冷静一下真棒！', bt: '生气也不能打人哦' },
      { scene: '😢', ask: '好朋友哭了，你会？', good: '🤗', bad: '😆', gt: '去安慰他，你真有爱心！', bt: '朋友难过要安慰他哦' },
    ];
    const q = api.util.pick(QUESTIONS);
    api.setTitle(q.ask);

    const scene = api.util.el('div', 'habit-scene', q.scene);
    const acts = api.util.el('div', 'habit-actions');
    api.util.shuffle([
      { e: q.good, ok: true, tip: q.gt },
      { e: q.bad, ok: false, tip: q.bt },
    ]).forEach(ch => {
      const b = api.util.el('button', 'habit-btn', ch.e);
      b.onclick = () => {
        if (ch.ok) {
          scene.style.transform = 'scale(1.2)';
          setTimeout(() => (scene.style.transform = ''), 300);
          api.reward(ch.tip);
        } else {
          api.sound.soft();
          api.speak(ch.tip);
          b.style.transform = 'translateX(-8px)';
          setTimeout(() => (b.style.transform = ''), 200);
        }
      };
      acts.appendChild(b);
    });

    stage.appendChild(scene);
    stage.appendChild(acts);
    api.speak(q.ask);
  },
});

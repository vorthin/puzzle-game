/* ============================================================
 * RewardManager —— 奖励反馈管理器
 * 答对后的正向反馈：弹星星、撒彩带、语音夸奖、通关音效。
 * 设计原则：只有正反馈，答错永远不惩罚。
 * 依赖页面里存在 #reward / #rewardTxt 两个元素。
 * ============================================================ */
const RewardManager = (function () {
  const praises = ['你真棒！', '太厉害了！', '答对啦！', '好聪明呀！', '做得好！'];
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  // 彩带（emoji 飘落）
  function confetti() {
    const emos = ['⭐', '🌟', '✨', '🎉', '💖', '🎈'];
    for (let i = 0; i < 24; i++) {
      const el = document.createElement('div');
      el.className = 'confetti';
      el.textContent = pick(emos);
      el.style.left = Math.random() * 100 + 'vw';
      el.style.top = '-5vh';
      el.style.animationDuration = (1.5 + Math.random() * 1.5) + 's';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3200);
    }
  }

  // msg 可选，不传则随机夸奖
  function show(msg) {
    const box = document.getElementById('reward');
    const text = msg || pick(praises);
    document.getElementById('rewardTxt').textContent = text;
    box.classList.add('show');
    AudioManager.win();
    SpeechManager.speak(text);
    confetti();
    setTimeout(() => box.classList.remove('show'), 1600);
  }

  return { show, confetti };
})();

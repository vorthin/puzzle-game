/* ============================================================
 * LG_Levels —— 光之小卫士的三种任务
 *
 * 本版把原来的「一关一个小题」改成「一关一个短任务」：
 *   1) transform 变身配对：连续净化多波能量兽，收集友谊光
 *   2) count      光线数数：数数量，也比较左右哪边更多
 *   3) breathe    能量灯呼吸：每完成一轮就点亮一颗星星
 *
 * 这样增加的是每关内部的变化，不是再堆入口。孩子仍然只需记住三种
 * 玩法，但每次重玩都会遇到不同的动物、数量和比较题，重复游玩不会
 * 变成机械点一下就结束。
 *
 * 设计约束：
 *   - 非暴力：不打败怪兽，用「净化光/友谊光」帮能量兽变彩色、送回家
 *   - 无失败惩罚：答错只播 tryAgain 语音 + 抖动，从不显示失败/扣分
 *   - 难度由 LG_Store.getLevel() 决定（连对升、连错降）
 *   - 每关完成回调 onClear() 由主流程处理奖励/贴纸/下一关
 *   - 动态关卡带离屏检查，退出后不再往旧 DOM 塞内容
 *
 * 每个关卡函数签名：build(stage, ctx)
 *   stage: 容器 DOM（已清空）
 *   ctx:   { onClear, config }  —— onClear() 表示该关达成
 * 所有可交互元素带 class="lg-focusable" 以支持遥控器。
 * ============================================================ */
const LG_Levels = (function () {
  const U = {
    shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    pick(a) { return a[Math.floor(Math.random() * a.length)]; },
    randInt(n) { return Math.floor(Math.random() * n); },
    el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; },
    range(n) { return Array.from({ length: n }, (_, i) => i); },
  };

  function alive(stage) {
    // DOM 的 isConnected 在真实浏览器里能抓到退出；测试桩没有该属性时视为仍在场。
    return !!stage && stage.isConnected !== false;
  }

  function later(stage, fn, ms) {
    return setTimeout(() => { if (alive(stage)) fn(); }, ms);
  }

  function wrongFeedback(el) {
    VoiceManager.play('tryAgain');
    LG_Store.reportWrong();
    if (el) {
      el.classList.add('lg-shake');
      setTimeout(() => el.classList.remove('lg-shake'), 400);
    }
    toast('再试试~');
  }

  function rightFeedback(clip) {
    VoiceManager.play(clip || 'good');
    LG_Store.reportCorrect();
  }

  // 轻量提示条（只出现鼓励语，绝不出现「失败」）
  function toast(msg) {
    let t = document.getElementById('lgToast');
    if (!t) { t = U.el('div', 'lg-toast'); t.id = 'lgToast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 1200);
  }

  /*
   * 关卡进度条不是为了计分，而是让孩子看见「我已经走到哪里了」。
   * 低龄孩子对抽象的 3/5 分数不敏感，星点比数字更直观；同时保留文字
   * label 给家长和能读字的孩子看，遥控器焦点不会落在进度点上。
   */
  function missionBar(total, label) {
    const wrap = U.el('div', 'lg-missionbar');
    const text = U.el('div', 'lg-mission-label', label);
    const dots = U.el('div', 'lg-mission-dots');
    U.range(total).forEach(() => dots.appendChild(U.el('span', 'lg-mission-dot', '✦')));
    wrap.appendChild(text);
    wrap.appendChild(dots);

    function update(done, detail) {
      const items = dots.children;
      for (let i = 0; i < items.length; i++) items[i].classList.toggle('done', i < done);
      text.textContent = detail || (label + ' ' + done + '/' + total);
    }

    return { wrap, update };
  }

  /* ============ 关卡1：变身配对 ============ */
  function buildTransform(stage, ctx) {
    const level = LG_Store.getLevel();
    const waves = level >= 3 ? 3 : 2;
    const pairCount = Math.min(2 + level, 4);
    let wave = 0;
    let finished = false;

    stage.appendChild(U.el('div', 'lg-hint', LG_CONFIG.levelInfo.transform.tip + '！'));
    const progress = missionBar(waves, '净化波次');
    stage.appendChild(progress.wrap);
    const boardHost = U.el('div', 'lg-wavehost');
    stage.appendChild(boardHost);

    function drawWave() {
      if (finished || !alive(stage)) return;
      boardHost.innerHTML = '';
      progress.update(wave, '第 ' + (wave + 1) + '/' + waves + ' 波 · 友谊光');

      const beasts = U.shuffle(LG_CONFIG.energyBeast.kinds).slice(0, pairCount);
      let cleared = 0;
      let picked = null;
      let waveLocked = false;

      const board = U.el('div', 'lg-transform');
      const leftCol = U.el('div', 'lg-col');
      const rightCol = U.el('div', 'lg-col');

      beasts.forEach(b => {
        const gray = U.el('button', 'lg-beast gray lg-focusable', b.gray);
        gray.dataset.id = b.id;
        gray.setAttribute('aria-label', '灰色的' + b.name);
        gray.onclick = () => {
          if (waveLocked || gray.disabled || gray.classList.contains('done')) return;
          // 直接用当前波次的按钮集合，避免重新查 DOM；遥控器切换焦点时也不会留两个选中态。
          Array.from(leftCol.children).forEach(x => x.classList.remove('sel'));
          gray.classList.add('sel');
          picked = gray;
        };
        leftCol.appendChild(gray);
      });

      U.shuffle(beasts).forEach(b => {
        const target = U.el('button', 'lg-friend lg-focusable', b.color);
        target.style.background = b.tint;
        target.dataset.id = b.id;
        target.setAttribute('aria-label', b.name + '的家');
        target.onclick = () => {
          if (waveLocked || target.disabled) return;
          if (!picked) { toast('先点一只灰色的能量兽'); return; }
          if (picked.dataset.id === b.id) {
            // 配对成功：净化成彩色。正常配对才记为一次正确，不把选灰兽本身算两次。
            picked.classList.remove('gray', 'sel');
            picked.classList.add('done', 'purified');
            picked.style.background = b.tint;
            picked.disabled = true;
            target.classList.add('done');
            target.disabled = true;
            // 已完成的配对必须立即退出遥控器焦点列表，否则会卡在不能再点的按钮上。
            LG_Focus.refresh();
            // 用「净化成功」一段反馈即可，紧跟着播 good 会把前一段录音盖掉。
            rightFeedback('purified');
            picked = null;
            cleared++;
            if (cleared >= beasts.length) {
              waveLocked = true;
              wave++;
              progress.update(wave, wave >= waves ? '友谊光收集完成！' : '这一波净化完成！');
              later(stage, () => {
                if (wave >= waves) {
                  finished = true;
                  ctx.onClear();
                } else {
                  drawWave();
                }
              }, 700);
            }
          } else {
            wrongFeedback(target);
          }
        };
        rightCol.appendChild(target);
      });

      board.appendChild(leftCol);
      board.appendChild(U.el('div', 'lg-beam', '✨'));
      board.appendChild(rightCol);
      boardHost.appendChild(board);
      if (typeof LG_Focus !== 'undefined') LG_Focus.refresh();
    }

    drawWave();
    VoiceManager.play('transform');
  }

  /* ============ 关卡2：光线数数 + 更多/一样多比较 ============ */
  function buildCount(stage, ctx) {
    const level = LG_Store.getLevel();
    const maxN = [3, 5, 7][level - 1] || 7;
    const tasks = 2 + level;
    let taskNo = 0;
    let taskLocked = false;
    let finished = false;

    stage.appendChild(U.el('div', 'lg-hint', LG_CONFIG.levelInfo.count.tip + '！'));
    const progress = missionBar(tasks, '光线任务');
    stage.appendChild(progress.wrap);
    const taskHost = U.el('div', 'lg-wavehost');
    stage.appendChild(taskHost);

    function addRayGroup(parent, count, side) {
      const group = U.el('div', 'lg-count-group ' + side);
      group.appendChild(U.el('div', 'lg-count-group-title', side === 'left' ? '左边' : '右边'));
      const rays = U.el('div', 'lg-count-rays');
      U.range(count).forEach(i => {
        const ray = U.el('span', 'lg-count-ray', '🌟');
        ray.style.animationDelay = (i * 0.08) + 's';
        rays.appendChild(ray);
      });
      group.appendChild(rays);
      parent.appendChild(group);
    }

    function optionButton(text, answer, correct) {
      const btn = U.el('button', 'lg-count-option lg-focusable', text);
      btn.setAttribute('aria-label', text);
      btn.onclick = () => {
        if (taskLocked || btn.disabled) return;
        if (answer === correct) {
          taskLocked = true;
          btn.classList.add('done');
          rightFeedback();
          taskNo++;
          progress.update(taskNo, '光线任务 ' + taskNo + '/' + tasks);
          later(stage, () => {
            if (taskNo >= tasks) {
              finished = true;
              ctx.onClear();
            } else {
              drawTask();
            }
          }, 550);
        } else {
          wrongFeedback(btn);
        }
      };
      return btn;
    }

    function drawTask() {
      if (finished || !alive(stage)) return;
      taskLocked = false;
      taskHost.innerHTML = '';
      progress.update(taskNo, '光线任务 ' + (taskNo + 1) + '/' + tasks);

      // 第一档先建立「数量对应」，第二、三档再混入比较，变化更自然。
      const isCompare = level > 1 && taskNo % 2 === 1;
      const scene = U.el('div', isCompare ? 'lg-count-scene compare' : 'lg-count-scene');
      const options = U.el('div', 'lg-count-options');
      taskHost.appendChild(U.el('div', 'lg-count-prompt', isCompare ? '哪一边更多？也可以选「一样多」' : '数一数有几束光？'));

      if (!isCompare) {
        const n = 1 + U.randInt(maxN);
        const beams = U.el('div', 'lg-beams');
        U.range(n).forEach(i => {
          const beam = U.el('div', 'lg-lightray', '🌟');
          beam.style.animationDelay = (i * 0.12) + 's';
          beams.appendChild(beam);
        });
        scene.appendChild(beams);
        const nums = new Set([n]);
        while (nums.size < Math.min(4, maxN + 1)) nums.add(1 + U.randInt(maxN + 1));
        U.shuffle(Array.from(nums)).forEach(num => options.appendChild(optionButton(String(num), num, n)));
      } else {
        let left = 1 + U.randInt(maxN);
        let right;
        if (Math.random() < 0.25) right = left;
        else {
          right = 1 + U.randInt(maxN);
          while (right === left) right = 1 + U.randInt(maxN);
        }
        const answer = left === right ? 'same' : left > right ? 'left' : 'right';
        addRayGroup(scene, left, 'left');
        scene.appendChild(U.el('div', 'lg-compare-mark', '⚡'));
        addRayGroup(scene, right, 'right');
        [
          ['⬅️ 更多', 'left'],
          ['一样多', 'same'],
          ['➡️ 更多', 'right'],
        ].forEach(item => options.appendChild(optionButton(item[0], item[1], answer)));
      }

      taskHost.appendChild(scene);
      taskHost.appendChild(options);
      if (typeof LG_Focus !== 'undefined') LG_Focus.refresh();
      // 比较题不能沿用「数一数有几个」录音，否则声音与题面会互相矛盾。
      // 没录 compare.mp3 时 VoiceManager 会降级成提示音，题面文字仍可看懂。
      VoiceManager.play(isCompare ? 'compare' : 'count');
    }

    drawTask();
  }

  /* ============ 关卡3：能量灯呼吸 + 星星收集 ============ */
  function buildBreathe(stage, ctx) {
    const level = LG_Store.getLevel();
    const cycles = 2 + level;
    // 呼吸关不随难度加速：难度只增加轮数，避免把放松练习变成赶时间。
    const breathMs = LG_CONFIG.levelInfo.breathe.cycleMs || 2600;
    let done = 0;
    let busy = false;
    let finished = false;

    stage.appendChild(U.el('div', 'lg-hint', LG_CONFIG.levelInfo.breathe.tip + '。每轮呼吸会点亮一颗星星！'));
    const progress = missionBar(cycles, '星星能量');
    stage.appendChild(progress.wrap);

    const lampWrap = U.el('div', 'lg-lampwrap');
    const lamp = U.el('div', 'lg-lamp');
    // 测试用的最小 DOM 没有 CSSStyleDeclaration.setProperty；回退赋值只为让
    // 冒烟测试和旧 WebView 不白屏，真实浏览器仍使用标准的 CSS 变量 API。
    if (lamp.style && typeof lamp.style.setProperty === 'function') lamp.style.setProperty('--lg-breath-ms', breathMs + 'ms');
    else lamp.style['--lg-breath-ms'] = breathMs + 'ms';
    lamp.style.background = 'radial-gradient(circle, ' + LG_CONFIG.theme.energyLamp + ' 0%, ' + LG_CONFIG.theme.red + ' 80%)';
    lampWrap.appendChild(lamp);
    stage.appendChild(lampWrap);

    const stars = U.el('div', 'lg-starrow');
    U.range(cycles).forEach(() => stars.appendChild(U.el('span', 'lg-breath-star', '☆')));
    stage.appendChild(stars);

    const label = U.el('div', 'lg-breathe-label', '准备好了吗？');
    stage.appendChild(label);

    const btn = U.el('button', 'lg-bigbtn lg-focusable', '🫧 开始呼吸');
    btn.onclick = () => {
      if (busy || finished || btn.disabled) return;
      busy = true;
      btn.disabled = true;
      VoiceManager.play('breatheIn');
      label.textContent = '吸气… 🌬️';
      lamp.classList.remove('exhale');
      lamp.classList.add('inhale');

      later(stage, () => {
        VoiceManager.play('breatheOut');
        label.textContent = '呼气… 😮‍💨';
        lamp.classList.remove('inhale');
        lamp.classList.add('exhale');
        later(stage, () => {
          lamp.classList.remove('exhale');
          done++;
          progress.update(done, '星星能量 ' + done + '/' + cycles);
          stars.children[done - 1].textContent = '★';
          stars.children[done - 1].classList.add('lit');
          rightFeedback();
          if (done >= cycles) {
            finished = true;
            label.textContent = '能量满格！你很平静~';
            later(stage, ctx.onClear, 700);
          } else {
            busy = false;
            btn.disabled = false;
            label.textContent = '准备下一次呼吸';
            if (typeof LG_Focus !== 'undefined') LG_Focus.refresh();
          }
        }, breathMs);
      }, breathMs);
    };
    stage.appendChild(btn);
    VoiceManager.play('breathe');
  }

  /* ---- 关卡注册表：主流程按顺序取用 ---- */
  const levels = [
    { id: 'transform', name: '变身配对', tip: LG_CONFIG.levelInfo.transform.tip, icon: '✨', build: buildTransform },
    { id: 'count', name: '光线数数', tip: LG_CONFIG.levelInfo.count.tip, icon: '🔢', build: buildCount },
    { id: 'breathe', name: '能量灯呼吸', tip: LG_CONFIG.levelInfo.breathe.tip, icon: '🫧', build: buildBreathe },
  ];

  return { levels };
})();
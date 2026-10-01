/* 小小社区帮手：步行探索 + 两条可独立完成的生活任务。
 * 用网格做碰撞和寻路，角色用 CSS 过渡逐格走动：离线运行，也不需要素材或游戏引擎。
 * 不套 rounds()：故事允许先拿水壶再观察花，线性答题会抹掉孩子的选择。
 */
(function () {
  const W = 12, H = 8, STEP_MS = 170;
  const u = GameManager.api.util;
  const stickers = [
    { id: 'ch-garden', emoji: '🌻', name: '暖心园丁' },
    { id: 'ch-post', emoji: '📮', name: '勇敢邮递员' },
  ];
  const store = Store.create('ch_', { stickers });
  Store.wall.register({ id: 'community-helper', title: '小小社区帮手', items: stickers,
    owned: () => store.getStickers() });

  const actors = {
    rabbit: { x: 2, y: 2, icon: '🐰', label: '小兔' },
    flower: { x: 2, y: 5, icon: '🥀', label: '花园' },
    can: { x: 4, y: 5, icon: '🪣', label: '水壶' },
    post: { x: 9, y: 2, icon: '🦊', label: '邮递员' },
    parcel: { x: 8, y: 5, icon: '📦', label: '包裹' },
    star: { x: 10, y: 5, icon: '🏠', badge: '⭐', label: '星星家' },
    circle: { x: 10, y: 1, icon: '🏠', badge: '🔵', label: '圆圈家' },
  };
  const obstacles = new Set(['0,0', '0,6', '11,0', '11,7', '5,1', '6,1', '5,2', '1,4', '1,6', '3,6']);
  const scenery = { '0,0': '🌳', '0,6': '🌳', '11,0': '🌳', '11,7': '🌳',
    '5,1': '💧', '6,1': '💧', '5,2': '💧', '1,4': '🌿', '1,6': '🌿', '3,6': '🌿',
    '3,1': '🍄', '4,2': '🦋', '7,1': '🌼', '7,6': '🌷', '0,4': '🌱', '11,4': '🌲' };
  let session = null;

  function start(stage, api) {
    if (session) session.stop();
    stage.classList.add('village-stage');
    api.setTitle('');
    const shell = u.el('div', 'village-shell');
    const hud = u.el('div', 'village-hud');
    const heading = u.el('div', 'village-heading', '小小社区帮手');
    const missions = u.el('div', 'village-missions');
    const rabbitStatus = u.el('span', 'village-mission');
    const postStatus = u.el('span', 'village-mission');
    missions.appendChild(rabbitStatus); missions.appendChild(postStatus);
    hud.appendChild(heading); hud.appendChild(missions);

    const map = u.el('div', 'village-map');
    map.setAttribute('aria-label', '社区地图：可使用方向键行走，走近目标后按空格或交谈');
    const tiles = u.el('div', 'village-tiles');
    map.appendChild(tiles);
    const sprites = {};
    const player = u.el('div', 'village-player');
    const shadow = u.el('span', 'village-player-shadow');
    const face = u.el('span', 'village-player-face', '🧒');
    player.appendChild(shadow); player.appendChild(face);
    player.setAttribute('aria-label', '小帮手');

    const bottom = u.el('div', 'village-bottom');
    const dialogue = u.el('div', 'village-dialogue');
    const portrait = u.el('div', 'village-portrait', '🏘️');
    const story = u.el('div', 'village-story');
    const line = u.el('div', 'village-line');
    const choices = u.el('div', 'village-choices');
    const actionRow = u.el('div', 'village-action-row');
    const action = u.el('button', 'village-action', '走近居民再交谈');
    const replay = u.el('button', 'village-replay', '🔊 再听一次');
    action.type = 'button'; replay.type = 'button';
    actionRow.appendChild(action); actionRow.appendChild(replay);
    story.appendChild(line); story.appendChild(choices); story.appendChild(actionRow);
    dialogue.appendChild(portrait); dialogue.appendChild(story);
    const controls = u.el('div', 'village-controls');
    const pad = u.el('div', 'village-pad');
    bottom.appendChild(dialogue); bottom.appendChild(controls);
    controls.appendChild(pad);
    shell.appendChild(hud); shell.appendChild(map); shell.appendChild(bottom);
    stage.appendChild(shell);

    const progress = { gardenerStarted: false, observed: false, hasWater: false,
      watered: false, gardenerDone: false, postStarted: false, hasParcel: false,
      delivered: false, postDone: false };
    const pos = { x: 6, y: 4 };
    let stopped = false, walkTimer = null, inputTimer = null, inputKey = null, stepTimer = null;
    let selectedChoice = 0, introTimer = null;

    function active() { return !stopped && stage.isConnected !== false && !TimerManager.isTimeUp(); }
    function key(x, y) { return x + ',' + y; }
    function visible(kind) { return kind !== 'parcel' || (!progress.hasParcel && !progress.delivered); }
    function passable(x, y) {
      if (x < 0 || y < 0 || x >= W || y >= H || obstacles.has(key(x, y))) return false;
      return !Object.keys(actors).some(kind => visible(kind) && actors[kind].x === x && actors[kind].y === y);
    }
    function near(kind) {
      const a = actors[kind];
      return visible(kind) && Math.max(Math.abs(pos.x - a.x), Math.abs(pos.y - a.y)) <= 1;
    }
    function nearest() {
      return Object.keys(actors).filter(near).sort((a, b) => {
        const da = Math.abs(pos.x - actors[a].x) + Math.abs(pos.y - actors[a].y);
        const db = Math.abs(pos.x - actors[b].x) + Math.abs(pos.y - actors[b].y);
        return da - db;
      })[0] || null;
    }
    function hint() {
      if (progress.gardenerDone && progress.postDone) return '两位邻居都得到帮助啦！还可以在社区里散步。';
      if (progress.watered && !progress.gardenerDone) return '花已经精神了，回去告诉小兔吧！';
      if (progress.delivered && !progress.postDone) return '包裹送到了，回去告诉邮递员吧！';
      if (progress.gardenerStarted && !progress.gardenerDone) {
        if (!progress.observed) return '去花园看看泥土，再想想花需要什么。';
        if (!progress.hasWater) return '泥土干了，去找水壶帮花喝水吧。';
        return '拿着水壶回到花园，给花浇水吧。';
      }
      if (progress.postStarted && !progress.postDone)
        return progress.hasParcel ? '看看门牌：星星家的门在哪里？' : '找到包裹，记住星星门牌。';
      return '走到 🐰 小兔或 🦊 邮递员身边，听听他们需要什么。';
    }
    function say(text, who, speak) {
      if (!active()) return;
      line.textContent = text;
      portrait.textContent = who || '🏘️';
      choices.innerHTML = '';
      selectedChoice = 0;
      // 孩子很快点到人物时，取消延迟的新手引导，避免覆盖居民正在说的话。
      if (speak) { clearTimeout(introTimer); api.speak(text); }
    }
    function choose(options) {
      choices.innerHTML = '';
      selectedChoice = 0;
      options.forEach(([label, callback]) => {
        const btn = u.el('button', 'village-choice', label);
        btn.type = 'button';
        btn.onclick = () => { if (active()) callback(); };
        choices.appendChild(btn);
      });
      if (choices.children.length) {
        choices.children[0].classList.add('selected');
        choices.children[0].focus();
      }
    }
    function mark(kind) {
      if (kind === 'rabbit') return !progress.gardenerStarted || (progress.watered && !progress.gardenerDone) ? '!' : '';
      if (kind === 'post') return !progress.postStarted || (progress.delivered && !progress.postDone) ? '!' : '';
      if (kind === 'flower') return progress.gardenerStarted && (!progress.observed || (progress.hasWater && !progress.watered)) ? '!' : '';
      if (kind === 'can') return progress.gardenerStarted && !progress.hasWater ? '!' : '';
      if (kind === 'parcel') return progress.postStarted && !progress.hasParcel ? '!' : '';
      if (kind === 'star') return progress.hasParcel ? '!' : '';
      return '';
    }
    function refresh() {
      rabbitStatus.textContent = (progress.gardenerDone ? '✓ ' : '') + '🌻 帮小兔照顾花';
      postStatus.textContent = (progress.postDone ? '✓ ' : '') + '📮 送星星包裹';
      rabbitStatus.classList.toggle('done', progress.gardenerDone);
      postStatus.classList.toggle('done', progress.postDone);
      Object.keys(sprites).forEach(kind => {
        sprites[kind].hidden = !visible(kind);
        sprites[kind].dataset.mark = mark(kind);
        sprites[kind].classList.toggle('near', near(kind));
      });
      const target = nearest();
      action.disabled = !target;
      action.textContent = target ? '交谈 / 使用 ' + actors[target].label : '走近居民或物品再交谈';
    }
    function updatePlayer() {
      player.style.left = (pos.x + .5) / W * 100 + '%';
      player.style.top = (pos.y + .5) / H * 100 + '%';
      refresh();
    }
    function stopAuto() { if (walkTimer) clearInterval(walkTimer); walkTimer = null; }
    function stopInput() { if (inputTimer) clearInterval(inputTimer); inputTimer = null; inputKey = null; }
    function move(dx, dy) {
      if (!active() || !passable(pos.x + dx, pos.y + dy)) return false;
      pos.x += dx; pos.y += dy;
      player.classList.toggle('face-left', dx < 0);
      player.classList.add('walking');
      clearTimeout(stepTimer);
      stepTimer = setTimeout(() => player.classList.remove('walking'), STEP_MS + 50);
      // 走开时收起旧对话选项，不让孩子站在另一个目标旁还在回答旧问题。
      if (choices.children.length) action.focus();
      choices.innerHTML = '';
      selectedChoice = 0;
      updatePlayer();
      return true;
    }
    function startInput(dx, dy, id) {
      if (!active() || inputKey === id) return;
      stopAuto(); stopInput();
      inputKey = id;
      move(dx, dy);
      inputTimer = setInterval(() => { if (!active()) stopInput(); else move(dx, dy); }, STEP_MS);
    }
    // 地图点击寻路也只走能通过的格子；障碍不是装饰，不能直接穿过去。
    function route(tx, ty, kind) {
      if (!active()) return;
      stopInput(); stopAuto();
      if (kind && near(kind)) { interact(kind); return; }
      const goals = (x, y) => kind
        ? Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= 1 : x === tx && y === ty;
      if (!kind && !passable(tx, ty)) return;
      const queue = [{ x: pos.x, y: pos.y }], seen = new Set([key(pos.x, pos.y)]);
      const previous = {};
      let found = null;
      for (let i = 0; i < queue.length; i++) {
        const node = queue[i];
        if (goals(node.x, node.y)) { found = node; break; }
        [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dx, dy]) => {
          const nx = node.x + dx, ny = node.y + dy, k = key(nx, ny);
          if (passable(nx, ny) && !seen.has(k)) {
            seen.add(k); previous[k] = node; queue.push({ x: nx, y: ny });
          }
        });
      }
      if (!found) { say('这条路走不通，试试从另一边绕过去。', '🧭', false); return; }
      const path = [];
      while (found.x !== pos.x || found.y !== pos.y) {
        path.unshift(found);
        found = previous[key(found.x, found.y)];
      }
      if (!path.length) return;
      walkTimer = setInterval(() => {
        if (!active()) { stopAuto(); return; }
        const next = path.shift();
        if (next) move(next.x - pos.x, next.y - pos.y);
        if (!path.length) {
          stopAuto();
          if (kind && near(kind)) interact(kind);
        }
      }, STEP_MS);
    }
    function finishTask(kind, text) {
      if (kind === 'garden') progress.gardenerDone = true;
      else progress.postDone = true;
      // 任务贴纸要对应实际帮过的邻居，不能随机给园丁一个邮递员贴纸。
      const sticker = kind === 'garden' ? stickers[0] : stickers[1];
      const owned = store.getStickers();
      const isNew = !owned.includes(sticker.id);
      if (isNew) store.set('stickers', owned.concat(sticker.id));
      refresh();
      say(text + (progress.gardenerDone && progress.postDone ? ' 两位邻居都得到帮助啦！' : ''),
        kind === 'garden' ? '🐰' : '🦊', false);
      api.reward(isNew ? '帮到邻居，还获得 ' + sticker.emoji + ' 贴纸！' : '帮到邻居啦，太棒了！');
    }
    function interact(kind) {
      if (!active() || !near(kind)) return;
      stopAuto();
      switch (kind) {
        case 'rabbit':
          if (progress.watered && !progress.gardenerDone) {
            finishTask('garden', '小兔：谢谢你！你观察泥土、找到水壶，花又精神啦！');
          } else if (!progress.gardenerStarted) {
            progress.gardenerStarted = true;
            say('小兔：我的花垂下头了。你想先看看花，还是先找水壶？', '🐰', true);
            choose([
              ['🌱 先看花', () => say('小兔：好主意！看看花园的泥土是什么样。', '🐰', true)],
              ['🪣 先找水壶', () => say('小兔：也可以！找到水壶后，别忘了观察花。', '🐰', true)],
            ]);
          } else say(progress.watered ? '小兔：花又有精神了，谢谢你！' : hint(), '🐰', true);
          break;
        case 'flower':
          if (!progress.gardenerStarted) say('花园里有一朵没精神的花，先去问问小兔吧。', '🥀', true);
          else if (progress.watered) say('花喝到水，开得真漂亮！', '🌻', true);
          else if (!progress.observed) {
            say('花垂着头，看看颜色浅浅的泥土，你觉得它是干的还是湿的？', '🥀', true);
            choose([
              ['☀️ 干干的', () => {
                progress.observed = true; api.sound.good(); refresh();
                say(progress.hasWater ? '发现了！泥土干了，用水壶给花浇水吧。' : '发现了！泥土干了，找水壶给花浇水吧。', '🌱', true);
              }],
              ['💧 湿湿的', () => {
                api.sound.soft();
                say('再看看：这片泥土颜色浅浅的，花也垂下头了，可能需要水。', '🌱', true);
                choose([['☀️ 我发现是干的', () => {
                  progress.observed = true; refresh(); say('对啦！现在找水壶，帮花喝水。', '🌱', true);
                }]]);
              }],
            ]);
          } else if (!progress.hasWater) say('泥土干了，还需要一把水壶。', '🌱', true);
          else {
            progress.watered = true; api.sound.good();
            sprites.flower.children[0].textContent = '🌻';
            refresh();
            say('哗啦啦，花喝到水了！快回去告诉小兔。', '🌻', true);
          }
          break;
        case 'can':
          if (!progress.gardenerStarted) say('这里有水壶。先问问小兔需要什么吧。', '🪣', true);
          else if (progress.hasWater) say('水壶已经拿好啦，去看看花。', '🪣', true);
          else { progress.hasWater = true; api.sound.good(); refresh(); say('拿到水壶啦！观察花园后就能给花浇水。', '🪣', true); }
          break;
        case 'post':
          if (progress.delivered && !progress.postDone) {
            finishTask('post', '邮递员：你找到星星门牌，把包裹送到了！谢谢你！');
          } else if (!progress.postStarted) {
            progress.postStarted = true;
            say('邮递员：这个包裹要送到星星门牌的家。可以帮忙吗？', '🦊', true);
            choose([
              ['📦 我去拿包裹', () => say('邮递员：太好了，先找到包裹，再找星星门牌。', '🦊', true)],
              ['⭐ 星星在哪里？', () => say('邮递员：看看房子旁的门牌，星星和圆圈不一样哦。', '🦊', true)],
            ]);
          } else say(progress.delivered ? '邮递员：谢谢你送到啦！' : hint(), '🦊', true);
          break;
        case 'parcel':
          if (!progress.postStarted) say('这里有一个包裹。先听听邮递员要送去哪里。', '📦', true);
          else {
            progress.hasParcel = true; api.sound.good(); refresh();
            say('包裹拿好啦！邮递员说要送到 ⭐ 星星门牌的家。', '📦', true);
          }
          break;
        case 'star':
          if (progress.hasParcel) {
            progress.hasParcel = false; progress.delivered = true; api.sound.good(); refresh();
            say('门牌是星星，找对啦！包裹送到了，回去告诉邮递员。', '⭐', true);
          } else say(progress.delivered ? '星星家的包裹已经收到啦！' : '这家的门牌是星星 ⭐。', '🏠', true);
          break;
        case 'circle':
          say(progress.hasParcel ? '这家是圆圈 🔵 门牌。包裹上要找的是星星 ⭐，再找找吧。' :
            '这家的门牌是圆圈 🔵，和星星不一样哦。', '🏠', true);
          break;
      }
      refresh();
    }

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = key(x, y);
      const zone = obstacles.has(k) ? (k === '5,1' || k === '6,1' || k === '5,2' ? 'water' : 'hedge')
        : x <= 4 && y >= 4 ? 'garden' : y === 3 || y === 4 || x === 6 || x === 9 ? 'path'
        : x >= 8 ? 'neighborhood' : 'grass';
      const tile = u.el('div', 'village-tile ' + zone, scenery[k] || '');
      tile.dataset.x = x; tile.dataset.y = y;
      tile.onclick = () => route(x, y);
      tiles.appendChild(tile);
    }
    Object.keys(actors).forEach(kind => {
      const data = actors[kind];
      const sprite = u.el('button', 'village-actor');
      sprite.type = 'button';
      sprite.dataset.kind = kind;
      sprite.style.left = (data.x + .5) / W * 100 + '%';
      sprite.style.top = (data.y + .5) / H * 100 + '%';
      sprite.setAttribute('aria-label', data.label);
      sprite.appendChild(u.el('span', 'village-actor-icon', data.icon));
      if (data.badge) sprite.appendChild(u.el('span', 'village-door-sign', data.badge));
      sprite.appendChild(u.el('span', 'village-actor-label', data.label));
      sprite.onclick = () => route(data.x, data.y, kind);
      sprites[kind] = sprite; map.appendChild(sprite);
    });
    map.appendChild(player);
    [['up', '↑', 0, -1], ['left', '←', -1, 0], ['down', '↓', 0, 1], ['right', '→', 1, 0]].forEach(([dir, label, dx, dy]) => {
      const btn = u.el('button', 'village-dir ' + dir, label);
      btn.type = 'button'; btn.setAttribute('aria-label', dir);
      btn.addEventListener('pointerdown', e => {
        e.preventDefault(); startInput(dx, dy, 'pad-' + dir);
      });
      btn.addEventListener('pointerup', stopInput);
      btn.addEventListener('pointercancel', stopInput);
      btn.addEventListener('pointerleave', stopInput);
      // 键盘确认/旧 WebView 靠 click 走一步；现代浏览器的 pointerdown 已走过，不能再走一次。
      btn.onclick = e => {
        if (window.PointerEvent && e && e.detail > 0) return;
        stopAuto(); move(dx, dy);
      };
      pad.appendChild(btn);
    });
    action.onclick = () => { const kind = nearest(); if (kind) interact(kind); };
    replay.onclick = () => { if (active()) api.speak(line.textContent); };
    function onKeyDown(e) {
      if (!active() || (e.target && e.target.closest && e.target.closest('.topbar'))) return;
      const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
      const d = dirs[e.key];
      if (choices.children.length && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault(); stopInput();
        choices.children[selectedChoice].classList.remove('selected');
        selectedChoice = (selectedChoice + (e.key === 'ArrowRight' ? 1 : -1) + choices.children.length) % choices.children.length;
        choices.children[selectedChoice].classList.add('selected');
        choices.children[selectedChoice].focus();
        return;
      }
      if (d) { e.preventDefault(); startInput(d[0], d[1], e.key); }
      else if (e.key === 'Enter' || e.key === ' ') {
        // 原生按钮（包括剧情选项）自己处理 Enter；遥控器没有焦点时确认当前选项。
        if (e.target && e.target.tagName === 'BUTTON') return;
        e.preventDefault();
        if (choices.children.length) choices.children[selectedChoice].click();
        else { const kind = nearest(); if (kind) interact(kind); }
      }
    }
    function onKeyUp(e) { if (inputKey === e.key) stopInput(); }
    function onVisibility() { if (document.hidden) { stopInput(); stopAuto(); } }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', stopInput);
    function stop() {
      if (stopped) return;
      stopped = true; stopAuto(); stopInput(); clearTimeout(stepTimer); clearTimeout(introTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', stopInput);
      stage.classList.remove('village-stage');
      SpeechManager.stop();
    }
    session = { stop };
    updatePlayer();
    const welcome = '用方向键或下面的按钮走路，也可以点小兔或邮递员走过去。走近后按交谈。';
    say(welcome, '🏘️', false);
    // 首页首次点击会播放平台欢迎语；稍后播地图引导，避免两个声音互相打断。
    introTimer = setTimeout(() => { if (active()) api.speak(welcome); }, 450);
  }

  GameManager.register({
    id: 'community-helper', name: '社区小帮手', icon: '🏘️',
    color: 'linear-gradient(135deg,#84cbb5,#408d9e)', age: [3, 6], title: '',
    start,
    stop() { if (session) { session.stop(); session = null; } },
  });
})();

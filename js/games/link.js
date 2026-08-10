/* 连连消：同图形且路径转折不超过两次即可消除，支持提示与洗牌 */
(function () {
  const KINDS = [
    { s: 'i-shape-circle', c: '#ff4d8d' }, { s: 'i-shape-square', c: '#4dd6ff' },
    { s: 'i-shape-tri', c: '#ffd93d' },    { s: 'i-shape-drop', c: '#7c4dff' },
    { s: 'i-shape-flower', c: '#3ee0a6' }, { s: 'i-shape-bolt', c: '#ff8a3d' },
    { s: 'i-shape-moon2', c: '#5b2ee0' },  { s: 'i-shape-ring', c: '#ff6fb5' }
  ];
  const LV = {
    easy:   { r: 6,  c: 8,  k: 6, t: 200, label: '轻松 6×8' },
    normal: { r: 8,  c: 10, k: 8, t: 280, label: '标准 8×10' },
    hard:   { r: 10, c: 12, k: 8, t: 360, label: '硬核 10×12' }
  };

  const CSS = `
  .lk-stage{position:relative;margin:0 auto}
  .lk-tile{position:absolute;left:0;top:0;display:grid;place-items:center;padding:0;
    border:2px solid var(--line);border-radius:12px;background:var(--surface-2);
    box-shadow:0 3px 0 rgba(42,27,61,.12);cursor:pointer;
    transition:transform .2s var(--ease),opacity .25s,box-shadow .2s,border-color .2s}
  .lk-tile svg{width:62%;height:62%;stroke-width:2.2}
  .lk-tile:hover{filter:brightness(1.06)}
  .lk-tile[data-sel="1"]{border-color:currentColor;box-shadow:0 0 0 4px color-mix(in srgb,currentColor 32%,transparent);
    animation:lkPulse .9s ease-in-out infinite}
  .lk-tile[data-hint="1"]{animation:lkPulse .55s ease-in-out infinite}
  .lk-tile.gone{opacity:0;pointer-events:none}
  .lk-svg{position:absolute;inset:0;pointer-events:none;overflow:visible}
  .lk-path{fill:none;stroke-width:6;stroke-linecap:round;stroke-linejoin:round;
    animation:lkPath .42s ease forwards}
  @keyframes lkPulse{50%{transform:scale(1.09)}}
  @keyframes lkPath{0%{opacity:0}20%{opacity:1}100%{opacity:0}}`;

  function injectCSS() {
    if (document.getElementById('css-link')) return;
    const s = document.createElement('style'); s.id = 'css-link'; s.textContent = CSS;
    document.head.append(s);
  }

  const meta = {
    id: 'link', name: '连连消', icon: 'i-link',
    c1: '#3ee0a6', c2: '#4dd6ff',
    desc: '找出两个相同图形，连线转折不超过两次即可消除。清空棋盘就算通关。',
    tags: ['眼力', '限时', '提示 3 次'],
    mount
  };

  function mount(m) {
    injectCSS();
    let R, C, K, LIMIT, lv = 'easy';
    let grid, sel, left, combo, over, hints, shuffles, size;

    const tChip = App.chip('i-clock', '00:00', '剩余时间');
    const lChip = App.chip('i-gem', 0, '剩余方块');
    const cChip = App.chip('i-star', 0, '连击');
    const timer = UI.timer((_, secs) => {
      const rest = Math.max(0, LIMIT - secs);
      tChip.set(String((rest / 60) | 0).padStart(2, '0') + ':' + String(rest % 60).padStart(2, '0'));
      if (rest <= 10 && rest > 0) Sfx.play('tick');
      if (rest === 0) timeUp();
    });

    const btnHint = UI.el('button.btn.ghost', { type: 'button', onclick: useHint },
      [UI.icon('i-bulb'), UI.el('span', { text: '提示 3' })]);
    const btnShuffle = UI.el('button.btn.ghost', { type: 'button', onclick: () => useShuffle(true) },
      [UI.icon('i-refresh'), UI.el('span', { text: '洗牌 3' })]);
    const btnNew = UI.el('button.btn', { type: 'button', onclick: () => build() },
      [UI.icon('i-play'), UI.el('span', { text: '新一局' })]);

    const lvBtns = Object.keys(LV).map(k => {
      const b = UI.el('button.btn.ghost', {
        type: 'button', 'aria-pressed': String(k === lv),
        onclick: () => {
          lv = k; Sfx.play('click');
          lvBtns.forEach(x => x.setAttribute('aria-pressed', String(x._k === lv)));
          build();
        }
      }, UI.el('span', { text: LV[k].label }));
      b._k = k; return b;
    });

    const { board } = App.shell(m, {
      hud: [tChip.node, lChip.node, cChip.node],
      tools: [...lvBtns, btnHint, btnShuffle, btnNew],
      hint: '连线可以绕出棋盘外一格。若无解会自动洗牌，不消耗次数。'
    });

    const stage = UI.el('div.lk-stage', { role: 'grid', 'aria-label': '连连消棋盘' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'lk-svg');
    stage.append(svg);
    board.append(stage);

    /* ---------- 坐标与判定：grid 为 (R+2)×(C+2)，四周留空便于绕行 ---------- */
    const inRange = (r, c) => r >= 0 && r <= R + 1 && c >= 0 && c <= C + 1;
    const empty = (r, c) => inRange(r, c) && !grid[r][c];

    function clearH(r, c1, c2) {
      const [s, e] = c1 < c2 ? [c1, c2] : [c2, c1];
      for (let c = s + 1; c < e; c++) if (!empty(r, c)) return false;
      return true;
    }
    function clearV(c, r1, r2) {
      const [s, e] = r1 < r2 ? [r1, r2] : [r2, r1];
      for (let r = s + 1; r < e; r++) if (!empty(r, c)) return false;
      return true;
    }
    const direct = (a, b) =>
      (a.r === b.r && clearH(a.r, a.c, b.c)) || (a.c === b.c && clearV(a.c, a.r, b.r));

    function oneTurn(a, b) {
      for (const k of [{ r: a.r, c: b.c }, { r: b.r, c: a.c }]) {
        if (empty(k.r, k.c) && direct(a, k) && direct(k, b)) return [a, k, b];
      }
      return null;
    }
    /** 返回折线路径点数组，或 null */
    function pathBetween(a, b) {
      if (a.r === b.r && a.c === b.c) return null;
      if (direct(a, b)) return [a, b];
      const one = oneTurn(a, b); if (one) return one;
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        let r = a.r + dr, c = a.c + dc;
        while (empty(r, c)) {
          const p = { r, c };
          if (direct(p, b)) return [a, p, b];
          const t = oneTurn(p, b);
          if (t) return [a, ...t];
          r += dr; c += dc;
        }
      }
      return null;
    }

    /* ---------- 构建 ---------- */
    function build() {
      ({ r: R, c: C, k: K, t: LIMIT } = LV[lv]);
      over = false; sel = null; combo = 0; hints = 3; shuffles = 3;
      left = R * C;
      lChip.set(left); cChip.set(0);
      btnHint.querySelector('span').textContent = '提示 3';
      btnShuffle.querySelector('span').textContent = '洗牌 3';
      timer.reset(); timer.start();

      grid = Array.from({ length: R + 2 }, () => Array(C + 2).fill(null));
      const kinds = [];
      for (let i = 0; i < (R * C) / 2; i++) { const k = i % K; kinds.push(k, k); }
      UI.shuffle(kinds);

      [...stage.querySelectorAll('.lk-tile')].forEach(t => t.remove());
      let i = 0;
      for (let r = 1; r <= R; r++) for (let c = 1; c <= C; c++) {
        const kind = kinds[i++];
        const tile = UI.el('button.lk-tile', {
          type: 'button', role: 'gridcell',
          'aria-label': `第 ${r} 行第 ${c} 列 图形 ${kind + 1}`,
          style: `color:${KINDS[kind].c}`,
          onclick: () => pick(tile)
        }, UI.icon(KINDS[kind].s));
        tile._r = r; tile._c = c; tile._k = kind;
        grid[r][c] = tile;
        stage.append(tile);
      }
      layout();
      if (!findPair()) useShuffle(false);
      Sfx.play('shuffle');
    }

    function layout() {
      const avail = Math.min(window.innerWidth * 0.88, 760);
      size = Math.max(24, Math.min(52, Math.floor(avail / (C + 2))));
      const w = (C + 2) * size, h = (R + 2) * size;
      stage.style.width = w + 'px';
      stage.style.height = h + 'px';
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      for (let r = 1; r <= R; r++) for (let c = 1; c <= C; c++) {
        const t = grid[r][c]; if (!t) continue;
        t.style.width = t.style.height = (size - 4) + 'px';
        t.style.transform = `translate(${c * size + 2}px,${r * size + 2}px)`;
      }
    }
    let rzTimer;
    const onResize = () => { clearTimeout(rzTimer); rzTimer = setTimeout(layout, 120); };
    window.addEventListener('resize', onResize);

    /* ---------- 交互 ---------- */
    function setSel(t, on) {
      if (!t) return;
      t.dataset.sel = on ? '1' : '0';
      if (!on) delete t.dataset.sel;
    }

    function pick(tile) {
      if (over || tile.classList.contains('gone')) return;
      clearHints();
      if (sel === tile) { setSel(tile, false); sel = null; Sfx.play('select'); return; }
      if (!sel) { sel = tile; setSel(tile, true); Sfx.play('select'); return; }

      if (sel._k !== tile._k) {
        Sfx.play('wrong'); combo = 0; cChip.set(0);
        setSel(sel, false); sel = tile; setSel(tile, true);
        return;
      }
      const path = pathBetween({ r: sel._r, c: sel._c }, { r: tile._r, c: tile._c });
      if (!path) {
        Sfx.play('wrong'); combo = 0; cChip.set(0);
        tile.classList.add('shake');
        setTimeout(() => tile.classList.remove('shake'), 420);
        setSel(sel, false); sel = tile; setSel(tile, true);
        return;
      }
      remove(sel, tile, path);
    }

    function drawPath(points, color) {
      const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      pl.setAttribute('class', 'lk-path');
      pl.setAttribute('stroke', color);
      pl.setAttribute('points', points.map(p =>
        `${p.c * size + size / 2},${p.r * size + size / 2}`).join(' '));
      svg.append(pl);
      setTimeout(() => pl.remove(), 460);
    }

    function remove(a, b, path) {
      drawPath(path, KINDS[a._k].c);
      combo++; cChip.set(combo, true);
      Sfx.play('combo', combo);
      [a, b].forEach(t => {
        UI.burst(t, 12, [KINDS[t._k].c, '#fff']);
        t.classList.add('gone');
        t.disabled = true;
        grid[t._r][t._c] = null;
      });
      setSel(a, false); sel = null;
      left -= 2; lChip.set(left, true);

      if (left === 0) return win();
      if (!findPair()) {
        UI.toast('已无可消除组合，自动洗牌');
        useShuffle(false);
      }
    }

    /** 扫描所有同类对，返回第一组可连的 [a,b] */
    function findPair() {
      const byKind = new Map();
      for (let r = 1; r <= R; r++) for (let c = 1; c <= C; c++) {
        const t = grid[r][c]; if (!t) continue;
        if (!byKind.has(t._k)) byKind.set(t._k, []);
        byKind.get(t._k).push(t);
      }
      for (const list of byKind.values()) {
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
          if (pathBetween({ r: list[i]._r, c: list[i]._c }, { r: list[j]._r, c: list[j]._c }))
            return [list[i], list[j]];
        }
      }
      return null;
    }

    function clearHints() {
      stage.querySelectorAll('[data-hint]').forEach(t => delete t.dataset.hint);
    }
    function useHint() {
      if (over) return;
      if (hints <= 0) { UI.toast('提示次数已用完'); Sfx.play('wrong'); return; }
      const pair = findPair();
      if (!pair) return;
      hints--; btnHint.querySelector('span').textContent = '提示 ' + hints;
      Sfx.play('hint');
      clearHints();
      pair.forEach(t => t.dataset.hint = '1');
      setTimeout(clearHints, 2400);
    }

    /** cost=true 时消耗次数（玩家主动洗牌）；死局自动洗牌不计次 */
    function useShuffle(cost) {
      if (over) return;
      if (cost) {
        if (shuffles <= 0) { UI.toast('洗牌次数已用完'); Sfx.play('wrong'); return; }
        shuffles--; btnShuffle.querySelector('span').textContent = '洗牌 ' + shuffles;
      }
      Sfx.play('shuffle');
      const spots = [], list = [];
      for (let r = 1; r <= R; r++) for (let c = 1; c <= C; c++) {
        if (grid[r][c]) { spots.push([r, c]); list.push(grid[r][c]); }
      }
      for (let attempt = 0; attempt < 24; attempt++) {
        UI.shuffle(list);
        spots.forEach(([r, c], i) => {
          const t = list[i];
          grid[r][c] = t; t._r = r; t._c = c;
          t.setAttribute('aria-label', `第 ${r} 行第 ${c} 列 图形 ${t._k + 1}`);
        });
        if (findPair()) break;
      }
      setSel(sel, false); sel = null;
      layout();
    }

    function finish(iconId, title, desc) {
      over = true; timer.stop();
      UI.modal({
        iconId, title, desc,
        actions: [
          { label: '再来一局', icon: 'i-refresh', primary: true, onClick: build },
          { label: '回到画廊', icon: 'i-back', onClick: () => location.hash = '#/' }
        ]
      });
    }
    function win() {
      Sfx.play('win'); UI.confetti();
      finish('i-trophy', '棋盘已清空', `${LV[lv].label}，剩余时间 ${tChip.node.textContent}。`);
    }
    function timeUp() {
      if (over) return;
      Sfx.play('lose');
      finish('i-clock', '时间到了', `还剩 ${left} 个方块没消掉，再挑战一次？`);
    }

    build();
    return {
      destroy() { timer.stop(); window.removeEventListener('resize', onResize); }
    };
  }

  App.register(meta);
})();


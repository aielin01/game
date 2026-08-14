/* 连连消：使用 translate 独立属性修复飞牌问题 */
(function () {
  const KINDS = [
    { s: 'i-shape-circle', c: '#ff5c8a' }, { s: 'i-shape-square', c: '#4cc9f0' },
    { s: 'i-shape-tri', c: '#ffd23f' },    { s: 'i-shape-drop', c: '#8b5cf6' },
    { s: 'i-shape-flower', c: '#3ddc97' }, { s: 'i-shape-bolt', c: '#ff8a3d' },
    { s: 'i-shape-moon2', c: '#0d0d0f' },  { s: 'i-shape-ring', c: '#75757f' }
  ];

  const LV = {
    easy:   { r: 6,  c: 8,  k: 6, t: 180, label: '轻松' },
    normal: { r: 8,  c: 10, k: 8, t: 260, label: '标准' },
    hard:   { r: 10, c: 12, k: 8, t: 340, label: '硬核' }
  };

  const CSS = `
  .lk-stage{position:relative;margin:0 auto}
  .lk-tile{position:absolute;left:0;top:0;display:grid;place-items:center;padding:0;
    border:1.5px solid var(--line);border-radius:12px;background:var(--surface-2);
    box-shadow:var(--sh-1);cursor:pointer;
    transition:translate .24s var(--ease),scale .2s,opacity .25s,box-shadow .2s,border-color .2s}
  .lk-tile svg{width:60%;height:60%;stroke-width:2}
  .lk-tile:hover{filter:brightness(1.05);border-color:var(--line-2)}
  .lk-tile[data-sel="1"]{border-color:currentColor;box-shadow:0 0 0 3px color-mix(in srgb,currentColor 25%,transparent);
    animation:lkPulse .8s ease-in-out infinite}
  .lk-tile[data-hint="1"]{animation:lkPulse .5s ease-in-out infinite}
  .lk-tile.gone{opacity:0;pointer-events:none}
  .lk-svg{position:absolute;inset:0;pointer-events:none;overflow:visible}
  .lk-path{fill:none;stroke-width:5;stroke-linecap:round;stroke-linejoin:round;
    animation:lkPath .4s ease forwards}
  @keyframes lkPulse{50%{scale:1.08}}
  @keyframes lkPath{0%{opacity:0}20%{opacity:1}100%{opacity:0}}
  html[data-theme="dark"] .lk-tile[data-kind="6"]{ color: #f6f6f7 !important; }
  html[data-theme="dark"] .lk-tile[data-kind="7"]{ color: #84848e !important; }`;

  function injectCSS() {
    if (!document.getElementById('css-link')) {
      const s = document.createElement('style'); s.id = 'css-link'; s.textContent = CSS;
      document.head.append(s);
    }
  }

  const meta = {
    id: 'link', name: '连连消', icon: 'i-link', ac: '#3ddc97',
    desc: '找出两个相同图形，连线转折不超过两次。清空棋盘即通关。',
    tags: ['眼力', '限时', '死局重置'],
    bestLabel: (k, v) => LV[k].label + ' 剩 ' + UI.fmtTime(v),
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
      tChip.set(UI.fmtTime(rest));
      if (rest <= 10 && rest > 0) Sfx.play('tick');
      if (rest === 0) timeUp();
    });

    const lvBtns = App.levels(LV, lv, k => { lv = k; build(true); });
    const btnHint = UI.el('button.btn.ghost.sm', { type: 'button', onclick: useHint },
      [UI.icon('i-bulb'), UI.el('span', { text: '提示 3' })]);
    const btnShuffle = UI.el('button.btn.ghost.sm', { type: 'button', onclick: () => useShuffle(true) },
      [UI.icon('i-refresh'), UI.el('span', { text: '洗牌 3' })]);
    const btnNew = UI.el('button.btn.sm', { type: 'button', onclick: () => build(true) },
      [UI.icon('i-play'), UI.el('span', { text: '新一局' })]);

    const { board } = App.shell(m, {
      hud: [tChip.node, lChip.node, cChip.node],
      tools: [...lvBtns, btnHint, btnShuffle, btnNew],
      hint: '连线可绕出棋盘外一格。无解时自动免费洗牌。'
    });

    const stage = UI.el('div.lk-stage', { role: 'grid' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'lk-svg');
    stage.append(svg); board.append(stage);

    const inRange = (r, c) => r >= 0 && r <= R + 1 && c >= 0 && c <= C + 1;
    const empty = (r, c) => inRange(r, c) && !grid[r][c];

    const direct = (a, b) => {
      if (a.r === b.r) {
        const [s, e] = a.c < b.c ? [a.c, b.c] : [b.c, a.c];
        for (let c = s + 1; c < e; c++) if (!empty(a.r, c)) return false;
        return true;
      }
      if (a.c === b.c) {
        const [s, e] = a.r < b.r ? [a.r, b.r] : [b.r, a.r];
        for (let r = s + 1; r < e; r++) if (!empty(r, a.c)) return false;
        return true;
      }
      return false;
    };

    function pathBetween(a, b) {
      if (a.r === b.r && a.c === b.c) return null;
      if (direct(a, b)) return [a, b];
      for (const k of [{ r: a.r, c: b.c }, { r: b.r, c: a.c }]) {
        if (empty(k.r, k.c) && direct(a, k) && direct(k, b)) return [a, k, b];
      }
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        let r = a.r + dr, c = a.c + dc;
        while (empty(r, c)) {
          const p = { r, c };
          if (direct(p, b)) return [a, p, b];
          for (const k of [{ r: p.r, c: b.c }, { r: b.r, c: p.c }]) {
            if (empty(k.r, k.c) && direct(p, k) && direct(k, b)) return [a, p, k, b];
          }
          r += dr; c += dc;
        }
      }
      return null;
    }

    function build(forceNew) {
      ({ r: R, c: C, k: K, t: LIMIT } = LV[lv]);
      over = false; sel = null; combo = 0; hints = 3; shuffles = 3;
      grid = Array.from({ length: R + 2 }, () => Array(C + 2).fill(null));
      stage.querySelectorAll('.lk-tile').forEach(t => t.remove());

      const save = forceNew ? null : Store.loadGame(m.id);
      let kinds = [];
      if (save && save.lv === lv) {
        kinds = save.kinds; hints = save.hints; shuffles = save.shuffles; combo = save.combo;
        timer.reset(save.time); timer.start();
      } else {
        for (let i = 0; i < (R * C) / 2; i++) { const k = i % K; kinds.push(k, k); }
        UI.shuffle(kinds); timer.reset(); timer.start();
        if (forceNew) Sfx.play('shuffle');
      }

      btnHint.querySelector('span').textContent = '提示 ' + hints;
      btnShuffle.querySelector('span').textContent = '洗牌 ' + shuffles;
      cChip.set(combo);

      let i = 0, exist = 0;
      for (let r = 1; r <= R; r++) for (let c = 1; c <= C; c++) {
        const kind = kinds[i++];
        if (kind === -1) continue;
        exist++;
        const tile = UI.el('button.lk-tile', {
          type: 'button', role: 'gridcell', 'data-kind': kind,
          style: `color:${KINDS[kind].c}`, onclick: () => pick(tile)
        }, UI.icon(KINDS[kind].s));
        tile._r = r; tile._c = c; tile._k = kind;
        grid[r][c] = tile; stage.append(tile);
      }
      left = exist; lChip.set(left);
      layout();
      if (!findPair()) useShuffle(false);
    }

    function layout() {
      const avail = Math.min(window.innerWidth * 0.88, 760);
      size = Math.max(24, Math.min(50, Math.floor(avail / (C + 2))));
      const w = (C + 2) * size, h = (R + 2) * size;
      stage.style.width = w + 'px'; stage.style.height = h + 'px';
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      for (let r = 1; r <= R; r++) for (let c = 1; c <= C; c++) {
        const t = grid[r][c]; if (!t) continue;
        t.style.width = t.style.height = (size - 4) + 'px';
        t.style.translate = `${c * size + 2}px ${r * size + 2}px`;
      }
    }
    let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 100); });

    function pick(tile) {
      if (over || tile.classList.contains('gone')) return;
      stage.querySelectorAll('[data-hint]').forEach(t => delete t.dataset.hint);
      if (sel === tile) { delete tile.dataset.sel; sel = null; Sfx.play('select'); return; }
      if (!sel) { sel = tile; tile.dataset.sel = '1'; Sfx.play('select'); return; }

      if (sel._k !== tile._k) {
        Sfx.play('wrong'); combo = 0; cChip.set(0);
        delete sel.dataset.sel; sel = tile; tile.dataset.sel = '1'; return;
      }
      const path = pathBetween({ r: sel._r, c: sel._c }, { r: tile._r, c: tile._c });
      if (!path) {
        Sfx.play('wrong'); combo = 0; cChip.set(0);
        UI.bounce(tile, 'shake');
        delete sel.dataset.sel; sel = tile; tile.dataset.sel = '1'; return;
      }
      
      const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      pl.setAttribute('class', 'lk-path');
      pl.setAttribute('stroke', getComputedStyle(tile).color);
      pl.setAttribute('points', path.map(p => `${p.c * size + size / 2},${p.r * size + size / 2}`).join(' '));
      svg.append(pl); setTimeout(() => pl.remove(), 420);

      combo++; cChip.set(combo, true); Sfx.play('combo', combo);
      [sel, tile].forEach(t => {
        UI.burst(t, 10, [KINDS[t._k].c, '#fff']);
        t.classList.add('gone'); t.disabled = true; grid[t._r][t._c] = null;
      });
      delete sel.dataset.sel; sel = null;
      left -= 2; lChip.set(left, true);

      if (left === 0) return win();
      if (!findPair()) { UI.toast('无解，自动洗牌'); useShuffle(false); }
    }

    function findPair() {
      const byK = new Map();
      for (let r = 1; r <= R; r++) for (let c = 1; c <= C; c++) {
        const t = grid[r][c]; if (t) { if (!byK.has(t._k)) byK.set(t._k, []); byK.get(t._k).push(t); }
      }
      for (const list of byK.values()) {
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
          if (pathBetween({ r: list[i]._r, c: list[i]._c }, { r: list[j]._r, c: list[j]._c })) return [list[i], list[j]];
        }
      }
      return null;
    }

    function useHint() {
      if (over || hints <= 0) { if (!over) { UI.toast('提示用完'); Sfx.play('wrong'); } return; }
      const p = findPair(); if (!p) return;
      hints--; btnHint.querySelector('span').textContent = '提示 ' + hints; Sfx.play('hint');
      p.forEach(t => t.dataset.hint = '1');
    }

    function useShuffle(cost) {
      if (over || (cost && shuffles <= 0)) { if (cost && !over) { UI.toast('洗牌用完'); Sfx.play('wrong'); } return; }
      if (cost) { shuffles--; btnShuffle.querySelector('span').textContent = '洗牌 ' + shuffles; }
      Sfx.play('shuffle');
      const spots = [], list = [];
      for (let r = 1; r <= R; r++) for (let c = 1; c <= C; c++) {
        if (grid[r][c]) { spots.push([r, c]); list.push(grid[r][c]); }
      }
      for (let att = 0; att < 30; att++) {
        UI.shuffle(list);
        spots.forEach(([r, c], i) => { const t = list[i]; grid[r][c] = t; t._r = r; t._c = c; });
        if (findPair()) break;
      }
      if (sel) delete sel.dataset.sel; sel = null;
      layout();
    }

    function win() {
      over = true; timer.stop(); Store.clearGame(m.id); Store.bump(m.id, 'plays');
      const rest = Math.max(0, LIMIT - timer.seconds);
      const rec = Store.record(m.id, lv, rest, true);
      Sfx.play(rec.isNew ? 'record' : 'win'); UI.confetti();
      UI.modal({
        title: rec.isNew ? '新纪录！' : '棋盘清空',
        desc: `${LV[lv].label}难度，剩余 ${UI.fmtTime(rest)}。${rec.isNew ? '打破了 '+UI.fmtTime(rec.prev||0)+' 的记录！' : ''}`,
        actions: [
          { label: '再来一局', icon: 'i-refresh', primary: true, onClick: () => build(true) },
          { label: '返回', icon: 'i-back', onClick: () => location.hash = '#/' }
        ]
      });
    }

    function timeUp() {
      if (over) return;
      over = true; timer.stop(); Store.clearGame(m.id); Sfx.play('lose');
      UI.modal({
        iconId: 'i-clock', title: '时间到',
        desc: `还剩 ${left} 个方块没消掉。`,
        actions: [
          { label: '重新开始', icon: 'i-refresh', primary: true, onClick: () => build(true) },
          { label: '返回', icon: 'i-back', onClick: () => location.hash = '#/' }
        ]
      });
    }

    build();
    return {
      persist: () => {
        if (!over && left > 0) {
          const flat = [];
          for (let r = 1; r <= R; r++) for (let c = 1; c <= C; c++) flat.push(grid[r][c] ? grid[r][c]._k : -1);
          Store.saveGame(m.id, { lv, time: timer.seconds, kinds: flat, hints, shuffles, combo });
        }
      },
      destroy: () => timer.dispose()
    };
  }
  App.register(meta);
})();

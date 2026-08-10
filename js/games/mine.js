/* 排雷：首点安全 + 零区块递归展开，右键/长按插旗 */
(function () {
  const LV = {
    easy:   { r: 9,  c: 9,  m: 10, label: '轻松 9×9' },
    normal: { r: 12, c: 12, m: 22, label: '标准 12×12' },
    hard:   { r: 14, c: 16, m: 42, label: '硬核 14×16' }
  };
  const NUM_COLOR = ['', '#4dd6ff', '#3ee0a6', '#ffd93d', '#ff8a3d', '#ff4d8d', '#7c4dff', '#5b2ee0', '#6b5b80'];

  const meta = {
    id: 'mine', name: '扫雷排查', icon: 'i-mine',
    c1: '#ff8a3d', c2: '#ff4d8d',
    desc: '数字代表周围八格的地雷数。标记所有地雷并翻开安全区域即获胜。',
    tags: ['逻辑推理', '三种难度', '首点必安全'],
    mount
  };

  function mount(m) {
    let lv = 'easy', R, C, M, cells, opened, over, started, flags;
    const timer = UI.timer(t => tChip.set(t));
    const tChip = App.chip('i-clock', '00:00', '用时');
    const fChip = App.chip('i-flag', '0/0', '剩余旗数');
    const btnNew = UI.el('button.btn', { type: 'button', onclick: () => build() },
    let markMode = false;
    const btnCheat = UI.el('button.btn.ghost', {
  type: 'button', 'aria-pressed': 'false',
  onclick: () => {
    Sfx.play('click');
    if (cheat) { cheat.remove(); cheat = null; btnCheat.setAttribute('aria-pressed', 'false'); }
    else { buildCheat(); btnCheat.setAttribute('aria-pressed', 'true'); UI.toast('取景框已开启，拖动顶部把手'); }
  }
}, [UI.icon('i-grid'), UI.el('span', { text: '九宫格' })]);
const btnMark = UI.el('button.btn.ghost', {
  type: 'button', 'aria-pressed': 'false',
  onclick: () => {
    markMode = !markMode;
    btnMark.setAttribute('aria-pressed', String(markMode));
    UI.toast(markMode ? '标记模式：点击即插旗' : '挖掘模式：点击即翻开');
    Sfx.play('click');
  }
}, [UI.icon('i-flag'), UI.el('span', { text: '标记' })]);
      [UI.icon('i-refresh'), UI.el('span', { text: '重开' })]);

    const lvBtns = Object.keys(LV).map(k => UI.el('button.btn.ghost', {
      type: 'button', 'aria-pressed': String(k === lv),
      onclick: () => {
        lv = k; Sfx.play('click');
        lvBtns.forEach(b => b.setAttribute('aria-pressed', String(b._k === lv)));
        build();
      }
    }, UI.el('span', { text: LV[k].label })));
    lvBtns.forEach((b, i) => b._k = Object.keys(LV)[i]);

    const { board } = App.shell(m, {
      hud: [tChip.node, fChip.node], tools: [...lvBtns,btnMark,btnCheat,  btnNew],
      hint: '左键翻开，右键或长按插旗。数字格双击可快速展开已标记完的周围格。'
    });

    const grid = UI.el('div', { role: 'grid', 'aria-label': '扫雷棋盘' });
    board.append(grid);

    const idx = (r, c) => r * C + c;
    const around = (r, c) => {
      const out = [];
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        if (!i && !j) continue;
        const nr = r + i, nc = c + j;
        if (nr >= 0 && nr < R && nc >= 0 && nc < C) out.push(cells[idx(nr, nc)]);
      }
      return out;
    };
/* ---- 作弊取景框：只画九宫格，不读棋盘数据 ---- */
let cheat = null;
const GAP = 4;                            // 与 grid 的 gap 保持一致

function cellSize() {
  return cells[0] ? cells[0].getBoundingClientRect().width : 32;
}

function buildCheat() {
  board.style.position = 'relative';       // 作为定位父级
  const handle = UI.el('div.cheat-handle', {}, [
    UI.icon('i-grid'), UI.el('span', { text: '拖动我' })
  ]);
  const cells9 = Array.from({ length: 9 }, (_, i) => UI.el(i === 4 ? 'i.mid' : 'i'));
  const gridBox = UI.el('div.cheat-grid', {}, cells9);
  cheat = UI.el('div.cheat', { 'aria-hidden': 'true' }, [handle, gridBox]);

  const resize = () => {
    const s = cellSize(), side = s * 3 + GAP * 2;
    gridBox.style.width = side + 'px';
    gridBox.style.height = side + 'px';
    cheat.style.width = side + 'px';
  };
  resize();
  cheat._resize = resize;

  // 初始摆在棋盘左上角内侧
  cheat.style.left = '8px';
  cheat.style.top = '8px';

  let dragging = false, ox = 0, oy = 0;
  handle.addEventListener('pointerdown', e => {
    dragging = true;
    handle.setPointerCapture(e.pointerId);
    const r = cheat.getBoundingClientRect();
    ox = e.clientX - r.left; oy = e.clientY - r.top;
    cheat.classList.add('dragging');
    Sfx.play('select');
  });
  handle.addEventListener('pointermove', e => {
    if (!dragging) return;
    const b = board.getBoundingClientRect();
    cheat.style.left = (e.clientX - b.left - ox) + 'px';
    cheat.style.top = (e.clientY - b.top - oy) + 'px';
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    cheat.classList.remove('dragging');
    snapCheat();
    Sfx.play('place');
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);

  board.append(cheat);
}

/** 松手后吸附到最近的格子交点 */
function snapCheat() {
  if (!cheat || !cells.length) return;
  const s = cellSize(), step = s + GAP;
  const b = board.getBoundingClientRect(), g = grid.getBoundingClientRect();
  const offX = g.left - b.left, offY = g.top - b.top;
  const hh = cheat.querySelector('.cheat-handle').offsetHeight;

  const col = Math.round((parseFloat(cheat.style.left) - offX) / step);
  const row = Math.round((parseFloat(cheat.style.top) + hh - offY) / step);
  const maxC = C - 3, maxR = R - 3;
  const cc = Math.min(Math.max(col, 0), Math.max(maxC, 0));
  const rr = Math.min(Math.max(row, 0), Math.max(maxR, 0));
  cheat.style.left = (offX + cc * step) + 'px';
  cheat.style.top = (offY + rr * step - hh) + 'px';
}
    function build() {
      ({ r: R, c: C, m: M } = LV[lv]);
      over = false; started = false; opened = 0; flags = 0;
      timer.reset(); fChip.set(`${M}/${M}`);
      grid.innerHTML = '';
      const size = `clamp(26px, min(${86 / C}vw, 44px), 44px)`;
      grid.setAttribute('style',
        `display:grid;gap:4px;grid-template-columns:repeat(${C}, ${size})`);
      cells = [];
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const btn = UI.el('button.cellbtn', {
          type: 'button', role: 'gridcell',
          'aria-label': `第 ${r + 1} 行第 ${c + 1} 列，未翻开`,
          style: 'aspect-ratio:1;font-size:clamp(13px,2.4vw,18px);border-radius:10px;padding:0'
        });
        btn._r = r; btn._c = c; btn.mine = false; btn.open = false; btn.flag = false;btn.mark = 0; btn.n = 0;
        bindCell(btn);
        cells.push(btn); grid.append(btn);
      }
      Sfx.play('shuffle');
      if (cheat) { cheat._resize(); snapCheat(); }
    }

    function bindCell(btn) {
      let lpTimer = null, longPressed = false;
      btn.addEventListener('contextmenu', e => { e.preventDefault(); cycleMark(btn); });
      btn.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse') return;
        longPressed = false;
        lpTimer = setTimeout(() => { longPressed = true; cycleMark(btn); }, 380);
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
        btn.addEventListener(ev, () => clearTimeout(lpTimer)));
btn.addEventListener('click', () => {
  if (longPressed) return;
  markMode ? cycleMark(btn) : dig(btn);
});
btn.addEventListener('dblclick', () => chord(btn));
      btn.addEventListener('keydown', e => {
        if (e.key === 'f' || e.key === 'F') { e.preventDefault(); cycleMark(btn); }
      });
    }

    /** 首点安全：在第一次点击后才布雷，排除点击格及其邻居 */
    function layMines(safe) {
      const banned = new Set([safe, ...around(safe._r, safe._c)]);
      const pool = UI.shuffle(cells.filter(c => !banned.has(c)));
      pool.slice(0, M).forEach(c => c.mine = true);
      cells.forEach(c => c.n = around(c._r, c._c).filter(x => x.mine).length);
    }

    function label(btn, txt) {
      btn.setAttribute('aria-label', `第 ${btn._r + 1} 行第 ${btn._c + 1} 列，${txt}`);
    }

const MARK_TXT = ['未翻开', '已插旗', '待定标记'];

/** state: 0 无 / 1 旗 / 2 问号 */
function setMark(btn, state) {
  if (over || btn.open) return;
  if (btn.mark === 1) flags--;
  btn.mark = state;
  if (state === 1) flags++;
  btn.flag = state === 1;                 // 保留旧字段，兼容其它判断

  btn.innerHTML = '';
  btn.style.background = '';
  btn.style.borderColor = '';

  if (state) {
    const ic = UI.icon(state === 1 ? 'i-flag' : 'i-mark');
    const color = state === 1 ? 'var(--pink)' : 'var(--cyan)';
    ic.style.cssText = `width:64%;height:64%;color:${color}`;
    btn.append(ic);
    btn.style.background = `color-mix(in srgb, ${color} 16%, var(--surface-2))`;
    btn.style.borderColor = color;
    UI.bounce(btn);
  }
  label(btn, MARK_TXT[state]);
  fChip.set(`${M - flags}/${M}`, true);
  Sfx.play(state ? 'flag' : 'select');
}

/** 循环：无 → 旗 → 问号 → 无 */
function cycleMark(btn) {
  if (over || btn.open) return;
  setMark(btn, ((btn.mark || 0) + 1) % 3);
}
    function reveal(btn) {
      btn.open = true; opened++;
      btn.style.background = 'color-mix(in srgb, var(--line) 45%, var(--surface))';
      btn.style.borderColor = 'transparent';
      btn.style.boxShadow = 'none';
      btn.innerHTML = '';
      if (btn.n) {
        btn.append(UI.el('span', {
          text: String(btn.n),
          style: `color:${NUM_COLOR[btn.n]};font-weight:700`
        }));
        label(btn, `周围有 ${btn.n} 颗雷`);
      } else label(btn, '空白区域');
      btn.style.animation = 'pop .22s var(--ease)';
    }

    function flood(start) {
      const q = [start], seen = new Set([start]);
      let depth = 0;
      while (q.length) {
        const cur = q.shift();
        if (cur.open || cur.flag) continue;
        reveal(cur);
        if (cur.n === 0) around(cur._r, cur._c).forEach(nb => {
          if (!seen.has(nb) && !nb.open && !nb.flag) { seen.add(nb); q.push(nb); }
        });
        if (depth++ % 6 === 0) Sfx.play('tick');
      }
    }

    function dig(btn) {
        if (over || btn.open || btn.mark === 1) return;   // 问号仍可翻开，旗子锁定
      if (!started) { started = true; layMines(btn); timer.start(); }
      if (btn.mine) return lose(btn);
      flood(btn);
      Sfx.play('pop', Math.min(btn.n, 6));
      checkWin();
    }

    /** 数字格双击：周围旗数等于数字时展开其余格 */
    function chord(btn) {
nb.forEach(x => { if (x.mark !== 1 && !x.open) dig(x); });
      if (!btn.open || !btn.n || over) return;
      const nb = around(btn._r, btn._c);
      if (nb.filter(x => x.flag).length !== btn.n) { Sfx.play('wrong'); return; }
if (nb.filter(x => x.mark === 1).length !== btn.n) { Sfx.play('wrong'); return; }
nb.forEach(x => { if (x.mark !== 1 && !x.open) dig(x); });
}

    function checkWin() {
cells.forEach(c => { if (c.mine && c.mark !== 1) setMark(c, 1); });
if (opened === R * C - M) {
        over = true; timer.stop();
        cells.forEach(c => { if (c.mine && !c.flag) toggleFlag(c); });
        Sfx.play('win'); UI.confetti();
        UI.modal({
          iconId: 'i-trophy', title: '全部安全区已排查',
          desc: `${LV[lv].label}，用时 ${timer.text}。`,
          actions: [
            { label: '再来一局', icon: 'i-refresh', primary: true, onClick: build },
            { label: '回到画廊', icon: 'i-back', onClick: () => location.hash = '#/' }
          ]
        });
      }
    }

    function lose(hit) {
      over = true; timer.stop();
      Sfx.play('boom');
      grid.classList.add('shake');
      setTimeout(() => grid.classList.remove('shake'), 460);
      UI.burst(hit, 22, ['#ff4d8d', '#ff8a3d', '#ffd93d']);
      cells.filter(c => c.mine).forEach((c, i) => setTimeout(() => {
        c.innerHTML = '';
        const ic = UI.icon('i-mine');
        ic.style.cssText = 'width:66%;height:66%;color:#fff';
        c.append(ic);
        c.style.background = c === hit
          ? 'linear-gradient(135deg,#ff4d8d,#ff8a3d)'
          : 'color-mix(in srgb, var(--ink) 55%, var(--surface))';
        c.style.borderColor = 'transparent';
        UI.bounce(c);
        label(c, '地雷');
      }, i * 45));
      setTimeout(() => {
        Sfx.play('lose');
        UI.modal({
          iconId: 'i-mine', title: '踩到地雷了',
          desc: `已翻开 ${opened} 格，坚持了 ${timer.text}。再试一次？`,
          actions: [
            { label: '重新开始', icon: 'i-refresh', primary: true, onClick: build },
            { label: '回到画廊', icon: 'i-back', onClick: () => location.hash = '#/' }
          ]
        });
      }, Math.min(cells.filter(c => c.mine).length * 45, 900) + 300);
    }

    build();
return { destroy: () => { timer.stop(); if (cheat) cheat.remove(); } };}

  App.register(meta);
})();
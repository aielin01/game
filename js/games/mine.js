/* 排雷：三态标记 + 作弊取景框 */
(function () {
  const LV = {
    easy:   { r: 9,  c: 9,  m: 10, label: '轻松' },
    normal: { r: 12, c: 12, m: 22, label: '标准' },
    hard:   { r: 14, c: 16, m: 40, label: '硬核' }
  };
  const NUM_COLOR =['', '#4cc9f0', '#3ddc97', '#ffd23f', '#ff8a3d', '#ff5c8a', '#8b5cf6', '#e3e3e6', '#cfcfd4'];

  const meta = {
    id: 'mine', name: '扫雷', icon: 'i-mine', ac: '#ff8a3d',
    desc: '数字代表周围地雷数。长按标记，翻开所有安全区即获胜。',
    tags: ['逻辑推理', '首点安全', '自动存档'],
    bestLabel: (k, v) => LV[k].label + ' ' + UI.fmtTime(v),
    mount
  };

  function mount(m) {
    let lv = 'easy', R, C, M, cells = [], opened = 0, flags = 0, over = false, started = false;
    const tChip = App.chip('i-clock', '00:00', '用时');
    const fChip = App.chip('i-flag', '0/0', '剩余旗数');
    const timer = UI.timer(t => tChip.set(t));

    const lvBtns = App.levels(LV, lv, k => { lv = k; build(true); });
    const btnNew = UI.el('button.btn.sm', { type: 'button', onclick: () => build(true) },
      [UI.icon('i-refresh'), UI.el('span', { text: '重开' })]);

    let markMode = false;
    const btnMark = UI.el('button.btn.ghost.sm', {
      type: 'button', 'aria-pressed': 'false',
      onclick: () => {
        markMode = !markMode; btnMark.setAttribute('aria-pressed', String(markMode));
        UI.toast(markMode ? '模式：点击插旗' : '模式：点击翻开'); Sfx.play('click');
      }
    }, [UI.icon('i-flag'), UI.el('span', { text: '标记' })]);

    let cheat = null;
    const btnCheat = UI.el('button.btn.ghost.sm', {
      type: 'button', 'aria-pressed': 'false',
      onclick: () => {
        Sfx.play('click');
        if (cheat) { cheat.remove(); cheat = null; btnCheat.setAttribute('aria-pressed', 'false'); }
        else { buildCheat(); btnCheat.setAttribute('aria-pressed', 'true'); UI.toast('取景框已开启，拖动顶部把手'); }
      }
    }, [UI.icon('i-grid'), UI.el('span', { text: '九宫格' })]);

    const { board } = App.shell(m, {
      hud: [tChip.node, fChip.node], tools: [...lvBtns, btnMark, btnCheat, btnNew],
      hint: '左键翻开，右键或长按切换标记（旗子/问号）。数字格双击可快速展开周围。'
    });

    const grid = UI.el('div', { role: 'grid' });
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

    function build(forceNew) {
      if (cheat) { cheat.remove(); cheat = null; btnCheat.setAttribute('aria-pressed', 'false'); }
      ({ r: R, c: C, m: M } = LV[lv]);
      over = false; started = false; opened = 0; flags = 0;
      grid.innerHTML = '';
      const size = `clamp(26px, min(${86 / C}vw, 42px), 42px)`;
      grid.setAttribute('style', `display:grid;gap:4px;grid-template-columns:repeat(${C}, ${size})`);
      cells = [];

      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const btn = UI.el('button.cellbtn', {
          type: 'button', role: 'gridcell',
          style: 'aspect-ratio:1;font-size:clamp(14px,2.6vw,19px);font-weight:700'
        });
        btn._r = r; btn._c = c; btn.mine = false; btn.open = false; btn.mark = 0; btn.n = 0;
        
        UI.pressable(btn, {
          tap: () => markMode ? cycleMark(btn) : dig(btn),
          hold: () => cycleMark(btn)
        });
        btn.addEventListener('dblclick', () => chord(btn));
        cells.push(btn); grid.append(btn);
      }

      const save = forceNew ? null : Store.loadGame(m.id);
      if (save && save.lv === lv) {
        started = true; opened = save.opened; flags = save.flags;
        timer.reset(save.time); timer.start();
        save.mines.forEach(i => cells[i].mine = true);
        cells.forEach((c, i) => {
          c.n = save.ns[i];
          if (save.opens[i]) reveal(c, true);
          else if (save.marks[i]) setMark(c, save.marks[i], true);
        });
      } else {
        timer.reset(); fChip.set(`${M}/${M}`);
        if (forceNew) Sfx.play('shuffle');
      }
    }

    function buildCheat() {
      board.style.position = 'relative';
      const handle = UI.el('div.cheat-handle', {}, [UI.icon('i-grid'), UI.el('span', { text: '拖动我' })]);
      const cells9 = Array.from({ length: 9 }, (_, i) => UI.el(i === 4 ? 'i.mid' : 'i'));
      const gridBox = UI.el('div.cheat-grid', {}, cells9);
      cheat = UI.el('div.cheat', { 'aria-hidden': 'true' }, [handle, gridBox]);

      const getSz = () => cells[0] ? cells[0].getBoundingClientRect().width : 32;
      const resize = () => {
        const side = getSz() * 3 + 8;
        gridBox.style.width = gridBox.style.height = cheat.style.width = side + 'px';
      };
      resize(); cheat._resize = resize;
      
      let dragging = false, ox = 0, oy = 0;
      handle.addEventListener('pointerdown', e => {
        dragging = true; handle.setPointerCapture(e.pointerId);
        const r = cheat.getBoundingClientRect();
        ox = e.clientX - r.left; oy = e.clientY - r.top;
        cheat.classList.add('dragging'); Sfx.play('select');
      });
      handle.addEventListener('pointermove', e => {
        if (!dragging) return;
        const b = board.getBoundingClientRect();
        cheat.style.left = (e.clientX - b.left - ox) + 'px';
        cheat.style.top = (e.clientY - b.top - oy) + 'px';
      });
      const end = () => {
        if (!dragging) return;
        dragging = false; cheat.classList.remove('dragging');
        snapCheat(); Sfx.play('place');
      };
      handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
      board.append(cheat); snapCheat();
    }

    function snapCheat() {
      if (!cheat || !cells.length) return;
      const step = (cells[0].getBoundingClientRect().width || 32) + 4;
      const b = board.getBoundingClientRect(), g = grid.getBoundingClientRect();
      const offX = g.left - b.left, offY = g.top - b.top;
      const hh = cheat.querySelector('.cheat-handle').offsetHeight;
      const col = Math.round((parseFloat(cheat.style.left || 0) - offX) / step);
      const row = Math.round((parseFloat(cheat.style.top || 0) + hh - offY) / step);
      const cc = Math.max(0, Math.min(col, C - 3)), rr = Math.max(0, Math.min(row, R - 3));
      cheat.style.left = (offX + cc * step) + 'px';
      cheat.style.top = (offY + rr * step - hh) + 'px';
    }

    window.addEventListener('resize', () => { if (cheat) { cheat._resize(); snapCheat(); } });

    function setMark(btn, state, silent) {
      if (over || btn.open) return;
      if (btn.mark === 1) flags--;
      btn.mark = state;
      if (state === 1) flags++;
      
      btn.innerHTML = ''; btn.style.background = ''; btn.style.borderColor = '';
      if (state) {
        const isF = state === 1;
        const ic = UI.icon(isF ? 'i-flag' : 'i-mark');
        const color = isF ? 'var(--a1)' : 'var(--a3)';
        ic.style.cssText = `width:64%;height:64%;color:${color}`;
        btn.append(ic);
        btn.style.background = `color-mix(in srgb, ${color} 16%, var(--surface-2))`;
        btn.style.borderColor = color;
        if (!silent) UI.bounce(btn);
      }
      fChip.set(`${M - flags}/${M}`, !silent);
      if (!silent) Sfx.play(state ? 'flag' : 'select');
    }

    const cycleMark = btn => setMark(btn, ((btn.mark || 0) + 1) % 3);

    function layMines(safe) {
      const banned = new Set([safe, ...around(safe._r, safe._c)]);
      const pool = UI.shuffle(cells.filter(c => !banned.has(c)));
      pool.slice(0, M).forEach(c => c.mine = true);
      cells.forEach(c => c.n = around(c._r, c._c).filter(x => x.mine).length);
    }

    function reveal(btn, silent) {
      btn.open = true; opened++;
      btn.style.background = 'color-mix(in srgb, var(--line) 40%, var(--surface))';
      btn.style.borderColor = 'transparent'; btn.style.boxShadow = 'none';
      btn.innerHTML = '';
      if (btn.n) btn.append(UI.el('span', { text: String(btn.n), style: `color:${NUM_COLOR[btn.n]}` }));
      if (!silent) btn.style.animation = 'pop .2s var(--pop)';
    }

    function dig(btn) {
      if (over || btn.open || btn.mark === 1) return;
      if (!started) { started = true; layMines(btn); timer.start(); }
      if (btn.mine) return lose(btn);
      
      const q = [btn], seen = new Set([btn]);
      let depth = 0;
      while (q.length) {
        const cur = q.shift();
        if (cur.open || cur.mark === 1) continue;
        if (cur.mark === 2) setMark(cur, 0, true);
        reveal(cur);
        if (cur.n === 0) around(cur._r, cur._c).forEach(nb => {
          if (!seen.has(nb) && !nb.open && nb.mark !== 1) { seen.add(nb); q.push(nb); }
        });
        if (depth++ % 6 === 0) Sfx.play('tick');
      }
      Sfx.play('pop', Math.min(btn.n, 6));
      checkWin();
    }

    function chord(btn) {
      if (!btn.open || !btn.n || over) return;
      const nb = around(btn._r, btn._c);
      if (nb.filter(x => x.mark === 1).length !== btn.n) { Sfx.play('wrong'); return; }
      nb.forEach(x => { if (x.mark !== 1 && !x.open) dig(x); });
    }

    function checkWin() {
      if (opened === R * C - M) {
        over = true; timer.stop(); Store.clearGame(m.id); Store.bump(m.id, 'plays');
        cells.forEach(c => { if (c.mine && c.mark !== 1) setMark(c, 1, true); });
        const rec = Store.record(m.id, lv, timer.seconds, false);
        Sfx.play(rec.isNew ? 'record' : 'win'); UI.confetti();
        UI.modal({
          title: rec.isNew ? '新纪录！' : '安全区已排查',
          desc: `${LV[lv].label}难度，用时 ${timer.text}。${rec.isNew ? '打破了 '+UI.fmtTime(rec.prev||0)+' 的记录！' : ''}`,
          actions: [
            { label: '再来一局', icon: 'i-refresh', primary: true, onClick: () => build(true) },
            { label: '返回', icon: 'i-back', onClick: () => location.hash = '#/' }
          ]
        });
      }
    }

    function lose(hit) {
      over = true; timer.stop(); Store.clearGame(m.id);
      Sfx.play('boom'); grid.classList.add('shake');
      UI.burst(hit, 16, ['#ff5c8a', '#ff8a3d']);
      
      cells.filter(c => c.mine || c.mark === 1).forEach((c, i) => setTimeout(() => {
        c.innerHTML = '';
        const ic = UI.icon(c.mine ? 'i-mine' : 'i-mark');
        ic.style.cssText = 'width:66%;height:66%;color:#fff';
        c.append(ic);
        c.style.background = (c === hit) ? 'var(--a1)' : (c.mine && c.mark !== 1 ? 'var(--ink)' : 'var(--a6)');
        c.style.borderColor = 'transparent';
        UI.bounce(c);
      }, i * 35));

      setTimeout(() => {
        Sfx.play('lose');
        UI.modal({
          iconId: 'i-mine', title: '踩到地雷了',
          desc: `已翻开 ${opened} 格，坚持了 ${timer.text}。`,
          actions: [
            { label: '重新开始', icon: 'i-refresh', primary: true, onClick: () => build(true) },
            { label: '返回', icon: 'i-back', onClick: () => location.hash = '#/' }
          ]
        });
      }, Math.min(M * 35, 800) + 300);
    }

    build();
    return {
      persist: () => {
        if (!over && started) Store.saveGame(m.id, {
          lv, time: timer.seconds, opened, flags,
          mines: cells.map((c,i)=>c.mine?i:-1).filter(i=>i!==-1),
          ns: cells.map(c=>c.n),
          opens: cells.map(c=>c.open),
          marks: cells.map(c=>c.mark)
        });
      },
      destroy: () => { timer.dispose(); if (cheat) cheat.remove(); }
    };
  }
  App.register(meta);
})();
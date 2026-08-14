/* 数独：支持数字键、笔记、错误高亮 */
(function () {
  const LV = {
    easy:   { c: 42, label: '轻松' },
    normal: { c: 34, label: '标准' },
    hard:   { c: 26, label: '硬核' }
  };

  const CSS = `
  .sd-layout{display:flex;flex-wrap:wrap;gap:clamp(16px,3vw,24px);justify-content:center;align-items:flex-start}
  .sd-grid{--sz:clamp(32px,9.2vw,50px);display:grid;grid-template-columns:repeat(9,var(--sz));
    grid-template-rows:repeat(9,var(--sz));border:2px solid var(--ink);border-radius:8px;
    background:var(--surface);overflow:hidden}
  .sd-cell{position:relative;display:grid;place-items:center;padding:0;border:1px solid var(--line);
    background:var(--surface);font-size:calc(var(--sz)*.48);line-height:1;cursor:pointer;
    transition:background .15s,color .15s,scale .15s var(--pop)}
  .sd-cell.br{border-right:2px solid var(--ink)}
  .sd-cell.bb{border-bottom:2px solid var(--ink)}
  .sd-cell.given{color:var(--ink);font-weight:700;background:var(--surface-3);cursor:default}
  .sd-cell.user{color:var(--a5);font-weight:700}
  .sd-cell.hinted{color:var(--a4);font-weight:700}
  .sd-cell.peer{background:color-mix(in srgb,var(--a3) 12%,var(--surface))}
  .sd-cell.same{background:color-mix(in srgb,var(--a2) 30%,var(--surface))}
  .sd-cell.sel{background:color-mix(in srgb,var(--a1) 20%,var(--surface));
    box-shadow:inset 0 0 0 2px var(--a1);z-index:2}
  .sd-cell.bad{color:#fff;background:var(--a1)}
  .sd-notes{display:grid;grid-template-columns:repeat(3,1fr);width:100%;height:100%;
    font-size:calc(var(--sz)*.22);color:var(--ink-3)}
  .sd-notes span{display:grid;place-items:center}
  .sd-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:min(240px,72vw)}
  .sd-pad .btn{justify-content:center;font-size:20px;padding:12px 0}
  .sd-side{display:flex;flex-direction:column;gap:14px;align-items:center}`;

  function injectCSS() {
    if (!document.getElementById('css-sudoku')) {
      const s = document.createElement('style'); s.id = 'css-sudoku'; s.textContent = CSS;
      document.head.append(s);
    }
  }

  const pOK = (bd, i, v) => {
    const r = (i / 9) | 0, c = i % 9, br = r - r % 3, bc = c - c % 3;
    for (let k = 0; k < 9; k++) {
      if (bd[r * 9 + k] === v || bd[k * 9 + c] === v) return false;
      if (bd[(br + ((k / 3) | 0)) * 9 + bc + (k % 3)] === v) return false;
    }
    return true;
  };
  function fill(bd, i = 0) {
    if (i === 81) return true;
    if (bd[i]) return fill(bd, i + 1);
    for (const v of UI.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (pOK(bd, i, v)) { bd[i] = v; if (fill(bd, i + 1)) return true; bd[i] = 0; }
    }
    return false;
  }
  function countSol(bd, i = 0, f = 0) {
    if (i === 81) return f + 1;
    if (bd[i]) return countSol(bd, i + 1, f);
    for (let v = 1; v <= 9; v++) {
      if (pOK(bd, i, v)) { bd[i] = v; f = countSol(bd, i + 1, f); bd[i] = 0; if (f > 1) return f; }
    }
    return f;
  }
  function generate(clues) {
    const sol = new Array(81).fill(0); fill(sol);
    const puzzle = sol.slice(); let rm = 0;
    for (const i of UI.shuffle([...Array(81).keys()])) {
      if (81 - rm <= clues) break;
      const keep = puzzle[i]; puzzle[i] = 0;
      if (countSol(puzzle.slice()) !== 1) puzzle[i] = keep; else rm++;
    }
    return { sol, puzzle };
  }

  const meta = {
    id: 'sudoku', name: '数独', icon: 'i-grid', ac: '#8b5cf6',
    desc: '行、列、宫填入1-9且不重复。支持笔记模式与键盘输入。',
    tags: ['数字逻辑', '唯一解', '自动存档'],
    bestLabel: (k, v) => LV[k].label + ' ' + UI.fmtTime(v),
    mount
  };

  function mount(m) {
    injectCSS();
    let lv = 'easy', sol, puzzle, values, notes, cells, sel = 0, noteM = false, hints, over;

    const tChip = App.chip('i-clock', '00:00', '用时');
    const eChip = App.chip('i-heart', 0, '空格数');
    const timer = UI.timer(t => tChip.set(t));

    const lvBtns = App.levels(LV, lv, k => { lv = k; build(true); });
    const btnNew = UI.el('button.btn.sm', { type: 'button', onclick: () => build(true) },
      [UI.icon('i-refresh'), UI.el('span', { text: '新题' })]);

    const { board } = App.shell(m, {
      hud: [tChip.node, eChip.node], tools: [...lvBtns, btnNew],
      hint: '方向键移动，数字键填写，N 键切笔记，Backspace 擦除。'
    });

    const grid = UI.el('div.sd-grid', { role: 'grid' });
    const btnNote = UI.el('button.btn.ghost', {
      type: 'button', 'aria-pressed': 'false',
      onclick: () => { noteM = !noteM; btnNote.setAttribute('aria-pressed', String(noteM)); UI.toast(noteM ? '笔记模式开' : '笔记模式关'); Sfx.play('click'); }
    }, [UI.icon('i-pencil'), UI.el('span', { text: '笔记' })]);
    const btnErase = UI.el('button.btn.ghost', { type: 'button', onclick: () => input(0) }, [UI.icon('i-eraser'), UI.el('span', { text: '擦除' })]);
    const btnHint = UI.el('button.btn.ghost', { type: 'button', onclick: hint }, [UI.icon('i-bulb'), UI.el('span', { text: '提示' })]);

    const pad = UI.el('div.sd-pad');
    for (let n = 1; n <= 9; n++) pad.append(UI.el('button.btn.ghost', { type: 'button', onclick: () => input(n) }, UI.el('span', { text: String(n) })));
    board.append(UI.el('div.sd-layout', {}, [grid, UI.el('div.sd-side', {}, [pad, UI.el('div.hud', {}, [btnNote, btnErase, btnHint])])]));

    function build(forceNew) {
      grid.innerHTML = ''; cells = []; over = false; noteM = false;
      btnNote.setAttribute('aria-pressed', 'false');

      const save = forceNew ? null : Store.loadGame(m.id);
      if (save && save.lv === lv) {
        sol = save.sol; puzzle = save.puzzle; values = save.values;
        notes = save.notes.map(a => new Set(a)); hints = save.hints;
        sel = values.findIndex(v => !v); if (sel < 0) sel = 0;
        timer.reset(save.time); timer.start();
        renderGrid();
      } else {
        UI.toast('生成中...');
        setTimeout(() => {
          const g = generate(LV[lv].c); sol = g.sol; puzzle = g.puzzle; values = puzzle.slice();
          notes = Array.from({ length: 81 }, () => new Set()); hints = 3; sel = values.findIndex(v => !v);
          timer.reset(); timer.start();
          if (forceNew) Sfx.play('shuffle');
          renderGrid();
        }, 20);
      }
    }

    function renderGrid() {
      for (let i = 0; i < 81; i++) {
        const r = (i / 9) | 0, c = i % 9, cls = ['sd-cell'];
        if (c % 3 === 2 && c !== 8) cls.push('br');
        if (r % 3 === 2 && r !== 8) cls.push('bb');
        if (puzzle[i]) cls.push('given');
        const cell = UI.el('button.' + cls.join('.'), {
          type: 'button', role: 'gridcell', onclick: () => { sel = i; Sfx.play('select'); paint(); }
        });
        cell._i = i; cells.push(cell); grid.append(cell);
      }
      btnHint.querySelector('span').textContent = '提示 ' + hints;
      paint();
    }

    const isP = (a, b) => a !== b && (((a / 9) | 0) === ((b / 9) | 0) || a % 9 === b % 9 ||
      (((a / 27) | 0) * 3 + (((a % 9) / 3) | 0) === ((b / 27) | 0) * 3 + (((b % 9) / 3) | 0)));
    
    function paint() {
      const bad = new Set();
      for (let a = 0; a < 81; a++) {
        if (!values[a]) continue;
        for (let b = a + 1; b < 81; b++) if (values[b] === values[a] && isP(a, b)) { bad.add(a); bad.add(b); }
      }
      const cur = values[sel]; let bl = 0;
      cells.forEach((c, i) => {
        c.classList.toggle('sel', i === sel); c.classList.toggle('peer', i !== sel && isP(i, sel));
        c.classList.toggle('same', !!cur && values[i] === cur && i !== sel);
        c.classList.toggle('bad', bad.has(i));
        c.classList.toggle('user', !puzzle[i] && !!values[i] && !c.classList.contains('hinted'));
        c.innerHTML = '';
        if (values[i]) c.append(UI.el('span', { text: String(values[i]) }));
        else if (notes[i].size) {
          const bx = UI.el('div.sd-notes');
          for (let n = 1; n <= 9; n++) bx.append(UI.el('span', { text: notes[i].has(n) ? String(n) : '' }));
          c.append(bx);
        }
        if (!values[i]) bl++;
      });
      eChip.set(bl);
    }

    function input(n) {
      if (over) return;
      if (puzzle[sel]) { Sfx.play('wrong'); return; }
      const c = cells[sel];
      if (n === 0) { values[sel] = 0; notes[sel].clear(); c.classList.remove('hinted'); Sfx.play('select'); paint(); return; }
      if (noteM) {
        notes[sel].has(n) ? notes[sel].delete(n) : notes[sel].add(n); values[sel] = 0;
        Sfx.play('tick'); paint(); return;
      }
      values[sel] = values[sel] === n ? 0 : n; notes[sel].clear(); c.classList.remove('hinted');
      if (values[sel]) {
        let clash = false;
        for (let i = 0; i < 81; i++) if (i !== sel && values[i] === n && isP(i, sel)) clash = true;
        if (clash) { Sfx.play('wrong'); UI.bounce(c, 'shake'); } else { Sfx.play('place'); UI.bounce(c); }
      } else Sfx.play('select');
      paint(); checkWin();
    }

    function hint() {
      if (over || hints <= 0) { if (!over) { Sfx.play('wrong'); UI.toast('提示用完'); } return; }
      const bl = [...values.keys()].filter(i => values[i] !== sol[i]);
      if (!bl.length) return;
      const i = bl.includes(sel) ? sel : bl[(Math.random() * bl.length) | 0];
      values[i] = sol[i]; notes[i].clear(); cells[i].classList.add('hinted');
      hints--; btnHint.querySelector('span').textContent = '提示 ' + hints; sel = i;
      Sfx.play('hint'); UI.burst(cells[i], 12, ['#8b5cf6', '#4cc9f0']); paint(); checkWin();
    }

    function checkWin() {
      if (values.some((v, i) => v !== sol[i])) return;
      over = true; timer.stop(); Store.clearGame(m.id); Store.bump(m.id, 'plays');
      cells.forEach((c, i) => setTimeout(() => UI.bounce(c), i * 5));
      const rec = Store.record(m.id, lv, timer.seconds, false);
      Sfx.play(rec.isNew ? 'record' : 'win'); UI.confetti();
      UI.modal({
        title: rec.isNew ? '新纪录！' : '数独完成',
        desc: `${LV[lv].label}难度，用时 ${timer.text}。${rec.isNew ? '打破了 '+UI.fmtTime(rec.prev||0)+' 的记录！' : ''}`,
        actions: [
          { label: '新题', icon: 'i-refresh', primary: true, onClick: () => build(true) },
          { label: '返回', icon: 'i-back', onClick: () => location.hash = '#/' }
        ]
      });
    }

    const onKey = e => {
      if (over || location.hash.replace(/^#\/?/, '') !== 'sudoku') return;
      const k = e.key;
      if (k >= '1' && k <= '9') { e.preventDefault(); input(+k); return; }
      if (k === 'Backspace' || k === 'Delete' || k === '0') { e.preventDefault(); input(0); return; }
      if (k === 'n' || k === 'N') { e.preventDefault(); btnNote.click(); return; }
      const mv = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[k];
      if (mv != null) {
        e.preventDefault();
        if ((mv === -1 && sel % 9 === 0) || (mv === 1 && sel % 9 === 8)) return;
        const nxt = sel + mv; if (nxt >= 0 && nxt <= 80) { sel = nxt; Sfx.play('tick'); paint(); }
      }
    };
    document.addEventListener('keydown', onKey);

    build();
    return {
      persist: () => {
        if (!over && cells && cells.length) Store.saveGame(m.id, {
          lv, time: timer.seconds, sol, puzzle, values, hints, notes: notes.map(s => [...s])
        });
      },
      destroy: () => { timer.dispose(); document.removeEventListener('keydown', onKey); }
    };
  }
  App.register(meta);
})();
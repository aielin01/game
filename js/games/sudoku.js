
/* 数独：回溯生成唯一解题面，支持笔记、冲突提示、键盘操作 */
(function () {
  const LV = {
    easy:   { clues: 42, label: '轻松' },
    normal: { clues: 34, label: '标准' },
    hard:   { clues: 27, label: '硬核' }
  };

  const CSS = `
  .sd-layout{display:flex;flex-wrap:wrap;gap:clamp(16px,3vw,28px);justify-content:center;align-items:flex-start}
  .sd-grid{--sz:clamp(30px,9.4vw,52px);display:grid;gap:0;
    grid-template-columns:repeat(9,var(--sz));grid-template-rows:repeat(9,var(--sz));
    border:3px solid var(--ink);border-radius:12px;overflow:hidden;background:var(--surface)}
  .sd-cell{position:relative;display:grid;place-items:center;padding:0;border:1px solid var(--line);
    background:var(--surface);font-size:calc(var(--sz)*.5);line-height:1;cursor:pointer;
    transition:background .16s,color .16s,transform .16s var(--ease)}
  .sd-cell.br{border-right:3px solid var(--ink)}
  .sd-cell.bb{border-bottom:3px solid var(--ink)}
  .sd-cell.given{color:var(--ink);font-weight:700;background:var(--surface-2);cursor:default}
  .sd-cell.user{color:var(--purple)}
  .sd-cell.hinted{color:var(--mint)}
  .sd-cell.peer{background:color-mix(in srgb,var(--cyan) 12%,var(--surface))}
  .sd-cell.same{background:color-mix(in srgb,var(--yellow) 34%,var(--surface))}
  .sd-cell.sel{background:color-mix(in srgb,var(--pink) 22%,var(--surface));
    box-shadow:inset 0 0 0 3px var(--pink);z-index:2}
  .sd-cell.bad{color:#fff;background:var(--pink)}
  .sd-notes{display:grid;grid-template-columns:repeat(3,1fr);width:100%;height:100%;
    font-size:calc(var(--sz)*.24);color:var(--ink-soft)}
  .sd-notes span{display:grid;place-items:center}
  .sd-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:min(230px,72vw)}
  .sd-pad .btn{justify-content:center;font-size:20px;padding:14px 0}
  .sd-side{display:flex;flex-direction:column;gap:12px;align-items:center}
  .sd-tools{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}`;

  function injectCSS() {
    if (document.getElementById('css-sudoku')) return;
    const s = document.createElement('style'); s.id = 'css-sudoku'; s.textContent = CSS;
    document.head.append(s);
  }

  /* ---------- 生成器 ---------- */
  const peersOK = (bd, i, v) => {
    const r = (i / 9) | 0, c = i % 9;
    const br = r - r % 3, bc = c - c % 3;
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
      if (peersOK(bd, i, v)) {
        bd[i] = v;
        if (fill(bd, i + 1)) return true;
        bd[i] = 0;
      }
    }
    return false;
  }

  /** 统计解的数量，最多数到 2 即返回（用于唯一性校验） */
  function countSolutions(bd, i = 0, found = 0) {
    if (i === 81) return found + 1;
    if (bd[i]) return countSolutions(bd, i + 1, found);
    for (let v = 1; v <= 9; v++) {
      if (peersOK(bd, i, v)) {
        bd[i] = v;
        found = countSolutions(bd, i + 1, found);
        bd[i] = 0;
        if (found > 1) return found;
      }
    }
    return found;
  }

  function generate(clues) {
    const sol = new Array(81).fill(0);
    fill(sol);
    const puzzle = sol.slice();
    let removed = 0;
    const order = UI.shuffle([...Array(81).keys()]);
    for (const i of order) {
      if (81 - removed <= clues) break;
      const keep = puzzle[i];
      puzzle[i] = 0;
      if (countSolutions(puzzle.slice()) !== 1) puzzle[i] = keep;
      else removed++;
    }
    return { sol, puzzle };
  }

  const meta = {
    id: 'sudoku', name: '数独', icon: 'i-grid',
    c1: '#5b2ee0', c2: '#ff6fb5',
    desc: '每行、每列、每宫填入 1 到 9 且不重复。支持笔记模式与冲突提示。',
    tags: ['数字逻辑', '三种难度', '唯一解'],
    mount
  };

  function mount(m) {
    injectCSS();
    let lv = 'easy', sol, puzzle, values, notes, cells, sel = 0, noteMode = false, hints, over;

    const tChip = App.chip('i-clock', '00:00', '用时');
    const eChip = App.chip('i-heart', 0, '空格数');
    const hChip = App.chip('i-bulb', 3, '提示次数');
    const timer = UI.timer(t => tChip.set(t));

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
    const btnNew = UI.el('button.btn', { type: 'button', onclick: () => build() },
      [UI.icon('i-refresh'), UI.el('span', { text: '新题目' })]);

    const { board } = App.shell(m, {
      hud: [tChip.node, eChip.node, hChip.node], tools: [...lvBtns, btnNew],
      hint: '方向键移动光标，数字键 1-9 填写，N 键切换笔记，Backspace 清除当前格。'
    });

    const grid = UI.el('div.sd-grid', { role: 'grid', 'aria-label': '数独棋盘' });
    const btnNote = UI.el('button.btn.ghost', {
      type: 'button', 'aria-pressed': 'false',
      onclick: () => {
        noteMode = !noteMode;
        btnNote.setAttribute('aria-pressed', String(noteMode));
        UI.toast(noteMode ? '笔记模式开启' : '笔记模式关闭');
        Sfx.play('click');
      }
    }, [UI.icon('i-pencil'), UI.el('span', { text: '笔记' })]);
    const btnErase = UI.el('button.btn.ghost', { type: 'button', onclick: () => input(0) },
      [UI.icon('i-eraser'), UI.el('span', { text: '擦除' })]);
    const btnHint = UI.el('button.btn.ghost', { type: 'button', onclick: hint },
      [UI.icon('i-bulb'), UI.el('span', { text: '提示' })]);

    const pad = UI.el('div.sd-pad');
    for (let n = 1; n <= 9; n++) {
      pad.append(UI.el('button.btn', {
        type: 'button', 'aria-label': `填入数字 ${n}`, onclick: () => input(n)
      }, UI.el('span', { text: String(n) })));
    }
    const side = UI.el('div.sd-side', {}, [pad, UI.el('div.sd-tools', {}, [btnNote, btnErase, btnHint])]);
    board.append(UI.el('div.sd-layout', {}, [grid, side]));

    function build() {
      Sfx.play('shuffle');
      const g = generate(LV[lv].clues);
      sol = g.sol; puzzle = g.puzzle;
      values = puzzle.slice();
      notes = Array.from({ length: 81 }, () => new Set());
      hints = 3; over = false; sel = values.findIndex(v => !v);
      hChip.set(hints); timer.reset(); timer.start();

      grid.innerHTML = '';
      cells = [];
      for (let i = 0; i < 81; i++) {
        const r = (i / 9) | 0, c = i % 9;
        const cls = ['sd-cell'];
        if (c % 3 === 2 && c !== 8) cls.push('br');
        if (r % 3 === 2 && r !== 8) cls.push('bb');
        if (puzzle[i]) cls.push('given');
        const cell = UI.el('button.' + cls.join('.'), {
          type: 'button', role: 'gridcell',
          onclick: () => { sel = i; Sfx.play('select'); paint(); }
        });
        cell._i = i;
        cells.push(cell); grid.append(cell);
      }
      paint();
    }

    const rowOf = i => (i / 9) | 0, colOf = i => i % 9;
    const boxOf = i => ((rowOf(i) / 3) | 0) * 3 + ((colOf(i) / 3) | 0);
    const isPeer = (a, b) => a !== b &&
      (rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || boxOf(a) === boxOf(b));

    function conflicts() {
      const bad = new Set();
      for (let a = 0; a < 81; a++) {
        if (!values[a]) continue;
        for (let b = a + 1; b < 81; b++) {
          if (values[b] === values[a] && isPeer(a, b)) { bad.add(a); bad.add(b); }
        }
      }
      return bad;
    }

    function paint() {
      const bad = conflicts();
      const cur = values[sel];
      let blanks = 0;
      cells.forEach((cell, i) => {
        cell.classList.toggle('sel', i === sel);
        cell.classList.toggle('peer', i !== sel && isPeer(i, sel));
        cell.classList.toggle('same', !!cur && values[i] === cur && i !== sel);
        cell.classList.toggle('bad', bad.has(i));
        cell.classList.toggle('user', !puzzle[i] && !!values[i] && !cell.classList.contains('hinted'));
        cell.innerHTML = '';
        if (values[i]) {
          cell.append(UI.el('span', { text: String(values[i]) }));
        } else if (notes[i].size) {
          const box = UI.el('div.sd-notes');
          for (let n = 1; n <= 9; n++) box.append(UI.el('span', { text: notes[i].has(n) ? String(n) : '' }));
          cell.append(box);
        }
        if (!values[i]) blanks++;
        const r = rowOf(i) + 1, c = colOf(i) + 1;
        cell.setAttribute('aria-label',
          `第 ${r} 行第 ${c} 列，${values[i] ? '数字 ' + values[i] : '空格'}${puzzle[i] ? '，题目给定' : ''}`);
      });
      eChip.set(blanks);
    }

    function input(n) {
      if (over) return;
      if (puzzle[sel]) { Sfx.play('wrong'); UI.toast('题目给定的数字不能修改'); return; }
      const cell = cells[sel];
      if (n === 0) {
        values[sel] = 0; notes[sel].clear(); cell.classList.remove('hinted');
        Sfx.play('select'); paint(); return;
      }
      if (noteMode) {
        notes[sel].has(n) ? notes[sel].delete(n) : notes[sel].add(n);
        values[sel] = 0;
        Sfx.play('tick'); paint(); return;
      }
      values[sel] = values[sel] === n ? 0 : n;
      notes[sel].clear();
      cell.classList.remove('hinted');
      if (values[sel]) {
        // 填入后若与同行列宫冲突，给出即时反馈但保留数字
        const clash = conflicts().has(sel);
        if (clash) { Sfx.play('wrong'); UI.bounce(cell, 'shake'); }
        else { Sfx.play('place'); UI.bounce(cell); }
      } else Sfx.play('select');
      paint();
      checkWin();
    }

    function hint() {
      if (over) return;
      if (hints <= 0) { Sfx.play('wrong'); UI.toast('提示次数已用完'); return; }
      const blanks = [...values.keys()].filter(i => values[i] !== sol[i]);
      if (!blanks.length) return;
      const i = blanks.includes(sel) ? sel : blanks[(Math.random() * blanks.length) | 0];
      values[i] = sol[i]; notes[i].clear();
      cells[i].classList.add('hinted');
      hints--; hChip.set(hints, true);
      sel = i;
      Sfx.play('hint'); UI.burst(cells[i], 10, ['#3ee0a6', '#ffd93d']);
      paint();
      checkWin();
    }

    function checkWin() {
      if (values.some((v, i) => v !== sol[i])) return;
      over = true; timer.stop();
      Sfx.play('win'); UI.confetti();
      cells.forEach((c, i) => setTimeout(() => UI.bounce(c), i * 6));
      UI.modal({
        iconId: 'i-trophy', title: '数独完成',
        desc: `${LV[lv].label}难度，用时 ${timer.text}，使用提示 ${3 - hints} 次。`,
        actions: [
          { label: '换一道题', icon: 'i-refresh', primary: true, onClick: build },
          { label: '回到画廊', icon: 'i-back', onClick: () => location.hash = '#/' }
        ]
      });
    }

    function onKey(e) {
      if (over || location.hash.replace(/^#\/?/, '') !== 'sudoku') return;
      const k = e.key;
      if (k >= '1' && k <= '9') { e.preventDefault(); input(+k); return; }
      if (k === 'Backspace' || k === 'Delete' || k === '0') { e.preventDefault(); input(0); return; }
      if (k === 'n' || k === 'N') { e.preventDefault(); btnNote.click(); return; }
      const move = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[k];
      if (move != null) {
        e.preventDefault();
        if ((move === -1 && colOf(sel) === 0) || (move === 1 && colOf(sel) === 8)) return;
        const next = sel + move;
        if (next < 0 || next > 80) return;
        sel = next; Sfx.play('tick'); paint();
      }
    }
    document.addEventListener('keydown', onKey);

    build();
    return {
      destroy() { timer.stop(); document.removeEventListener('keydown', onKey); }
    };
  }

  App.register(meta);
})();
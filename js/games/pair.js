/* 对对碰：使用 translate 修复飞牌，内部 i 缩放 */
(function () {
  const GEMS = [
    { s: 'i-shape-circle', c: '#ff5c8a' }, { s: 'i-shape-square', c: '#4cc9f0' },
    { s: 'i-shape-tri', c: '#ffd23f' },    { s: 'i-shape-drop', c: '#8b5cf6' },
    { s: 'i-shape-flower', c: '#3ddc97' }, { s: 'i-shape-bolt', c: '#ff8a3d' }
  ];
  const N = 8, MOVES = 30, TARGET = 2500;

  const CSS = `
  .pb-stage{position:relative;border-radius:18px;background:var(--surface-2);
    border:1px solid var(--line);overflow:hidden}
  .pb-gem{position:absolute;left:0;top:0;display:grid;place-items:center;padding:0;border:none;
    background:none;cursor:pointer;transition:translate .25s cubic-bezier(.3,1.2,.5,1),opacity .2s}
  .pb-gem i{display:grid;place-items:center;width:82%;height:82%;border-radius:26%;
    color:#fff;box-shadow:inset 0 -3px 0 rgba(0,0,0,.15);
    transition:scale .18s var(--pop),box-shadow .18s,rotate .25s}
  .pb-gem svg{width:56%;height:56%;stroke-width:2.2}
  .pb-gem:hover i{scale:1.06}
  .pb-gem[data-sel="1"] i{box-shadow:0 0 0 3px var(--bg),0 0 0 6px currentColor;
    animation:pbPulse .8s ease-in-out infinite}
  .pb-gem.clear i{scale:0.1!important;rotate:140deg;opacity:0}
  @keyframes pbPulse{50%{scale:1.1}}`;

  function injectCSS() {
    if (!document.getElementById('css-pair')) {
      const s = document.createElement('style'); s.id = 'css-pair'; s.textContent = CSS;
      document.head.append(s);
    }
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const meta = {
    id: 'pair', name: '宝石对对碰', icon: 'i-gem', ac: '#ffd23f',
    desc: '交换相邻宝石凑三消。连锁越长得分越高。30步内达到2500分。',
    tags: ['三消', '连锁计分', '自动存档'],
    bestLabel: (_, v) => '最高 ' + v + ' 分',
    mount
  };

  function mount(m) {
    injectCSS();
    let board, sel, busy, score, moves, size, over;
    const sChip = App.chip('i-star', 0, '得分');
    const mChip = App.chip('i-heart', MOVES, '剩余步数');
    const gChip = App.chip('i-trophy', TARGET, '目标分');
    const btnNew = UI.el('button.btn.sm', { type: 'button', onclick: () => build(true) },
      [UI.icon('i-refresh'), UI.el('span', { text: '重开' })]);

    const { board: wrap } = App.shell(m, {
      hud: [sChip.node, mChip.node, gChip.node], tools: [btnNew],
      hint: '点选宝石再点相邻完成交换。无法消除会自动还原。'
    });
    const stage = UI.el('div.pb-stage', { role: 'grid' });
    wrap.append(stage);

    function measure() {
      const avail = Math.min(window.innerWidth * 0.86, 460);
      size = Math.max(30, Math.floor(avail / N));
      stage.style.width = stage.style.height = size * N + 'px';
      if (board) board.flat().forEach(g => g && setPos(g, g.r, g.c, true));
    }
    let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(measure, 100); });

    function makeGem(kind) {
      const inner = UI.el('i', { style: `background:linear-gradient(145deg,${GEMS[kind].c},color-mix(in srgb,${GEMS[kind].c} 70%,#000))` },
        UI.icon(GEMS[kind].s));
      const btn = UI.el('button.pb-gem', {
        type: 'button', role: 'gridcell', style: `color:${GEMS[kind].c}`, onclick: () => pick(btn)
      }, inner);
      btn.kind = kind; stage.append(btn);
      return btn;
    }

    function setPos(g, r, c, instant) {
      g.r = r; g.c = c;
      g.style.width = g.style.height = size + 'px';
      if (instant) g.style.transition = 'none';
      g.style.translate = `${c * size}px ${r * size}px`;
      if (instant) requestAnimationFrame(() => g.style.transition = '');
    }

    const rndK = () => (Math.random() * GEMS.length) | 0;
    const repaint = g => {
      g.style.color = GEMS[g.kind].c;
      g.innerHTML = '';
      g.append(UI.el('i', { style: `background:linear-gradient(145deg,${GEMS[g.kind].c},color-mix(in srgb,${GEMS[g.kind].c} 70%,#000))` }, UI.icon(GEMS[g.kind].s)));
    };

    function build(forceNew) {
      stage.innerHTML = '';
      board = Array.from({ length: N }, () => Array(N).fill(null));
      sel = null; busy = false; over = false; measure();

      const save = forceNew ? null : Store.loadGame(m.id);
      if (save) {
        score = save.score; moves = save.moves;
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          const g = makeGem(save.grid[r * N + c]);
          board[r][c] = g; setPos(g, r, c, true);
        }
      } else {
        score = 0; moves = MOVES;
        if (forceNew) Sfx.play('shuffle');
        do {
          for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
            if (board[r][c]) board[r][c].remove();
            const g = makeGem(rndK()); board[r][c] = g; setPos(g, r, c, true);
          }
          let guard = 0;
          while (findMatches().length && guard++ < 400) findMatches().flat().forEach(g => { g.kind = rndK(); repaint(g); });
        } while (!hasMove());
      }
      sChip.set(score); mChip.set(moves);
    }

    function findMatches() {
      const grps = [];
      for (let r = 0; r < N; r++) {
        let run = [board[r][0]];
        for (let c = 1; c <= N; c++) {
          const g = c < N ? board[r][c] : null;
          if (g && run[0] && g.kind === run[0].kind) run.push(g);
          else { if (run.length >= 3) grps.push(run); run = [g]; }
        }
      }
      for (let c = 0; c < N; c++) {
        let run = [board[0][c]];
        for (let r = 1; r <= N; r++) {
          const g = r < N ? board[r][c] : null;
          if (g && run[0] && g.kind === run[0].kind) run.push(g);
          else { if (run.length >= 3) grps.push(run); run = [g]; }
        }
      }
      return grps;
    }

    function hasMove() {
      const swap = (a, b) => { const k = a.kind; a.kind = b.kind; b.kind = k; };
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const nr = r + dr, nc = c + dc;
          if (nr >= N || nc >= N) continue;
          swap(board[r][c], board[nr][nc]);
          const ok = findMatches().length > 0;
          swap(board[r][c], board[nr][nc]);
          if (ok) return true;
        }
      }
      return false;
    }

    function pick(g) {
      if (busy || over) return;
      if (sel === g) { delete g.dataset.sel; sel = null; Sfx.play('select'); return; }
      if (!sel) { sel = g; g.dataset.sel = '1'; Sfx.play('select'); return; }
      const adj = Math.abs(sel.r - g.r) + Math.abs(sel.c - g.c) === 1;
      if (!adj) { delete sel.dataset.sel; sel = g; g.dataset.sel = '1'; Sfx.play('select'); return; }
      const a = sel; delete a.dataset.sel; sel = null; trySwap(a, g);
    }

    const swapC = (a, b) => {
      const [ar, ac, br, bc] = [a.r, a.c, b.r, b.c];
      board[ar][ac] = b; board[br][bc] = a; setPos(a, br, bc); setPos(b, ar, ac);
    };

    async function trySwap(a, b) {
      busy = true; Sfx.play('flip'); swapC(a, b);
      await sleep(260);
      if (!findMatches().length) {
        Sfx.play('wrong'); swapC(a, b);
        UI.bounce(a, 'shake'); UI.bounce(b, 'shake');
        await sleep(400); busy = false; return;
      }
      moves--; mChip.set(moves, true); await resolve();
      busy = false; checkEnd();
    }

    async function resolve() {
      let chain = 0;
      while (true) {
        const grps = findMatches(); if (!grps.length) break;
        chain++; const set = new Set(grps.flat());
        Sfx.play('combo', chain);
        const gain = set.size * 20 * chain;
        score += gain; sChip.set(score, true);
        if (chain > 1) UI.toast(`${chain} 连锁 +${gain}`);

        set.forEach(g => {
          UI.burst(g, 10, [GEMS[g.kind].c, '#fff']);
          g.classList.add('clear'); g.disabled = true; board[g.r][g.c] = null;
        });
        await sleep(240); set.forEach(g => g.remove());
        
        for (let c = 0; c < N; c++) {
          let wr = N - 1;
          for (let r = N - 1; r >= 0; r--) {
            const g = board[r][c];
            if (g) { if (wr !== r) { board[wr][c] = g; board[r][c] = null; setPos(g, wr, c); } wr--; }
          }
          let up = 1;
          for (let r = wr; r >= 0; r--) {
            const g = makeGem(rndK()); setPos(g, -up, c, true); board[r][c] = g;
            const tr = r; requestAnimationFrame(() => requestAnimationFrame(() => setPos(g, tr, c)));
            up++;
          }
        }
        Sfx.play('place'); await sleep(280);
      }
      if (!hasMove()) {
        UI.toast('无解，自动洗牌'); Sfx.play('shuffle');
        board.flat().forEach(g => { g.kind = rndK(); repaint(g); });
        let guard = 0;
        while ((findMatches().length || !hasMove()) && guard++ < 400) board.flat().forEach(g => { g.kind = rndK(); repaint(g); });
      }
    }

    function checkEnd() {
      if (score >= TARGET || moves <= 0) {
        over = true; Store.clearGame(m.id); Store.bump(m.id, 'plays');
        const win = score >= TARGET;
        const rec = Store.record(m.id, 'score', score, true);
        Sfx.play(win ? (rec.isNew ? 'record' : 'win') : 'lose'); if (win) UI.confetti();
        UI.modal({
          iconId: win ? 'i-trophy' : 'i-gem', title: win ? '目标达成' : '步数耗尽',
          desc: `最终得分 ${score}。${rec.isNew ? '打破了最高分记录！' : ''}`,
          actions: [
            { label: '再来一局', icon: 'i-refresh', primary: true, onClick: () => build(true) },
            { label: '返回', icon: 'i-back', onClick: () => location.hash = '#/' }
          ]
        });
      }
    }

    build();
    return {
      persist: () => {
        if (!over && moves > 0 && moves < MOVES) Store.saveGame(m.id, {
          score, moves, grid: board.flat().map(g => g.kind)
        });
      }
    };
  }
  App.register(meta);
})();
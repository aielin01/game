
/* 对对碰：交换相邻宝石凑三消，支持连锁下落与死局洗牌 */
(function () {
  const GEMS = [
    { s: 'i-shape-circle', c: '#ff4d8d' }, { s: 'i-shape-square', c: '#4dd6ff' },
    { s: 'i-shape-tri', c: '#ffd93d' },    { s: 'i-shape-drop', c: '#7c4dff' },
    { s: 'i-shape-flower', c: '#3ee0a6' }, { s: 'i-shape-bolt', c: '#ff8a3d' }
  ];
  const N = 8, MOVES = 30, TARGET = 2000;

  const CSS = `
  .pb-stage{position:relative;border-radius:20px;background:var(--surface-2);
    border:2px solid var(--line);overflow:hidden}
  .pb-gem{position:absolute;left:0;top:0;display:grid;place-items:center;padding:0;border:none;
background:none;cursor:pointer;
    transition:translate .26s cubic-bezier(.3,1.2,.5,1),transform .18s var(--ease),opacity .2s}
    .pb-gem i{display:grid;place-items:center;width:86%;height:86%;border-radius:30%;
    color:#fff;box-shadow:inset 0 -4px 0 rgba(0,0,0,.16);
transition:translate .26s cubic-bezier(.3,1.2,.5,1),
             transform .18s var(--ease),opacity .2s}
             .pb-gem svg{width:58%;height:58%;stroke-width:2.4}
  .pb-gem:hover i{transform:scale(1.06)}
  .pb-gem[data-sel="1"] i{box-shadow:0 0 0 4px #fff,0 0 0 8px currentColor;
    animation:pbPulse .8s ease-in-out infinite}
  .pb-gem.clear{animation:pbClear .24s ease forwards}
  @keyframes pbPulse{50%{transform:scale(1.1)}}
  @keyframes pbClear{to{transform:scale(.1) rotate(140deg);opacity:0}}`;

  function injectCSS() {
    if (document.getElementById('css-pair')) return;
    const s = document.createElement('style'); s.id = 'css-pair'; s.textContent = CSS;
    document.head.append(s);
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const meta = {
    id: 'pair', name: '宝石对对碰', icon: 'i-gem',
    c1: '#ff4d8d', c2: '#ffd93d',
    desc: '交换相邻宝石，凑够三颗同色即消除。连锁越长得分越高。',
    tags: ['三消', '连锁计分', '30 步'],
    mount
  };

  function mount(m) {
    injectCSS();
    let board, sel, busy, score, moves, size, over, uid = 0;

    const sChip = App.chip('i-star', 0, '得分');
    const mChip = App.chip('i-heart', MOVES, '剩余步数');
    const gChip = App.chip('i-trophy', TARGET, '目标分');
    const btnNew = UI.el('button.btn', { type: 'button', onclick: () => build() },
      [UI.icon('i-refresh'), UI.el('span', { text: '重新开始' })]);

    const { board: wrap } = App.shell(m, {
      hud: [sChip.node, mChip.node, gChip.node], tools: [btnNew],
      hint: '点选一颗宝石，再点相邻宝石完成交换。无法消除的交换会自动还原，不扣步数。'
    });
    const stage = UI.el('div.pb-stage', { role: 'grid', 'aria-label': '对对碰棋盘' });
    wrap.append(stage);

    function measure() {
      const avail = Math.min(window.innerWidth * 0.86, 480);
      size = Math.max(32, Math.floor(avail / N));
      stage.style.width = stage.style.height = size * N + 'px';
      if (board) board.flat().forEach(g => g && setPos(g, g.r, g.c, true));
    }
    let rz;
    const onResize = () => { clearTimeout(rz); rz = setTimeout(measure, 120); };
    window.addEventListener('resize', onResize);

    function makeGem(kind) {
      const inner = UI.el('i', { style: `background:linear-gradient(150deg,${GEMS[kind].c},${GEMS[kind].c}c0)` },
        UI.icon(GEMS[kind].s));
      const btn = UI.el('button.pb-gem', {
        type: 'button', role: 'gridcell', style: `color:${GEMS[kind].c}`,
        onclick: () => pick(btn)
      }, inner);
      btn.kind = kind; btn.gid = ++uid;
      stage.append(btn);
      return btn;
    }

    function setPos(g, r, c, instant) {
      g.r = r; g.c = c;
      g.style.width = g.style.height = size + 'px';
      if (instant) g.style.transition = 'none';
g.style.translate = `${c * size}px ${r * size}px`;      g.setAttribute('aria-label', `第 ${Math.max(r + 1, 1)} 行第 ${c + 1} 列 宝石 ${g.kind + 1}`);
      if (instant) requestAnimationFrame(() => g.style.transition = '');
    }

    const rndKind = () => (Math.random() * GEMS.length) | 0;

    function build() {
      Sfx.play('shuffle');
      stage.innerHTML = '';
      board = Array.from({ length: N }, () => Array(N).fill(null));
      sel = null; busy = false; over = false; score = 0; moves = MOVES;
      sChip.set(0); mChip.set(moves); gChip.set(TARGET);
      measure();

      // 生成无初始三消且至少有一步可走的盘面
      do {
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          if (board[r][c]) board[r][c].remove();
          const g = makeGem(rndKind());
          board[r][c] = g; setPos(g, r, c, true);
        }
        let guard = 0;
        while (findMatches().length && guard++ < 400) {
          findMatches().flat().forEach(g => { g.kind = rndKind(); repaint(g); });
        }
      } while (!hasMove());
    }

    function repaint(g) {
      g.innerHTML = '';
      g.style.color = GEMS[g.kind].c;
      const inner = UI.el('i', { style: `background:linear-gradient(150deg,${GEMS[g.kind].c},${GEMS[g.kind].c}c0)` },
        UI.icon(GEMS[g.kind].s));
      g.append(inner);
    }

    /** 返回若干组待消除宝石（横向 + 纵向 3 连以上） */
    function findMatches() {
      const groups = [];
      for (let r = 0; r < N; r++) {
        let run = [board[r][0]];
        for (let c = 1; c <= N; c++) {
          const g = c < N ? board[r][c] : null;
          if (g && run[0] && g.kind === run[0].kind) run.push(g);
          else { if (run.length >= 3) groups.push(run); run = [g]; }
        }
      }
      for (let c = 0; c < N; c++) {
        let run = [board[0][c]];
        for (let r = 1; r <= N; r++) {
          const g = r < N ? board[r][c] : null;
          if (g && run[0] && g.kind === run[0].kind) run.push(g);
          else { if (run.length >= 3) groups.push(run); run = [g]; }
        }
      }
      return groups;
    }

    /** 试探所有相邻交换，判断是否还有可行步 */
    function hasMove() {
      const swap = (a, b) => {
        const k = a.kind; a.kind = b.kind; b.kind = k;
      };
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
      if (!adj) {
        delete sel.dataset.sel; sel = g; g.dataset.sel = '1'; Sfx.play('select'); return;
      }
      const a = sel; delete a.dataset.sel; sel = null;
      trySwap(a, g);
    }

    function swapCells(a, b) {
      const [ar, ac, br, bc] = [a.r, a.c, b.r, b.c];
      board[ar][ac] = b; board[br][bc] = a;
      setPos(a, br, bc); setPos(b, ar, ac);
    }

    async function trySwap(a, b) {
      busy = true;
      Sfx.play('flip');
      swapCells(a, b);
      await sleep(270);
      if (!findMatches().length) {
        Sfx.play('wrong');
        swapCells(a, b);
        a.classList.add('shake'); b.classList.add('shake');
        await sleep(430);
        a.classList.remove('shake'); b.classList.remove('shake');
        busy = false;
        return;
      }
      moves--; mChip.set(moves, true);
      await resolve();
      busy = false;
      checkEnd();
    }

    async function resolve() {
      let chain = 0;
      while (true) {
        const groups = findMatches();
        if (!groups.length) break;
        chain++;
        const set = new Set(groups.flat());
        Sfx.play('combo', chain);
        const gain = set.size * 20 * chain;
        score += gain; sChip.set(score, true);
        if (chain > 1) UI.toast(`${chain} 连锁　+${gain}`);

        set.forEach(g => {
          UI.burst(g, 10, [GEMS[g.kind].c, '#fff']);
          g.classList.add('clear');
          g.disabled = true;
          board[g.r][g.c] = null;
        });
        await sleep(250);
        set.forEach(g => g.remove());
        collapse();
        Sfx.play('place');
        await sleep(290);
      }
      if (!hasMove()) {
        UI.toast('无可行移动，自动洗牌');
        Sfx.play('shuffle');
        board.flat().forEach(g => { g.kind = rndKind(); repaint(g); });
        let guard = 0;
        while ((findMatches().length || !hasMove()) && guard++ < 400) {
          board.flat().forEach(g => { g.kind = rndKind(); repaint(g); });
        }
      }
    }

    /** 下落 + 顶部补充新宝石 */
    function collapse() {
      for (let c = 0; c < N; c++) {
        let write = N - 1;
        for (let r = N - 1; r >= 0; r--) {
          const g = board[r][c];
          if (!g) continue;
          if (write !== r) { board[write][c] = g; board[r][c] = null; setPos(g, write, c); }
          write--;
        }
        let up = 1;
        for (let r = write; r >= 0; r--) {
          const g = makeGem(rndKind());
          setPos(g, -up, c, true);
          board[r][c] = g;
          const target = r;
          requestAnimationFrame(() => requestAnimationFrame(() => setPos(g, target, c)));
          up++;
        }
      }
    }

    function checkEnd() {
      if (score >= TARGET) {
        over = true; Sfx.play('win'); UI.confetti();
        UI.modal({
          iconId: 'i-trophy', title: '达成目标分数',
          desc: `得分 ${score}，还剩 ${moves} 步。`,
          actions: [
            { label: '再来一局', icon: 'i-refresh', primary: true, onClick: build },
            { label: '回到画廊', icon: 'i-back', onClick: () => location.hash = '#/' }
          ]
        });
      } else if (moves <= 0) {
        over = true; Sfx.play('lose');
        UI.modal({
          iconId: 'i-gem', title: '步数用完了',
          desc: `最终得分 ${score}，距离目标还差 ${TARGET - score} 分。`,
          actions: [
            { label: '重新开始', icon: 'i-refresh', primary: true, onClick: build },
            { label: '回到画廊', icon: 'i-back', onClick: () => location.hash = '#/' }
          ]
        });
      }
    }

    build();
    return { destroy() { window.removeEventListener('resize', onResize); } };
  }

  App.register(meta);
})();
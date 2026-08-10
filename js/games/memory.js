/* 记忆翻牌：8 组图形配对，翻错自动扣回 */
(function () {
  const SHAPES = ['i-shape-circle', 'i-shape-square', 'i-shape-tri', 'i-shape-drop',
    'i-shape-flower', 'i-shape-bolt', 'i-shape-moon2', 'i-shape-ring'];
  const COLORS = ['#ff4d8d', '#ffd93d', '#4dd6ff', '#7c4dff', '#3ee0a6', '#ff8a3d', '#5b2ee0', '#ff6fb5'];

  const meta = {
    id: 'memory', name: '记忆翻牌', icon: 'i-cards',
    c1: '#7c4dff', c2: '#4dd6ff',
    desc: '翻开两张牌找出相同图形，全部配对即通关。步数越少评价越高。',
    tags: ['记忆力', '4×4', '单人'],
    mount
  };

  function mount(m) {
    const timer = UI.timer(t => tChip.set(t));
    const tChip = App.chip('i-clock', '00:00', '用时');
    const mChip = App.chip('i-star', 0, '步数');
    const pChip = App.chip('i-heart', '0/8', '已配对');
    const btnNew = UI.el('button.btn', { type: 'button', onclick: () => build() },
      [UI.icon('i-refresh'), UI.el('span', { text: '重新洗牌' })]);

    const { board } = App.shell(m, {
      hud: [tChip.node, mChip.node, pChip.node], tools: [btnNew],
      hint: '点击卡片翻开，两张图形一致即配对成功。也可用 Tab 与回车键操作。'
    });

    const grid = UI.el('div', {
      role: 'grid', 'aria-label': '记忆翻牌棋盘',
      style: `display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(8px,2vw,14px);
              width:min(440px,86vw)`
    });
    board.append(grid);

    let first = null, lock = false, moves = 0, pairs = 0, combo = 0;

    function build() {
      Sfx.play('shuffle');
      grid.innerHTML = '';
      first = null; lock = false; moves = 0; pairs = 0; combo = 0;
      mChip.set(0); pChip.set('0/8'); timer.reset();

      const deck = UI.shuffle(SHAPES.flatMap((s, i) => [{ s, i }, { s, i }]));
      deck.forEach((card, idx) => {
        const face = UI.el('span', {
          style: `display:grid;place-items:center;position:absolute;inset:0;
                  border-radius:var(--r-sm);backface-visibility:hidden;
                  background:linear-gradient(135deg,${COLORS[card.i]},${COLORS[card.i]}bb);
                  color:#fff;transform:rotateY(180deg)`
        }, UI.icon(card.s));
        face.querySelector('svg').style.width = '54%';
        face.querySelector('svg').style.height = '54%';

        const back = UI.el('span', {
          style: `display:grid;place-items:center;position:absolute;inset:0;
                  border-radius:var(--r-sm);backface-visibility:hidden;
                  background:var(--surface-2);border:2px solid var(--line);color:var(--ink-soft)`
        }, UI.icon('i-gem'));

        const inner = UI.el('span', {
          style: `position:absolute;inset:0;transform-style:preserve-3d;
                  transition:transform .42s var(--ease)`
        }, [back, face]);

        const btn = UI.el('button', {
          type: 'button', role: 'gridcell', 'aria-label': `第 ${idx + 1} 张卡片，未翻开`,
          style: `position:relative;aspect-ratio:1;border:none;background:none;padding:0;
                  border-radius:var(--r-sm);perspective:800px;cursor:pointer`,
          onclick: () => flip(btn)
        }, inner);
        btn._card = card; btn._inner = inner; btn._done = false;
        grid.append(btn);
      });
    }

    function setFlipped(btn, on) {
      btn._inner.style.transform = on ? 'rotateY(180deg)' : 'rotateY(0)';
      btn.setAttribute('aria-label', btn.getAttribute('aria-label')
        .replace(/未翻开|已翻开/, on ? '已翻开' : '未翻开'));
    }

    function flip(btn) {
      if (lock || btn._done || btn === first) return;
      timer.start();
      Sfx.play('flip');
      setFlipped(btn, true);

      if (!first) { first = btn; return; }
      moves++; mChip.set(moves, true);

      if (first._card.i === btn._card.i) {
        combo++;
        first._done = btn._done = true;
        [first, btn].forEach(b => {
          b.disabled = true;
          b.style.opacity = '.6';
          UI.bounce(b);
          UI.burst(b, 12, [COLORS[b._card.i], '#fff']);
        });
        Sfx.play('combo', combo);
        pairs++; pChip.set(pairs + '/8', true);
        first = null;
        if (pairs === 8) win();
      } else {
        combo = 0; lock = true;
        Sfx.play('wrong');
        const a = first, b = btn;
        a.classList.add('shake'); b.classList.add('shake');
        setTimeout(() => {
          [a, b].forEach(x => { setFlipped(x, false); x.classList.remove('shake'); });
          first = null; lock = false;
        }, 620);
      }
    }

    function win() {
      timer.stop();
      Sfx.play('win'); UI.confetti();
      const stars = moves <= 12 ? '三星' : moves <= 18 ? '两星' : '一星';
      UI.modal({
        iconId: 'i-trophy', title: '全部配对完成',
        desc: `用时 ${timer.text}，共 ${moves} 步，评价：${stars}。`,
        actions: [
          { label: '再来一局', icon: 'i-refresh', primary: true, onClick: build },
          { label: '回到画廊', icon: 'i-back', onClick: () => location.hash = '#/' }
        ]
      });
    }

    build();
    return { destroy: () => timer.stop() };
  }

  App.register(meta);
})();
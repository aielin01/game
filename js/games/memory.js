/* 记忆翻牌 */
(function () {
  const SHAPES = ['i-shape-circle', 'i-shape-square', 'i-shape-tri', 'i-shape-drop',
    'i-shape-flower', 'i-shape-bolt', 'i-shape-moon2', 'i-shape-ring'];
  
  const meta = {
    id: 'memory', name: '记忆翻牌', icon: 'i-cards', ac: '#ff5c8a',
    desc: '翻开两张牌找出相同图形，全部配对即通关。',
    tags: ['记忆力', '4×4', '自动存档'],
    bestLabel: (_, v) => '最少 ' + v + ' 步',
    mount
  };

  function mount(m) {
    const tChip = App.chip('i-clock', '00:00', '用时');
    const mChip = App.chip('i-star', 0, '步数');
    const pChip = App.chip('i-heart', '0/8', '已配对');
    const timer = UI.timer(t => tChip.set(t));
    const btnNew = UI.el('button.btn.sm', { type: 'button', onclick: () => build(true) },
      [UI.icon('i-refresh'), UI.el('span', { text: '重开' })]);

    const { board } = App.shell(m, {
      hud: [tChip.node, mChip.node, pChip.node], tools: [btnNew],
      hint: '点击卡片翻开，两张图形一致即配对成功。'
    });

    const grid = UI.el('div', {
      role: 'grid', style: `display:grid;grid-template-columns:repeat(4,1fr);
      gap:clamp(8px,2vw,14px);width:min(400px,82vw)`
    });
    board.append(grid);

    let deck = [], first = null, lock = false, moves = 0, pairs = 0, combo = 0, over = false;

    function build(forceNew) {
      grid.innerHTML = '';
      first = null; lock = false; over = false;

      const save = forceNew ? null : Store.loadGame(m.id);
      if (save) {
        ({ deck, moves, pairs, combo } = save);
        timer.reset(save.time);
      } else {
        deck = UI.shuffle(SHAPES.flatMap((s, i) => [{ s, i, up: false, done: false }, { s, i, up: false, done: false }]));
        moves = 0; pairs = 0; combo = 0; timer.reset();
        if (forceNew) Sfx.play('shuffle');
      }

      mChip.set(moves); pChip.set(pairs + '/8');
      if (pairs < 8 && moves > 0) timer.start();

      deck.forEach((card, idx) => {
        const face = UI.el('span', {
          style: `display:grid;place-items:center;position:absolute;inset:0;
                  border-radius:10px;backface-visibility:hidden;
                  background:var(--ac);color:#fff;transform:rotateY(180deg)`
        }, UI.icon(card.s, 'ico-lg'));
        face.querySelector('svg').style.width = '50%';
        face.querySelector('svg').style.height = '50%';

        const back = UI.el('span', {
          style: `display:grid;place-items:center;position:absolute;inset:0;
                  border-radius:10px;backface-visibility:hidden;
                  background:var(--surface-3);border:1px solid var(--line);color:var(--ink-3)`
        }, UI.icon('i-gem'));

        const inner = UI.el('span', {
          style: `position:absolute;inset:0;transform-style:preserve-3d;
                  transition:transform .4s var(--ease)`
        }, [back, face]);

        const btn = UI.el('button', {
          type: 'button', role: 'gridcell',
          style: `position:relative;aspect-ratio:1;border:none;background:none;padding:0;
                  border-radius:10px;perspective:800px;cursor:pointer`,
          onclick: () => flip(btn)
        }, inner);
        btn._card = card; btn._inner = inner;
        grid.append(btn);

        if (card.up || card.done) {
          inner.style.transform = 'rotateY(180deg)';
          if (card.done) { btn.disabled = true; btn.style.opacity = '.5'; }
          else first = btn;
        }
      });
    }

    function flip(btn) {
      const c = btn._card;
      if (lock || c.done) return;
      if (btn === first) {
        c.up = false; btn._inner.style.transform = 'rotateY(0)';
        first = null; Sfx.play('select'); return;
      }
      timer.start(); Sfx.play('flip');
      c.up = true; btn._inner.style.transform = 'rotateY(180deg)';

      if (!first) { first = btn; return; }
      moves++; mChip.set(moves, true);
      const c1 = first._card;

      if (c1.i === c.i) {
        combo++; c1.done = c.done = true;
        [first, btn].forEach(b => {
          b.disabled = true; b.style.opacity = '.5';
          UI.bounce(b); UI.burst(b, 10, [UI.ACC[c.i % UI.ACC.length], '#fff']);
        });
        Sfx.play('combo', combo);
        pairs++; pChip.set(pairs + '/8', true);
        first = null;
        if (pairs === 8) win();
      } else {
        combo = 0; lock = true; Sfx.play('wrong');
        const a = first, b = btn;
        a.classList.add('shake'); b.classList.add('shake');
        setTimeout(() => {
          c1.up = c.up = false;
          a._inner.style.transform = 'rotateY(0)'; b._inner.style.transform = 'rotateY(0)';
          a.classList.remove('shake'); b.classList.remove('shake');
          first = null; lock = false;
        }, 580);
      }
    }

    function win() {
      over = true; timer.stop(); Store.clearGame(m.id); Store.bump(m.id, 'plays');
      const rec = Store.record(m.id, 'min_moves', moves, false);
      Sfx.play(rec.isNew ? 'record' : 'win'); UI.confetti();
      UI.modal({
        title: rec.isNew ? '新纪录！' : '配对完成',
        desc: `用时 ${timer.text}，共 ${moves} 步。${rec.isNew ? '打破了之前 ' + (rec.prev||'-') + ' 步的记录！' : ''}`,
        actions: [
          { label: '再来一局', icon: 'i-refresh', primary: true, onClick: () => build(true) },
          { label: '返回', icon: 'i-back', onClick: () => location.hash = '#/' }
        ]
      });
    }

    build();
    return {
      persist: () => !over && moves > 0 && Store.saveGame(m.id, { deck, moves, pairs, combo, time: timer.seconds }),
      destroy: () => timer.dispose()
    };
  }
  App.register(meta);
})();
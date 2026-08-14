/* 路由 + 画廊 + 页面外壳 */
window.App = (function () {
  const games = [];
  const view = () => document.getElementById('view');
  let current = null;

  const register = m => games.push(m);

  function bestLine(m) {
    const b = Store.bestAny(m.id);
    if (!b) return Store.stat(m.id, 'plays') ? '已玩 ' + Store.stat(m.id, 'plays') + ' 局' : '尚无记录';
    return (m.bestLabel ? m.bestLabel(b.key, b.value) : '最佳 ' + b.value);
  }

  function renderGallery() {
    const v = view(); v.innerHTML = '';
    document.getElementById('btnBack').classList.add('hidden');
    document.title = '游戏厅';

    v.append(UI.el('section.hero', {}, [
      UI.el('h1', {}, [document.createTextNode('游戏厅'), UI.el('span.dot')]),
      UI.el('p', { text: '五款离线小游戏，进度与记录都存在本机。' })
    ]));

    const g = UI.el('div.gallery', { role: 'list' });
    games.forEach((m, i) => {
      const foot = UI.el('div.card-foot', {}, [
        UI.el('span.card-best', {}, [UI.icon('i-trophy'), UI.el('span', { text: bestLine(m) })]),
        UI.el('span.card-go', {}, [
          UI.el('span', { text: Store.hasSave(m.id) ? '继续' : '开始' }), UI.icon('i-play')
        ])
      ]);
      if (Store.hasSave(m.id)) foot.querySelector('.card-go').prepend(UI.el('i.resume-dot'));
      g.append(UI.el('a.card', {
        role: 'listitem', href: '#/' + m.id, style: `--n:${i};--ac:${m.ac}`,
        'aria-label': m.name + '。' + m.desc,
        onpointerenter: () => Sfx.play('hover'), onclick: () => Sfx.play('click')
      }, [
        UI.el('div.card-icon', {}, UI.icon(m.icon)),
        UI.el('h2', { text: m.name }),
        UI.el('p', { text: m.desc }),
        UI.el('div.tags', {}, m.tags.map(t => UI.el('span.tag', { text: t }))),
        foot
      ]));
    });
    v.append(g);

    v.append(UI.el('div.toolbar', { style: 'margin-top:22px;justify-content:center' },
      UI.el('button.btn.ghost.sm', {
        type: 'button',
        onclick: () => UI.modal({
          iconId: 'i-trash', title: '清空本机数据',
          desc: `将删除所有记录与存档，约占用 ${(Store.usage() / 1024).toFixed(1)} KB。`,
          actions: [
            { label: '确认清空', icon: 'i-trash', primary: true,
              onClick: () => { Store.wipe(); UI.toast('已清空'); renderGallery(); } },
            { label: '取消', icon: 'i-back' }
          ]
        })
      }, [UI.icon('i-trash'), UI.el('span', { text: '清空本机数据' })])));
  }

  /** 游戏外壳：返回 { board, hudBar, toolBar, setTools } */
  function shell(m, { hud = [], tools = [], hint = '' } = {}) {
    const v = view(); v.innerHTML = '';
    v.style.setProperty('--ac', m.ac);
    document.getElementById('btnBack').classList.remove('hidden');
    document.title = m.name + ' · 游戏厅';

    const hudBar = UI.el('div.hud', {}, hud);
    v.append(UI.el('header.game-head', {}, [
      UI.el('h1.game-title', {}, [
        UI.el('span.card-icon', {}, UI.icon(m.icon)), UI.el('span', { text: m.name })
      ]), hudBar
    ]));
    const toolBar = UI.el('div.toolbar', {}, tools);
    if (tools.length) v.append(toolBar);
    const board = UI.el('div.board-wrap');
    v.append(board);
    if (hint) v.append(UI.el('p.hint-bar', { text: hint }));
    v.focus({ preventScroll: true });
    return { board, hudBar, toolBar };
  }

  function chip(iconId, value, label) {
    const val = UI.el('span', { text: String(value) });
    const node = UI.el('span.chip', { title: label || '' }, [UI.icon(iconId), val]);
    return { node, set(v, flash) { val.textContent = String(v); if (flash) UI.bounce(node, 'flash'); } };
  }

  /** 难度按钮组 */
  function levels(map, cur, onPick) {
    const btns = Object.keys(map).map(k => {
      const b = UI.el('button.btn.ghost.sm', {
        type: 'button', 'aria-pressed': String(k === cur),
        onclick: () => {
          Sfx.play('click');
          btns.forEach(x => x.setAttribute('aria-pressed', String(x._k === k)));
          onPick(k);
        }
      }, UI.el('span', { text: map[k].label }));
      b._k = k; return b;
    });
    return btns;
  }

  function route() {
    if (current && current.destroy) current.destroy();
    current = null;
    document.querySelectorAll('.modal').forEach(n => n.remove());
    document.getElementById('fx').innerHTML = '';
    const id = (location.hash || '#/').replace(/^#\/?/, '');
    const m = games.find(x => x.id === id);
    window.scrollTo(0, 0);
    current = m ? (m.mount(m) || null) : (renderGallery(), null);
  }

  function start() {
    const html = document.documentElement;
    html.dataset.theme = Store.settings.theme
      || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
    const bt = document.getElementById('btnTheme');
    bt.setAttribute('aria-pressed', String(html.dataset.theme === 'dark'));
    bt.addEventListener('click', () => {
      const dark = html.dataset.theme === 'dark';
      html.dataset.theme = dark ? 'light' : 'dark';
      Store.settings.theme = html.dataset.theme; Store.saveSettings();
      bt.setAttribute('aria-pressed', String(!dark));
      document.querySelector('meta[name=theme-color]')
        ?.setAttribute('content', dark ? '#f4f4f5' : '#0b0b0d');
      Sfx.play('click');
    });

    Sfx.init();
    const bs = document.getElementById('btnSound');
    bs.setAttribute('aria-pressed', String(!Sfx.muted));
    bs.addEventListener('click', () => {
      const m = Sfx.toggle();
      bs.setAttribute('aria-pressed', String(!m));
      bs.setAttribute('aria-label', m ? '开启音效' : '关闭音效');
    });
    document.getElementById('btnBack').addEventListener('click', () => {
      Sfx.play('click'); location.hash = '#/';
    });

    window.addEventListener('hashchange', route);
    // 离开页面时给当前游戏一次保存机会
    window.addEventListener('pagehide', () => current && current.persist && current.persist());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && current && current.persist) current.persist();
    });
    route();
  }

  return { register, start, shell, chip, levels, games };
})();
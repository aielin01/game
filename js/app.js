/* hash 路由 + 画廊。每个游戏用 App.register 自注册 */
window.App = (function () {
  const games = [];
  const view = () => document.getElementById('view');
  let current = null;   // { destroy }

  function register(meta) { games.push(meta); }

  function renderGallery() {
    const v = view();
    v.innerHTML = '';
    document.getElementById('btnBack').classList.add('hidden');
    document.title = '糖果游戏厅 · Dopamine Arcade';

    v.append(UI.el('section.hero', {}, [
      UI.el('h1', { text: '糖果游戏厅' }),
      UI.el('p', { text: '五款脑力小游戏，纯静态运行。挑一个进去玩，音效随手可关。' })
    ]));

    const gallery = UI.el('div.gallery', { role: 'list' });
    games.forEach((g, i) => {
      const card = UI.el('a.card', {
        role: 'listitem', href: '#/' + g.id, style: `--n:${i};--g1:${g.c1};--g2:${g.c2}`,
        'aria-label': g.name + '：' + g.desc,
        onmouseenter: () => Sfx.play('hover'),
        onclick: () => Sfx.play('click')
      }, [
        UI.el('div.card-icon', {}, UI.icon(g.icon)),
        UI.el('h2', { text: g.name }),
        UI.el('p', { text: g.desc }),
        UI.el('div.tags', {}, g.tags.map(t => UI.el('span.tag', { text: t }))),
        UI.el('span.card-go', {}, [UI.icon('i-play'), UI.el('span', { text: '开始游戏' })])
      ]);
      gallery.append(card);
    });
    v.append(gallery);
  }

  /** 游戏页外壳：标题 + HUD 容器 + 棋盘容器，返回给各游戏填充 */
  function shell(meta, { hud = [], tools = [], hint = '' } = {}) {
    const v = view();
    v.innerHTML = '';
    v.style.setProperty('--g1', meta.c1);
    v.style.setProperty('--g2', meta.c2);
    document.getElementById('btnBack').classList.remove('hidden');
    document.title = meta.name + ' · 糖果游戏厅';

    const hudBar = UI.el('div.hud');
    const head = UI.el('header.game-head', {}, [
      UI.el('h1.game-title', {}, [
        UI.el('span.card-icon', { style: `--g1:${meta.c1};--g2:${meta.c2}` }, UI.icon(meta.icon)),
        UI.el('span', { text: meta.name })
      ]),
      hudBar
    ]);
    hud.forEach(h => hudBar.append(h));

    const toolBar = UI.el('div.hud', { style: 'margin-bottom:16px' });
    tools.forEach(t => toolBar.append(t));

    const board = UI.el('div.board-wrap');
    v.append(head);
    if (tools.length) v.append(toolBar);
    v.append(board);
    if (hint) v.append(UI.el('p.hint-bar', { text: hint }));
    v.focus();
    return { board, hudBar, toolBar };
  }

  /** 通用 HUD 芯片，返回 { node, set } */
  function chip(iconId, value, label) {
    const val = UI.el('span', { text: String(value) });
    const node = UI.el('span.chip', { 'aria-label': label || '' },
      [UI.icon(iconId), val]);
    return {
      node,
      set(v, flash) {
        val.textContent = String(v);
        if (flash) UI.bounce(node, 'flash');
      }
    };
  }

  function route() {
    if (current && current.destroy) current.destroy();
    current = null;
    document.querySelectorAll('.modal').forEach(m => m.remove());
    const id = (location.hash || '#/').replace(/^#\/?/, '');
    const meta = games.find(g => g.id === id);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    if (!meta) { renderGallery(); return; }
    current = meta.mount(meta) || null;
  }

  function start() {
    Sfx.init();
    const html = document.documentElement;
    const saved = localStorage.getItem('arcade.theme');
    if (saved) html.dataset.theme = saved;
    else if (matchMedia('(prefers-color-scheme:dark)').matches) html.dataset.theme = 'dark';

    document.getElementById('btnTheme').addEventListener('click', e => {
      const dark = html.dataset.theme === 'dark';
      html.dataset.theme = dark ? 'light' : 'dark';
      localStorage.setItem('arcade.theme', html.dataset.theme);
      e.currentTarget.setAttribute('aria-pressed', String(!dark));
      Sfx.play('click');
    });
    const bs = document.getElementById('btnSound');
    bs.addEventListener('click', () => {
      const m = Sfx.toggle();
      bs.setAttribute('aria-pressed', String(!m));
      bs.setAttribute('aria-label', m ? '开启音效' : '关闭音效');
    });
    bs.setAttribute('aria-pressed', String(!Sfx.muted));
    document.getElementById('btnBack').addEventListener('click', () => {
      Sfx.play('click'); location.hash = '#/';
    });

    window.addEventListener('hashchange', route);
    route();
  }

  return { register, start, shell, chip, games };
})();
/* DOM 工具 / 粒子 / toast / 弹窗 / 计时 / 长按 */
window.UI = (function () {
  const ACC = ['#ff5c8a', '#ffd23f', '#4cc9f0', '#3ddc97', '#8b5cf6', '#ff8a3d'];
  const lite = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
  const fx = () => document.getElementById('fx');

  function el(sel, attrs, kids) {
    const [tag, ...cls] = String(sel).split('.');
    const n = document.createElement(tag || 'div');
    if (cls.length) n.className = cls.join(' ');
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v === false || v == null) continue;
      if (k === 'text') n.textContent = v;
      else if (k === 'style') n.setAttribute('style', v);
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    (Array.isArray(kids) ? kids : kids ? [kids] : []).forEach(c =>
      n.append(typeof c === 'string' ? document.createTextNode(c) : c));
    return n;
  }

  function icon(id, cls) {
    const NS = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', 'ico' + (cls ? ' ' + cls : ''));
    s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS(NS, 'use');
    u.setAttribute('href', '#' + id);
    s.append(u); return s;
  }

  function burst(target, count = 12, colors = ACC) {
    if (lite() || !target) return;
    const r = target.getBoundingClientRect(), layer = fx();
    if (!layer || !r.width) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random(), d = 34 + Math.random() * 76;
      frag.append(el('i.spark', { style:
        `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;` +
        `background:${colors[i % colors.length]};--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d}px;` +
        `--r:${Math.random() * 480 - 240}deg;--d:${620 + Math.random() * 420}ms;` +
        `border-radius:${Math.random() > .5 ? '50%' : '2px'}` }));
    }
    layer.append(frag);
    setTimeout(() => layer.querySelectorAll('.spark').forEach(s => {
      if (parseFloat(getComputedStyle(s).opacity) === 0) s.remove();
    }), 1200);
  }

  function confetti(n = 56) {
    if (lite()) return;
    const layer = fx(); if (!layer) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      frag.append(el('i.spark', { style:
        `left:${Math.random() * 100}vw;top:-16px;background:${ACC[i % ACC.length]};
         --x:${Math.random() * 120 - 60}px;--y:${window.innerHeight + 60}px;
         --r:${Math.random() * 800}deg;--d:${1200 + Math.random() * 1000}ms;
         width:${6 + Math.random() * 7}px;height:${6 + Math.random() * 7}px` }));
    }
    layer.append(frag);
    setTimeout(() => { layer.innerHTML = ''; }, 2600);
  }

  let tt;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 1900);
  }

  function modal({ iconId = 'i-trophy', title, desc, actions = [] }) {
    const bar = el('div.modal-actions');
    const box = el('div.modal-box', { role: 'dialog', 'aria-modal': 'true' }, [
      el('div.card-icon', {}, icon(iconId)), el('h3', { text: title }),
      el('p', { text: desc }), bar
    ]);
    const wrap = el('div.modal', {}, box);
    const prev = document.activeElement;
    const onKey = e => { if (e.key === 'Escape') close(); };
    function close() {
      wrap.remove(); document.removeEventListener('keydown', onKey);
      if (prev && prev.focus) prev.focus();
    }
    actions.forEach(a => bar.append(el('button' + (a.primary ? '.btn' : '.btn.ghost'), {
      type: 'button',
      onclick: () => { Sfx.play('click'); close(); a.onClick && a.onClick(); }
    }, [icon(a.icon || 'i-play'), el('span', { text: a.label })])));
    document.body.append(wrap);
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => bar.querySelector('button')?.focus());
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    return { close, node: wrap };
  }

  /** 秒表；页面隐藏自动暂停，回来继续 */
  function timer(onTick) {
    let s = 0, id = null, running = false;
    const fmt = x => String((x / 60) | 0).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0');
    const beat = () => { s++; onTick(fmt(s), s); };
    const vis = () => { if (!running) return; document.hidden ? pause() : resume(); };
    function pause() { clearInterval(id); id = null; }
    function resume() { if (!id) id = setInterval(beat, 1000); }
    document.addEventListener('visibilitychange', vis);
    return {
      start() { running = true; resume(); },
      stop() { running = false; pause(); },
      reset(from = 0) { this.stop(); s = from; onTick(fmt(s), s); },
      set(v) { s = v; onTick(fmt(s), s); },
      get seconds() { return s; },
      get text() { return fmt(s); },
      dispose() { this.stop(); document.removeEventListener('visibilitychange', vis); }
    };
  }

  /** 统一长按/右键：tap 正常点击，hold 长按或右键 */
  function pressable(node, { tap, hold, ms = 380 }) {
    let t = null, fired = false, sx = 0, sy = 0;
    const clear = () => { clearTimeout(t); t = null; };
    node.addEventListener('contextmenu', e => { e.preventDefault(); if (hold) hold(); });
    node.addEventListener('pointerdown', e => {
      fired = false; sx = e.clientX; sy = e.clientY;
      if (e.pointerType === 'mouse') return;
      t = setTimeout(() => { fired = true; clear(); hold && hold(); }, ms);
    });
    node.addEventListener('pointermove', e => {
      if (t && (Math.abs(e.clientX - sx) > 9 || Math.abs(e.clientY - sy) > 9)) clear();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev =>
      node.addEventListener(ev, clear));
    node.addEventListener('click', e => {
      if (fired) { fired = false; return; }
      if (e.button === 2) return;
      tap && tap();
    });
  }

  const shuffle = a => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const bounce = (n, cls = 'boom') => {
    if (lite() || !n) return;
    n.classList.remove(cls); void n.offsetWidth; n.classList.add(cls);
    setTimeout(() => n.classList.remove(cls), 420);
  };
  const fmtTime = s => String((s / 60) | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

  return { el, icon, burst, confetti, toast, modal, timer, pressable,
           shuffle, bounce, fmtTime, ACC, lite };
})();
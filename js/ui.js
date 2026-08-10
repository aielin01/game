/* DOM 工具 + 粒子 + toast + 弹窗 */
window.UI = (function () {
  const fxLayer = () => document.getElementById('fx');
  const CONFETTI = ['#ff4d8d', '#ffd93d', '#4dd6ff', '#7c4dff', '#3ee0a6', '#ff8a3d'];

  /** 极简 createElement：el('div.foo', {attr}, [children|string]) */
  function el(sel, attrs, kids) {
    const [tagPart, ...cls] = String(sel).split('.');
    const node = document.createElement(tagPart || 'div');
    if (cls.length) node.className = cls.join(' ');
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v === false || v == null) continue;
      if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'style') node.setAttribute('style', v);
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    (Array.isArray(kids) ? kids : kids ? [kids] : []).forEach(c =>
      node.append(typeof c === 'string' ? document.createTextNode(c) : c));
    return node;
  }

  /** 引用雪碧图图标，禁止 emoji */
  function icon(id, cls) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ico' + (cls ? ' ' + cls : ''));
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + id);
    svg.append(use);
    return svg;
  }

  /** 从元素中心炸出彩色碎片 */
  function burst(target, count = 14, colors = CONFETTI) {
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    const r = target.getBoundingClientRect(), layer = fxLayer();
    if (!layer) return;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random(), dist = 40 + Math.random() * 90;
      const p = el('i.spark', {
        style: `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;
          background:${colors[i % colors.length]};
          --x:${Math.cos(a) * dist}px;--y:${Math.sin(a) * dist}px;
          --r:${Math.random() * 540 - 270}deg;--d:${700 + Math.random() * 500}ms;
          border-radius:${Math.random() > .5 ? '50%' : '3px'}`
      });
      layer.append(p);
      setTimeout(() => p.remove(), 1300);
    }
  }

  /** 顶部落下的胜利礼花 */
  function confetti(n = 70) {
    if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    const layer = fxLayer(); if (!layer) return;
    for (let i = 0; i < n; i++) {
      const p = el('i.spark', {
        style: `left:${Math.random() * 100}vw;top:-20px;
          background:${CONFETTI[i % CONFETTI.length]};
          --x:${Math.random() * 160 - 80}px;--y:${window.innerHeight + 80}px;
          --r:${Math.random() * 900}deg;--d:${1400 + Math.random() * 1200}ms;
          width:${8 + Math.random() * 8}px;height:${8 + Math.random() * 8}px`
      });
      layer.append(p);
      setTimeout(() => p.remove(), 2800);
    }
  }

  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2000);
  }

  /** 结算弹窗；actions = [{label, icon, primary, onClick}] */
  function modal({ iconId = 'i-trophy', title, desc, actions = [], theme }) {
    const box = el('div.modal-box', { style: theme || '' }, [
      el('div.card-icon', {}, icon(iconId)),
      el('h3', { text: title }),
      el('p', { text: desc }),
    ]);
    const bar = el('div.modal-actions');
    const wrap = el('div.modal', { role: 'dialog', 'aria-modal': 'true' }, box);
    const close = () => wrap.remove();
    actions.forEach(a => {
      const b = el('button' + (a.primary ? '.btn' : '.btn.ghost'), {
        type: 'button', onclick: () => { Sfx.play('click'); close(); a.onClick && a.onClick(); }
      }, [icon(a.icon || 'i-play'), el('span', { text: a.label })]);
      bar.append(b);
    });
    box.append(bar);
    const onEsc = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); } };
document.addEventListener('keydown', onEsc);
    document.body.append(wrap);
    setTimeout(() => bar.querySelector('button')?.focus(), 60);
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    return { close, node: wrap };
  }

  /** 秒表：mm:ss，供各游戏共用 */
  function timer(onTick) {
    let s = 0, id = null;
    const fmt = () => String((s / 60) | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    return {
      start() { if (id) return; id = setInterval(() => { s++; onTick(fmt(), s); }, 1000); },
      stop() { clearInterval(id); id = null; },
      reset() { this.stop(); s = 0; onTick(fmt(), 0); },
      get seconds() { return s; },
      get text() { return fmt(); }
    };
  }

  const shuffle = arr => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  const bounce = (node, cls = 'boom') => {
    node.classList.remove(cls);
    void node.offsetWidth;           // 强制重排以重启动画
    node.classList.add(cls);
  };

  return { el, icon, burst, confetti, toast, modal, timer, shuffle, bounce };
})();
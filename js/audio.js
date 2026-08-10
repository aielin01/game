/* 音效引擎：零资源依赖，全部实时合成 */
window.Sfx = (function () {
  let ctx = null, master = null;
  let muted = localStorage.getItem('arcade.muted') === '1';

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.32;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /** 单音：频率可滑音，ADSR 简化为 attack + exp decay */
  function tone({ f = 440, f2, type = 'sine', dur = .18, vol = .8, at = .008, delay = 0 } = {}) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t0);
    if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + at);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0); osc.stop(t0 + dur + .02);
  }

  /** 噪声：用于爆炸、洗牌、翻牌摩擦声 */
  function noise({ dur = .3, vol = .5, type = 'lowpass', f = 1200, f2, delay = 0 } = {}) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = type;
    flt.frequency.setValueAtTime(f, t0);
    if (f2) flt.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt).connect(g).connect(master);
    src.start(t0); src.stop(t0 + dur);
  }

  const P = {
    hover:  () => tone({ f: 900, type: 'triangle', dur: .05, vol: .18 }),
    click:  () => { tone({ f: 620, f2: 900, type: 'triangle', dur: .09, vol: .5 }); },
    pop:    (i = 0) => tone({ f: 520 * Math.pow(1.12, i), f2: 1050, type: 'sine', dur: .16, vol: .6 }),
    flip:   () => { noise({ dur: .09, f: 2600, f2: 700, vol: .3 }); tone({ f: 720, type: 'triangle', dur: .07, vol: .25 }); },
    select: () => tone({ f: 780, type: 'square', dur: .07, vol: .28 }),
    place:  () => { tone({ f: 300, f2: 520, type: 'sine', dur: .1, vol: .5 }); },
    flag:   () => { tone({ f: 1000, type: 'square', dur: .05, vol: .3 }); tone({ f: 1400, type: 'square', dur: .06, vol: .25, delay: .06 }); },
    wrong:  () => { tone({ f: 250, f2: 130, type: 'sawtooth', dur: .28, vol: .4 }); },
    boom:   () => { noise({ dur: .7, f: 900, f2: 60, vol: .9 }); tone({ f: 120, f2: 40, type: 'sine', dur: .6, vol: .7 }); },
    tick:   () => tone({ f: 1500, type: 'sine', dur: .03, vol: .14 }),
    hint:   () => [0, .07, .14].forEach((d, i) => tone({ f: 880 + i * 220, type: 'sine', dur: .12, vol: .3, delay: d })),
    /** 连击：音阶随 combo 递增 */
    combo:  (n = 1) => {
      const scale = [523, 587, 659, 784, 880, 1046, 1175, 1318];
      const f = scale[Math.min(n, scale.length) - 1];
      tone({ f, type: 'triangle', dur: .2, vol: .5 });
      tone({ f: f * 2, type: 'sine', dur: .14, vol: .2, delay: .03 });
    },
    win:    () => [523, 659, 784, 1046, 1318].forEach((f, i) =>
              tone({ f, type: 'triangle', dur: .32, vol: .45, delay: i * .1 })),
    lose:   () => [440, 392, 330, 262].forEach((f, i) =>
              tone({ f, type: 'sawtooth', dur: .34, vol: .3, delay: i * .13 })),
    shuffle:() => noise({ dur: .45, type: 'bandpass', f: 500, f2: 3200, vol: .35 })
  };

  const api = {
    play(name, arg) { const fn = P[name]; if (fn) { ensure(); fn(arg); } },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      localStorage.setItem('arcade.muted', muted ? '1' : '0');
      document.body.classList.toggle('muted', muted);
      if (!muted) { ensure(); if (master) master.gain.value = .32; api.play('click'); }
      else if (master) master.gain.value = 0;
      return muted;
    },
    init() {
      document.body.classList.toggle('muted', muted);
      // 首次交互解锁音频上下文（iOS / Chrome 自动播放策略）
      const unlock = () => { ensure(); window.removeEventListener('pointerdown', unlock); };
      window.addEventListener('pointerdown', unlock, { once: true });
    }
  };
  return api;
})();